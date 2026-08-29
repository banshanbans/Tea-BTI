from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import Base, engine
from .deps import ApiError
from .routers import discovery, me, profile, realm, sessions, voice
from .schemas import ErrorResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Tea-BTI 前端、后端与 AI 语音首版契约。",
    openapi_version="3.1.0",
    lifespan=lifespan,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.web_origin.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_payload(request: Request, code: str, message: str, retryable: bool = False, details: dict[str, Any] | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": getattr(request.state, "request_id", str(uuid.uuid4())),
            "retryable": retryable,
            "details": details or {},
        }
    }


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(request, exc.code, exc.message, exc.retryable, exc.details),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = {"fields": [{"path": ".".join(str(v) for v in error["loc"]), "message": error["msg"]} for error in exc.errors()]}
    return JSONResponse(status_code=422, content=error_payload(request, "VALIDATION_ERROR", "请求参数不符合契约", False, details))


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


app.include_router(sessions.router)
app.include_router(discovery.router)
app.include_router(realm.router)
app.include_router(me.router)
app.include_router(profile.router)
app.include_router(voice.router)