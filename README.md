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

## ZGX Nano + DGX Spark hardware loop

ReLoop routes analysis through **edge → core → edge** when hardware URLs are configured.

### 1. Start ZGX edge service (HP ZGX Nano / port 8001)

```bash
cd services/ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2. Start DGX orchestrator (DGX Spark / port 8002)

```bash
cd services/dgx-orchestrator
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

### 3. Configure Next.js (`.env.local`)

```bash
AI_SERVICE_URL=http://localhost:8001
DGX_ORCHESTRATOR_URL=http://localhost:8002
```

At the event, replace with real ZGX/DGX IPs. Without these URLs, ReLoop falls back to local simulation.

Check status: `GET http://localhost:3000/api/hardware/status`

## Nebius Token Factory (cloud backup LLM)

**Pitch:** DGX orchestrates locally; Nebius handles cloud-scale reasoning for the heaviest agents.

Nebius is the **cloud AI inference layer** — it does not replace DGX or run every agent. It augments three jobs:

| Job | Agent | What Nebius does |
|-----|--------|------------------|
| 1 | **Carbon Impact Agent** | Cloud CO₂ portfolio analysis (laptops, monitors, etc.) |
| 2 | **Reflection Agent** | Critiques the multi-agent plan — confidence, reuse routing, totals |
| 3 | **Backup / overflow** | After the pipeline finishes, returns `nebiusBackup.status: "live"` summary |

Without `NEBIUS_API_KEY`, ReLoop uses **local London datasets + rules** (demo still works).

Add to `.env.local`:

```bash
NEBIUS_API_KEY=your_nebius_token_factory_key
# Optional — auto-picks an instruct model if omitted
# NEBIUS_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
```

Check connectivity: `GET http://localhost:3000/api/nebius/status`

Nebius output appears in **Carbon Report**, **Reflection**, and the header status badge. Restart `npm run dev` after adding the key.

## Optional: Python AI Service (PyTorch)

Same as ZGX edge service above (`services/ai-service` on port 8001).

## Voice Agent (ElevenLabs + NemoClaw / OpenClaw)

### 1. Sandbox setup (run on host)

```bash
nemoclaw abdi exec python3 -m venv /home/sandbox/voice_agent/venv
nemoclaw abdi exec /home/sandbox/voice_agent/venv/bin/pip install elevenlabs sounddevice soundfile
```

Copy `agents/voice_agent/` into the sandbox at `/home/sandbox/voice_agent/`.

### 2. Environment variables

Create `.env.local` (frontend) or export on the host:

```bash
export ELEVEN_API_KEY=your_key_here
export ELEVEN_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 3. Start backend + launch agent

```bash
cd reloop-ai
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

```bash
curl -X POST http://localhost:8000/voice-agent/start
```

This launches the 75-minute session inside sandbox `abdi` via:

`nemoclaw abdi exec /home/sandbox/voice_agent/venv/bin/python3 /home/sandbox/voice_agent/run_voice_agent.py`

For local dev without nemoclaw: `VOICE_AGENT_LOCAL=true curl -X POST http://localhost:8000/voice-agent/start`

Session logs append to `agents/voice_agent/session_log.jsonl`.

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
