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
| Nebius | Cloud-scale inference, overflow backup, Carbon + Reflection agents |
| ElevenLabs | Voice Operations Agent |

## Nebius Integration

**Nebius Token Factory** is ReLoop's cloud inference layer. DGX Spark orchestrates agents locally, but when heavier reasoning or overflow compute is needed, ReLoop offloads work to Nebius via an OpenAI-compatible API.

### What Nebius does in ReLoop

| Capability | Agent / route | Behavior |
|------------|---------------|----------|
| **Carbon modelling** | Carbon Impact Agent | Sends asset portfolio data to Nebius for CO₂ recovery estimates; London dataset math is used as fallback |
| **Multi-agent reflection** | Reflection Agent | Nebius critiques the combined agent output (confidence, reuse routing, totals) |
| **Overflow backup** | `/api/dgx/orchestrate` | After the pipeline completes, Nebius produces a cloud backup summary when DGX capacity is conceptually exceeded |
| **Demo safety net** | All Nebius calls | If the key is missing or the API fails, the app keeps running in local demo mode |

### Architecture flow

```
HP ZGX Nano (edge intake)
        ↓
NVIDIA DGX Spark (local agent orchestration)
        ↓
Nebius Token Factory (cloud inference — Carbon, Reflection, backup)
        ↓
HP ZGX Nano (reports + voice output)
```

### Setup

1. Copy the example env file:

```bash
cd reloop-ai
copy .env.example .env.local
```

2. Add your Nebius credentials from the [Nebius Token Factory](https://tokenfactory.nebius.com/) dashboard:

```bash
NEBIUS_API_KEY=your_key_here
NEBIUS_ENDPOINT=https://api.tokenfactory.nebius.com/v1
NEBIUS_MODEL=your_model_id_from_dashboard
```

3. Restart the dev server (env vars load at startup):

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000), click **Run Recovery Analysis**, and check the agent timeline for Nebius-powered steps.

> **Model ID:** Copy an exact model ID from your Nebius **Models** page. If the model name is wrong, Nebius calls fail silently and ReLoop falls back to local logic.

### Code locations

| File | Purpose |
|------|---------|
| `lib/llm/nebius.ts` | Nebius client, chat completions, carbon + reflection helpers |
| `lib/agents/circularAgent.ts` | Carbon Impact Agent → calls Nebius |
| `lib/agents/riskAgent.ts` | Reflection Agent → calls Nebius |
| `app/api/dgx/orchestrate/route.ts` | Pipeline orchestration + Nebius backup response |

### Pitch line (judges / demo)

> *"DGX Spark handles orchestration, but when we need heavier inference or cloud-scale reasoning, we offload to Nebius. This gives ReLoop AI distributed compute and keeps the multi-agent pipeline running even when local capacity is saturated."*

## Demo Inventory

- 120 laptops · 35 monitors · 15 switches · 10 servers

## Environment Variables

See **Nebius Integration** above for full setup. Quick reference:

```bash
NEBIUS_API_KEY=your_key_here
NEBIUS_ENDPOINT=https://api.tokenfactory.nebius.com/v1
NEBIUS_MODEL=your_model_id_from_dashboard
```

Optional: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (see `.env.example`).

Restart the dev server after saving `.env.local`.

## Tracks

- **Primary:** Urban Operations
- **Secondary:** Economic Systems
