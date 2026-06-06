"""
ReLoop AI — PyTorch inference microservice
Runs on DGX Spark for heavy inference; falls back to demo mode without PyTorch.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
import os

app = FastAPI(title="ReLoop AI Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_MODE = os.getenv("RELOOP_DEMO_MODE", "true").lower() == "true"

try:
    import torch
    import torch.nn as nn

    class ConditionClassifier(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(4, 16),
                nn.ReLU(),
                nn.Linear(16, 8),
                nn.ReLU(),
                nn.Linear(8, 1),
                nn.Sigmoid(),
            )

        def forward(self, x):
            return self.net(x)

    model = ConditionClassifier()
    model.eval()
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    model = None


class AssetInput(BaseModel):
    device_type: str
    condition_score: float = Field(ge=0, le=1)
    estimated_age: float = Field(ge=0)
    quantity: int = Field(ge=1, default=1)


class InferenceResult(BaseModel):
    condition_score: float
    confidence: float
    action: Literal["reuse", "repair", "resell", "donate", "recycle"]
    processed_by: str
    demo_mode: bool


DEVICE_MAP = {"laptop": 0, "monitor": 1, "switch": 2, "server": 3}


def demo_inference(asset: AssetInput) -> InferenceResult:
    score = asset.condition_score
    if score > 0.7:
        action = "reuse"
    elif score > 0.55:
        action = "repair"
    elif score > 0.4:
        action = "resell"
    elif asset.device_type == "laptop":
        action = "donate"
    else:
        action = "recycle"

    return InferenceResult(
        condition_score=score,
        confidence=0.82 + score * 0.1,
        action=action,
        processed_by="ZGX_NANO_DEMO",
        demo_mode=True,
    )


def torch_inference(asset: AssetInput) -> InferenceResult:
    device_idx = DEVICE_MAP.get(asset.device_type, 0) / 3.0
    features = torch.tensor(
        [[device_idx, asset.condition_score, asset.estimated_age / 10, 0.5]]
    )
    with torch.no_grad():
        output = model(features)
        score = output.item()

    if score > 0.7:
        action = "reuse"
    elif score > 0.55:
        action = "repair"
    elif score > 0.4:
        action = "resell"
    else:
        action = "recycle"

    return InferenceResult(
        condition_score=round(score, 3),
        confidence=round(0.75 + score * 0.2, 3),
        action=action,
        processed_by="ZGX_NANO_TORCH",
        demo_mode=False,
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "pytorch": HAS_TORCH,
        "demo_mode": DEMO_MODE or not HAS_TORCH,
        "hardware": "NVIDIA DGX Spark / ZGX Nano",
    }


@app.post("/inference/edge", response_model=InferenceResult)
def edge_inference(asset: AssetInput):
    if DEMO_MODE or not HAS_TORCH:
        return demo_inference(asset)
    return torch_inference(asset)


@app.post("/inference/batch")
def batch_inference(assets: list[AssetInput]):
    return [edge_inference(a) for a in assets]
