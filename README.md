# Real-Time Multi-Camera Face Detection Dashboard

A production-ready platform for managing fleets of IP cameras, aggregating RTSP streams, and delivering real-time face detection insights to web clients. The system ingests multiple camera feeds, processes them through a Go-based worker pipeline, broadcasts WebRTC video via MediaMTX, and surfaces actionable alerts through a responsive React dashboard backed by a TypeScript API.

## Project Overview

- **Multi-camera RTSP ingestion** – register and monitor any number of RTSP-compatible cameras.
- **Real-time face detection** – leverage OpenCV + go-face in a dedicated worker for live analytics.
- **Low-latency WebRTC streaming** – MediaMTX relays processed video frames directly to the browser.
- **Alerting via WebSockets** – the backend pushes detection events to authenticated dashboard users.

## Architecture

```mermaid
flowchart LR
    subgraph Cameras
        C1[[RTSP Camera 1]]
        C2[[RTSP Camera 2]]
        CN[[...]]
    end

    Cameras -->|RTSP| Worker
    Worker{{Golang Worker\n(Gin + FFmpeg + OpenCV + go-face)}} -->|Processed Streams| MediaMTX[(MediaMTX)]
    Worker -->|Alerts (HTTP/WebSocket)| Backend{{Hono API + Prisma}}
    Backend -->|Persist Events| DB[(PostgreSQL)]
    MediaMTX -->|WebRTC| Frontend[[React + Vite + MUI/Tailwind Dashboard]]
    Frontend <-->|REST / WebSocket| Backend
```

## Features

- 🔐 **Authentication** – secure login with role-based access for operators and viewers.
- 🎥 **Camera management** – register, edit, enable/disable, and monitor RTSP camera streams.
- 🚨 **Real-time alerts** – receive face detection notifications instantly via WebSockets.
- 📊 **Responsive dashboard** – mobile-friendly UI with live video tiles, alert timelines, and statistics.

## Prerequisites

Ensure the following tooling is installed locally:

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Go](https://go.dev/) 1.20+ (only required if running the worker outside Docker)
- [FFmpeg](https://ffmpeg.org/) binaries (required for native worker builds/testing)

## Getting Started (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/real-time-multi-camera-face-detection-dashboard.git
cd real-time-multi-camera-face-detection-dashboard
```

### 2. Configure environment variables

Three services require configuration. Copy the provided examples and adjust values for your environment.

```bash
cp .env.backend.example .env.backend
cp .env.worker.example .env.worker
cp docker/.env.infra.example docker/.env.infra
```

#### `.env.backend.example`

```dotenv
# Server
NODE_ENV="development"
PORT="4000"
LOG_LEVEL="info"

# Prisma
DATABASE_URL="postgresql://app:app@localhost:5432/facedb?schema=public"
SHADOW_DATABASE_URL="postgresql://app:app@localhost:5432/facedb_shadow?schema=public"

# Auth
JWT_SECRET="super-secret-key"
TOKEN_EXPIRES_IN="1d"

# MediaMTX / WebRTC
MEDIA_MTX_WS_URL="ws://localhost:8889"
MEDIA_MTX_RTSP_URL="rtsp://localhost:8554"

# Alerts
ALERTS_WS_PATH="/alerts"
```

#### `.env.worker.example`

```dotenv
# Worker API
APP_ENV="development"
LOG_LEVEL="info"
API_ADDRESS=":5000"

# Camera discovery
RTSP_SOURCES="rtsp://camera1/stream,rtsp://camera2/stream"

# Backend API
BACKEND_BASE_URL="http://localhost:4000"
ALERTS_ENDPOINT="/api/alerts"
API_KEY="replace-me"

# MediaMTX publishing
MEDIA_MTX_RTSP_PUBLISH_URL="rtsp://localhost:8554"
MEDIA_MTX_STREAM_KEY="dashboard"
```

> 📝 When running inside Docker Compose, swap `localhost` in the examples above for the service names (`postgres`, `backend`, `mediamtx`, etc.).

#### `docker/.env.infra.example`

```dotenv
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=facedb
MEDIA_MTX_HTTP_PORT=8889
MEDIA_MTX_RTSP_PORT=8554
MEDIA_MTX_RTMP_PORT=1935
```

### 3. Build and start the stack

Use Docker Compose to build the containers and boot the full pipeline.

```bash
docker-compose up --build
```

The first run will install dependencies, compile the worker, and start MediaMTX alongside the API and frontend containers.

### 4. Apply database migrations

Once the containers are healthy, run Prisma migrations against the Postgres service.

```bash
docker-compose exec backend npx prisma migrate dev
```

If you need Prisma Client locally (for IDE autocompletion), install dependencies and generate:

```bash
npm install
npx prisma generate
```

## Service Endpoints

| Service            | URL / Port                 | Notes |
| ------------------ | -------------------------- | ----- |
| Frontend (dev)     | http://localhost:5173      | Vite dev server with hot reload |
| Backend API        | http://localhost:4000      | REST + WebSocket endpoints (Hono) |
| Worker API         | http://localhost:5000      | Health checks & metrics for Go worker |
| MediaMTX WebRTC    | ws://localhost:8889        | Signaling channel (RTSP on `rtsp://localhost:8554`) |
| PostgreSQL         | localhost:5432             | Credentials from `.env.infra` |
| Nginx edge proxy†  | http://localhost:8080      | Routes `/` → frontend, `/api` → backend when using Docker |

†Available when running `docker-compose up` with the bundled reverse proxy.

> ℹ️ Adjust hostnames if you run everything inside Docker (`backend`, `mediamtx`, etc.) or deploy to remote hosts.

## Default Login Credentials

A seeded operator account is created for local testing:

- **Email:** `admin@example.com`
- **Password:** `ChangeMe123!`

Update these defaults immediately in production deployments.

## Running Services Individually

Although Docker Compose is recommended, each component can be run separately.

```bash
# Frontend
npm install
npm run dev

# Backend
npm install
npm run backend:dev

# Worker
cd worker
go run ./cmd/worker
```

Ensure `docker/.env.infra` is loaded or that equivalent environment variables are exported before starting services individually.

## Testing

Run automated checks from the repository root:

```bash
# Frontend unit/integration tests
npm test

# Backend service tests
npm run test -- --runTestsByPath src/server/__tests__

# Worker tests
cd worker && go test ./...
```

## Common Issues & Fixes

| Issue | Symptoms | Resolution |
| ----- | -------- | ---------- |
| RTSP stream fails to connect | Worker logs `unable to open input` | Verify camera credentials, latency, and that `RTSP_SOURCES` entries are reachable from the worker container. Test with `ffprobe rtsp://...`. |
| MediaMTX fails to start | Container exits immediately | Ensure ports 8889/8554/1935 are free. Remove stale containers with `docker-compose down -v` before restarting. |
| Prisma migration errors | `P1001` connection errors or schema mismatch | Confirm Postgres is running (`docker-compose ps`). Re-run `docker-compose exec backend npx prisma migrate reset` to rebuild the schema in local environments. |
| WebRTC playback stalls | Blank video in dashboard | Verify the browser trusts self-signed certificates (if using HTTPS). Check that MediaMTX is reachable from the frontend; update CORS/ICE configuration if running across networks. |

## Future Improvements

- Horizontal scaling for worker nodes and camera ingestion pipelines.
- Cloud-native deployment manifests (Kubernetes/Helm) with managed Postgres.
- Advanced face recognition (gallery search, watchlists, re-identification) and configurable alert rules.
- Analytics exports and long-term storage options for compliance.

## License

This project is released under the **TBD** license. Replace this section with the appropriate license before production release.

