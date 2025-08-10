import asyncio
import json
import os
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
import uvicorn
import logging
from prompts import PROMPTS
from starlette.websockets import WebSocketState
from openai import OpenAI, AsyncOpenAI
from pydantic import BaseModel, Field
from typing import Generator
from llm_processor import get_llm_processor
from datetime import datetime, timedelta
import tempfile
import io

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic models for request and response schemas
class ReadabilityRequest(BaseModel):
    text: str = Field(..., description="The text to improve readability for.")

class ReadabilityResponse(BaseModel):
    enhanced_text: str = Field(..., description="The text with improved readability.")

class CorrectnessRequest(BaseModel):
    text: str = Field(..., description="The text to check for factual correctness.")

class CorrectnessResponse(BaseModel):
    analysis: str = Field(..., description="The factual correctness analysis.")

class AskAIRequest(BaseModel):
    text: str = Field(..., description="The question to ask AI.")

class AskAIResponse(BaseModel):
    answer: str = Field(..., description="AI's answer to the question.")

app = FastAPI()

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY is not set in environment variables.")
    raise EnvironmentError("OPENAI_API_KEY is not set.")

# Initialize with a default model
llm_processor = get_llm_processor("gpt-4o")  # Default processor

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def get_realtime_page(request: Request):
    return FileResponse("static/realtime.html")

@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    """简化的 WebSocket 连接，仅用于状态管理"""
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    
    try:
        # 发送连接成功状态
        await websocket.send_text(json.dumps({
            "type": "status", 
            "status": "connected",
            "message": "WebSocket connected - ready for recording"
        }))
        
        # 保持连接并处理客户端消息
        while True:
            try:
                message = await websocket.receive_text()
                data = json.loads(message)
                
                if data.get("type") == "ping":
                    # 心跳响应
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif data.get("type") == "recording_status":
                    # 录音状态更新
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "status": "recording" if data.get("recording") else "idle"
                    }))
                    
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        logger.info("WebSocket connection closed")

@app.post(
    "/api/v1/transcribe",
    summary="Transcribe Audio",
    description="Upload audio file and get transcription using Whisper API."
)
async def transcribe_audio(audio: UploadFile = File(...)):
    """Upload audio and get transcription"""
    try:
        logger.info(f"Received audio file: {audio.filename}, content_type: {audio.content_type}")
        
        # 读取音频数据
        audio_data = await audio.read()
        logger.info(f"Audio file size: {len(audio_data)} bytes")
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            tmp_file.write(audio_data)
            tmp_file_path = tmp_file.name
        
        try:
            # 使用 OpenAI Whisper API 进行转录
            base_url = os.getenv("OPENAI_BASE_URL")
            client = OpenAI(
                api_key=os.getenv("OPENAI_API_KEY"),
                base_url=base_url if base_url else None
            )
            
            with open(tmp_file_path, "rb") as audio_file:
                transcription_response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            # 处理响应 - 如果是JSON字符串就解析，否则直接使用
            if isinstance(transcription_response, str):
                try:
                    import json
                    parsed = json.loads(transcription_response)
                    transcription = parsed.get("text", transcription_response)
                except:
                    transcription = transcription_response
            else:
                transcription = transcription_response
            
            logger.info(f"Transcription completed: {transcription[:100]}...")
            return {"transcription": transcription}
            
        finally:
            # 清理临时文件
            os.unlink(tmp_file_path)
            
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post(
    "/api/v1/readability",
    response_model=ReadabilityResponse,
    summary="Improve Text Readability", 
    description="Enhance the readability and formatting of the provided text using GPT-4o."
)
async def improve_readability(request: ReadabilityRequest):
    prompt = PROMPTS.get('paraphrase')
    if not prompt:
        raise HTTPException(status_code=500, detail="Readability prompt not found.")

    try:
        async def text_generator():
            # Use GPT-4o for text processing
            async for part in llm_processor.process_text(request.text, prompt, model="gpt-4o"):
                yield part

        return StreamingResponse(text_generator(), media_type="text/plain")

    except Exception as e:
        logger.error(f"Error improving readability: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing readability improvement.")

@app.post(
    "/api/v1/ask_ai",
    response_model=AskAIResponse,
    summary="Ask AI Question",
    description="Ask a question to AI and get a thoughtful response using GPT-4o."
)
async def ask_ai(request: AskAIRequest):
    prompt = PROMPTS.get('chat')
    if not prompt:
        raise HTTPException(status_code=500, detail="Chat prompt not found.")

    try:
        result = llm_processor.process_text_sync(request.text, prompt, model="o1-mini")
        return {"answer": result}

    except Exception as e:
        logger.error(f"Error processing AI question: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing AI question.")

@app.post(
    "/api/v1/correctness",
    response_model=CorrectnessResponse,
    summary="Check Factual Correctness",
    description="Analyze the text for factual accuracy using GPT-4o."
)
async def check_correctness(request: CorrectnessRequest):
    prompt = PROMPTS.get('correctness-check')
    if not prompt:
        raise HTTPException(status_code=500, detail="Correctness prompt not found.")

    try:
        async def text_generator():
            # Specifically use gpt-4o for correctness checking
            async for part in llm_processor.process_text(request.text, prompt, model="gpt-4o"):
                yield part

        return StreamingResponse(text_generator(), media_type="text/plain")

    except Exception as e:
        logger.error(f"Error checking correctness: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing correctness check.")

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 3005))
    uvicorn.run(app, host="0.0.0.0", port=port)