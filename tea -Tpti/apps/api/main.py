"""《刷茶》后端 FastAPI 入口。

启动时：建表 + 种子数据 + 挂载 CORS + 注册路由。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from db import Base, SessionLocal, engine
from demo_page import render_demo_html
from routes import routers
from seed import seed_teas


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时建表 + 种子（幂等）
    Base.metadata.create_all(bind=engine)
    seed_teas()
    yield


app = FastAPI(title="刷茶 API", version="0.1.0", lifespan=lifespan)

# 允许本地前端（Next.js / Vite 常见端口）+ 通配（联调 / 演示）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 挂载 routes（Integrate 阶段补全）
for router in routers:
    app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    """可视化 Demo 页：茶库 + 冷启动 Feed + 示例推荐。"""
    db = SessionLocal()
    try:
        return render_demo_html(db)
    finally:
        db.close()
