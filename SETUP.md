# AI Voice Agent — Setup & Run Guide

## Overview

This is a multi-service application with three components:

| Component | Technology | Port |
|-----------|-----------|------|
| Backend API + Queue | Node.js / Express | 3001 |
| Frontend Dashboard | React / Vite | 5173 (dev) |
| Job Queue Store | Redis | 6379 |

---

## Prerequisites

Install these before anything else:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 or 20 | https://nodejs.org |
| npm | bundled with Node | — |
| Redis | 7+ | See below |
| ngrok (dev only) | any | https://ngrok.com |

### Install Redis

**macOS (Homebrew)**
```bash
brew install redis
brew services start redis
```

**Docker (any OS)**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Windows**
Download from https://github.com/microsoftarchive/redis/releases or use Docker Desktop.

Verify Redis is running:
```bash
redis-cli ping   # should return: PONG
```

---

## External API Accounts Required

You need accounts and API keys from these services:

| Service | Purpose | Get Key At |
|---------|---------|------------|
| **Bolna AI** | Voice call orchestration | https://app.bolna.ai |
| **ElevenLabs** | Text-to-speech (Indian voice) | https://elevenlabs.io |
| **Deepgram** | Speech-to-text | https://deepgram.com |
| **Twilio** | Telephony / outbound calls | https://www.twilio.com |

> Bolna AI integrates ElevenLabs, Deepgram, and Twilio internally. You configure them **inside Bolna** — you only need the Bolna API key in this app.

---

## Step 1 — Clone / Download the Project

```
Voice Agent Demo/
├── server/          ← Backend (Node.js)
├── client/          ← Frontend (React)
├── .env.example     ← Environment variable template
├── Dockerfile
├── docker-compose.yml
└── sample_contacts.csv
```

---

## Step 2 — Configure Environment Variables

```bash
cd "Voice Agent Demo/server"
cp ../.env.example .env
```

Open `server/.env` and fill in the values:

```env
# ── Required ────────────────────────────────────────
BOLNA_API_KEY=ba_xxxxxxxxxxxxxxxxxxxxxxxxxx
BOLNA_PHONE_NUMBER=+91XXXXXXXXXX
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io

# ── Redis (leave as-is if Redis is on localhost) ────
REDIS_URL=redis://localhost:6379

# ── Optional overrides ──────────────────────────────
MAX_CONCURRENT_CALLS=5
DEFAULT_DEALER_NAME=Your Dealership Name
DEFAULT_DEALER_ADDRESS=123 Main St, City
DEFAULT_DEALER_PHONE=+919876543210
DEFAULT_LANGUAGE=hinglish
```

### Getting WEBHOOK_BASE_URL (Important)

Bolna AI calls your server when a call completes. In local development your `localhost:3001` is not reachable by Bolna. Use **ngrok** to expose it:

**Option A — Static domain (free tier, recommended):**

If you have already claimed a static domain at https://dashboard.ngrok.com/domains, use:
```bash
ngrok http --domain=unbowled-draggy-kasey.ngrok-free.dev 3001
```
Then set in `server/.env`:
```env
WEBHOOK_BASE_URL=https://unbowled-draggy-kasey.ngrok-free.dev
```

**Option B — Random domain (changes every restart):**
```bash
ngrok http 3001
```
ngrok will print something like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3001
```
Copy that URL and set it in `server/.env`:
```env
WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
```

> Restart the server after changing `.env`.

---

## Step 3 — Install Dependencies

Open **two terminal windows**.

**Terminal A — Backend**
```bash
cd "Voice Agent Demo/server"
npm install
```

**Terminal B — Frontend**
```bash
cd "Voice Agent Demo/client"
npm install
```

---

## Step 4 — Run in Development Mode

**Terminal A — Start Backend**
```bash
cd "Voice Agent Demo/server"
npm run dev
```

Expected output:
```
13:00:00 [Server] Database initialised
13:00:00 [Queue] Redis connected
13:00:00 [Queue] Workers started { callConcurrency: 5, webhookConcurrency: 10 }
13:00:00 [Server] Started { port: 3001, env: 'development', apiBase: '/api/v1' }
```

**Terminal B — Start Frontend**
```bash
cd "Voice Agent Demo/client"
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

Open your browser at **http://localhost:5173**

---

## Step 5 — Verify Everything is Working

**Health check** — open in browser or run:
```bash
curl http://localhost:3001/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "redis": "connected",
    "bolna": "configured",
    "phone": "+91XXXXXXXXXX"
  },
  "queue": {
    "callWaiting": 0,
    "callActive": 0,
    "webhookWaiting": 0,
    "webhookActive": 0
  }
}
```

If `redis` shows `disconnected`, Redis is not running. Start it first.
If `bolna` shows `not_configured`, your `BOLNA_API_KEY` in `.env` is missing.

---

## Step 6 — Create Your First Campaign

1. Open **http://localhost:5173**
2. Click **Create Campaign**
3. Fill in campaign name and dealer info
4. Upload `sample_contacts.csv` (provided in the project root)
5. Click **Create Campaign**
6. On the next screen, click **Start Campaign**

The system will:
- Check each contact against the DNC list
- Enforce TRAI call window (9 AM–9 PM IST) — if outside hours, jobs are queued to auto-start at 9 AM
- Initiate up to 5 concurrent outbound calls via Bolna AI
- Show live call status updates on the dashboard

---

## CSV Format

Your contact CSV must have these columns:

| Column | Required | Example |
|--------|----------|---------|
| `customer_name` | Yes | Rajesh Sharma |
| `phone_number` | Yes | 9876543210 |
| `vehicle_model` | No | Maruti Swift |
| `vehicle_year` | No | 2022 |
| `vehicle_registration` | No | KA01AB1234 |
| `last_service_date` | No | 2024-06-15 |
| `preferred_language` | No | hinglish / hindi / english |

Phone number formats accepted: `9876543210`, `919876543210`, `+919876543210`

---

## Available API Endpoints

All endpoints are at `http://localhost:3001/api/v1/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server + Redis + queue status |
| GET | `/stats` | Dashboard statistics |
| GET | `/campaigns` | List all campaigns |
| POST | `/campaigns` | Create campaign (multipart with CSV) |
| GET | `/campaigns/:id` | Campaign details + contacts |
| POST | `/campaigns/:id/start` | Start campaign |
| POST | `/campaigns/:id/stop` | Pause campaign |
| GET | `/campaigns/:id/contacts` | All contacts for campaign |
| GET | `/campaigns/:id/export` | Download results as CSV |
| GET | `/calls/:contactId` | Call details + transcript |
| POST | `/calls/:contactId/stop` | Stop active call |
| GET | `/dnc` | List Do Not Call numbers |
| POST | `/dnc` | Add number to DNC |
| DELETE | `/dnc/:phone` | Remove number from DNC |
| POST | `/dnc/bulk` | Bulk add to DNC |
| POST | `/webhooks/bolna` | Bolna AI webhook receiver |

---

## Running with Docker (Production-like)

This runs Redis, the backend, and serves the built frontend — all in Docker.

**Step 1 — Build the frontend**
```bash
cd "Voice Agent Demo/client"
npm run build
```
This creates `client/dist/` which nginx will serve.

**Step 2 — Create a `.env` file at the project root**
```bash
cd "Voice Agent Demo"
cp .env.example .env
# Edit .env and fill in BOLNA_API_KEY, BOLNA_PHONE_NUMBER, WEBHOOK_BASE_URL
```

**Step 3 — Start all services**
```bash
cd "Voice Agent Demo"
docker-compose up --build
```

Services will be available at:
- Frontend: **http://localhost:80**
- Backend API: **http://localhost:3001**
- Redis: `localhost:6379`

**Stop all services**
```bash
docker-compose down
```

**Stop and remove all data (including SQLite DB and Redis data)**
```bash
docker-compose down -v
```

---

## DNC (Do Not Call) Management

Add a number before starting a campaign so it gets automatically skipped:

```bash
# Add single number
curl -X POST http://localhost:3001/api/v1/dnc \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+919876543210", "reason": "Customer requested opt-out"}'

# Bulk add
curl -X POST http://localhost:3001/api/v1/dnc/bulk \
  -H "Content-Type: application/json" \
  -d '[{"phone_number":"+919999999999"},{"phone_number":"+918888888888"}]'

# Check the list
curl http://localhost:3001/api/v1/dnc

# Remove a number
curl -X DELETE "http://localhost:3001/api/v1/dnc/%2B919876543210"
```

---

## Export Campaign Results

After a campaign completes, download results as CSV:

```bash
curl "http://localhost:3001/api/v1/campaigns/CAMPAIGN_ID/export" \
  -o results.csv
```

Or click the **Export** button in the Campaign Monitor page.

The CSV includes: customer name, phone, status, call outcome, appointment date/time, service type, call duration, and notes.

---

## TRAI Compliance

By default, calls are only placed between **9:00 AM – 9:00 PM IST** as required by Indian TRAI regulations.

If you start a campaign outside this window, the jobs are automatically delayed until 9:00 AM the next morning — you don't need to do anything.

To disable during development/testing (not in production):
```env
TRAI_ENFORCE=false
```

---

## Troubleshooting

**Server fails to start — `Error: connect ECONNREFUSED 127.0.0.1:6379`**
Redis is not running. Start it:
```bash
brew services start redis         # macOS
# OR
docker run -d -p 6379:6379 redis:7-alpine  # Docker
```

**Bolna webhook not received — calls complete but dashboard shows no update**
- Your `WEBHOOK_BASE_URL` is not publicly reachable
- Start ngrok: `ngrok http 3001`
- Update `WEBHOOK_BASE_URL` in `.env` with the ngrok URL
- Restart the server

**Campaign starts but all calls fail immediately**
- Check `BOLNA_API_KEY` is correct
- Check `BOLNA_PHONE_NUMBER` is registered in your Bolna account
- Check the health endpoint for service status

**Calls not starting — TRAI window message in logs**
- Current time is outside 9 AM–9 PM IST
- Wait for the window, or set `TRAI_ENFORCE=false` in `.env` for testing

**Contact skipped with `dnc` outcome**
- The phone number is on the Do Not Call list
- Remove it: `DELETE /api/v1/dnc/+91XXXXXXXXXX`

**Frontend shows blank page or API errors**
- Ensure the backend is running on port 3001
- Check browser console for CORS errors
- Ensure both `npm run dev` processes are running

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `BOLNA_API_KEY` | — | **Required** — from Bolna dashboard |
| `BOLNA_BASE_URL` | `https://api.bolna.ai` | Bolna API endpoint |
| `BOLNA_PHONE_NUMBER` | — | **Required** — Indian number in Bolna |
| `WEBHOOK_BASE_URL` | `http://localhost:3001` | **Required in production** — public URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MAX_CONCURRENT_CALLS` | `5` | Concurrent outbound calls |
| `CALL_RETRY_ATTEMPTS` | `2` | Retries per failed contact |
| `CALL_RETRY_DELAY_MS` | `30000` | Delay between retries (ms) |
| `QUEUE_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `TRAI_ENFORCE` | `true` | Enforce 9 AM–9 PM call window |
| `TRAI_CALL_WINDOW_START` | `9` | Call window start hour (IST) |
| `TRAI_CALL_WINDOW_END` | `21` | Call window end hour (IST) |
| `DEFAULT_LANGUAGE` | `hinglish` | `hinglish` / `hindi` / `english` |
| `DEFAULT_DEALER_NAME` | `AutoCare Service Center` | Fallback dealer name |
| `DEFAULT_DEALER_ADDRESS` | `MG Road, Bengaluru` | Fallback dealer address |
| `DEFAULT_DEALER_PHONE` | `+919876543210` | Fallback dealer phone |

---

## Project Structure

```
Voice Agent Demo/
├── server/
│   ├── config/
│   │   └── index.js              ← All config from env vars
│   ├── db/
│   │   └── database.js           ← SQLite schema + query functions
│   ├── middleware/
│   │   ├── correlationId.js      ← X-Correlation-ID header
│   │   └── rateLimiter.js        ← express-rate-limit rules
│   ├── routes/
│   │   ├── agents.js             ← Agent squad definitions
│   │   ├── calls.js              ← Call details + transcripts
│   │   ├── campaigns.js          ← Campaign CRUD + export
│   │   ├── dnc.js                ← Do Not Call management
│   │   └── webhooks.js           ← Bolna webhook receiver
│   ├── services/
│   │   ├── agentSquads.js        ← LLM prompts + voice config
│   │   ├── bolnaService.js       ← Bolna API client + circuit breaker
│   │   ├── callOrchestrator.js   ← Campaign execution engine
│   │   └── queue.js              ← BullMQ + Redis setup
│   ├── utils/
│   │   └── logger.js             ← Winston structured logging
│   ├── data/
│   │   └── voiceagent.db         ← SQLite database (auto-created)
│   ├── uploads/                  ← Temp CSV uploads (auto-cleaned)
│   └── server.js                 ← Express app entry point
│
├── client/
│   └── src/
│       ├── lib/
│       │   ├── api.js            ← All HTTP API calls
│       │   └── socket.js         ← Socket.IO client
│       └── pages/                ← React pages
│
├── .env.example                  ← Environment variable template
├── Dockerfile                    ← Server container
├── docker-compose.yml            ← Full stack (Redis + server + client)
├── nginx.conf                    ← Frontend proxy config
└── sample_contacts.csv           ← Test data (10 contacts)
```
