# Brainwave 云端部署指南

## 🚀 Railway 部署（推荐）

### 准备工作
项目已包含所需的部署文件：
- ✅ `Procfile` - 启动命令
- ✅ `requirements.txt` - Python 依赖
- ✅ `runtime.txt` - Python 版本
- ✅ `main.py` - 入口文件
- ✅ `.env` - 环境变量模板

### 部署步骤

#### 方法一：直接部署（最简单）
1. **访问 Railway**
   - 打开 [railway.app](https://railway.app)
   - 使用 GitHub 账号登录

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 如果没有 GitHub 仓库，选择 "Empty Project"

3. **上传项目文件**
   - 创建新的 GitHub 仓库
   - 将 `brainwave` 文件夹内容上传到仓库
   - 返回 Railway 连接该仓库

#### 方法二：使用 Railway CLI
```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 在项目目录中初始化
cd brainwave
railway init

# 部署
railway up
```

### 环境变量设置
在 Railway 项目设置中添加：

```
OPENAI_API_KEY=sk-3AO0I9LwXFNlr9Y2xVTsOwHovrJywQu1lu9Du0ghLP8GlT16
OPENAI_BASE_URL=https://api1.oaipro.com/v1
```

### 部署后验证
1. Railway 会提供一个 URL，如：`https://your-app.railway.app`
2. 访问该 URL 确认 Brainwave 界面加载
3. 测试录音功能和 AI 增强功能

---

## 🔄 Render 部署（备选）

### 部署步骤
1. **访问 Render**
   - 打开 [render.com](https://render.com)
   - 注册/登录账号

2. **创建 Web Service**
   - 点击 "New +" → "Web Service"
   - 连接 GitHub 仓库
   - 选择 `brainwave` 仓库

3. **配置设置**
   ```
   Name: brainwave
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: python main.py
   ```

4. **环境变量**
   ```
   OPENAI_API_KEY=sk-3AO0I9LwXFNlr9Y2xVTsOwHovrJywQu1lu9Du0ghLP8GlT16
   OPENAI_BASE_URL=https://api1.oaipro.com/v1
   ```

---

## 📋 部署清单

### 必需文件 ✅
- [x] `main.py` - 应用入口
- [x] `simple_server.py` - FastAPI 应用
- [x] `requirements.txt` - 依赖包列表
- [x] `Procfile` - 启动命令
- [x] `runtime.txt` - Python 版本
- [x] `static/` - 前端文件
- [x] `prompts.py` - AI 提示词
- [x] `llm_processor.py` - LLM 处理器

### 环境变量 ✅
- [x] `OPENAI_API_KEY` - API 密钥
- [x] `OPENAI_BASE_URL` - API 基础 URL

### 功能验证 ✅
- [x] Web 界面加载
- [x] WebSocket 连接
- [x] 录音功能
- [x] 音频转录
- [x] AI 增强功能

---

## 🎯 推荐顺序

1. **Railway**（最推荐）
   - 免费额度充足
   - 部署简单快速
   - 支持 WebSocket
   - 自动 HTTPS

2. **Render**（备选）
   - 免费计划
   - 自动休眠
   - GitHub 集成

---

## ⚠️ 注意事项

1. **API 密钥安全**
   - 不要在代码中硬编码 API 密钥
   - 使用环境变量管理敏感信息

2. **域名访问**
   - 部署后会获得 `.railway.app` 或 `.render.com` 域名
   - 可以绑定自定义域名

3. **资源限制**
   - 免费计划有一定的资源限制
   - 超出限制可能需要升级付费计划

---

## 🆘 故障排除

### 部署失败
- 检查 `requirements.txt` 依赖是否正确
- 确认 Python 版本兼容性
- 查看部署日志错误信息

### 服务无法访问
- 确认端口绑定正确（使用 `PORT` 环境变量）
- 检查防火墙设置
- 验证环境变量配置

### 音频转录失败
- 确认 API 密钥有效
- 检查 API 基础 URL 配置
- 查看服务器日志错误信息

---

🎉 **部署完成后，您就可以在任何地方访问 Brainwave 语音识别系统了！**