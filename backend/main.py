"""
ReLoop AI Backend — FastAPI service on port 8000.

Includes Voice Agent launcher and can be extended with other ReLoop APIs.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.voice_agent import router as voice_agent_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="ReLoop AI Backend",
    description="Backend services for ReLoop AI including Voice Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice_agent_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "reloop-backend"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
