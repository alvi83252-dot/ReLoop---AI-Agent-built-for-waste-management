# ReLoop AI

**Before waste becomes waste, ReLoop finds its next life.**

Autonomous circular-economy intelligence platform for the NVIDIA Hack for Impact London hackathon.

## Quick Start

```bash
cd reloop-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Run Recovery Analysis**. Works fully in demo mode without API keys.

## Optional: Python AI Service (PyTorch)

```bash
cd services/ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Architecture

**ZGX Nano → DGX Spark → ZGX Nano**

1. **Edge (HP ZGX Nano)** — Asset intake, condition scanning, TensorRT inference
2. **Core (NVIDIA DGX Spark)** — Multi-agent orchestration, carbon/economic simulation
3. **Edge Execution** — Report generation, voice output

### Agents

- Asset Intake Agent (edge)
- Lifecycle Agent
- Circular Economy Agent
- Carbon Impact Agent
- Economic Agent
- Matching Agent
- Risk & Confidence Agent
- Reflection Agent
- Decision Synthesizer
- Report Generation Agent

## Sponsor Integrations

| Sponsor | Role |
|---------|------|
| NVIDIA | CUDA, TensorRT, DGX acceleration |
| HP ZGX Nano | Edge AI inference |
| DGX Spark (Scan) | Multi-agent orchestration |
| Nebius | Cloud backup inference |
| ElevenLabs | Voice Operations Agent |

## Demo Inventory

- 120 laptops · 35 monitors · 15 switches · 10 servers

## Environment Variables

Copy `.env.example` to `.env.local` for optional integrations. Demo mode requires no keys.

## Tracks

- **Primary:** Urban Operations
- **Secondary:** Economic Systems
