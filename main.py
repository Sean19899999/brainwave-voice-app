#!/usr/bin/env python3

import os
import uvicorn
from simple_server import app

if __name__ == "__main__":
    # Railway 自动提供 PORT 环境变量
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)