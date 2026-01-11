## Run everything with Docker (recommended)

This repo contains:
- `Drive/frontend` (Next.js)
- `Drive/backend` (Quarkus + Postgres + MinIO)
- `mdb-service` (Quarkus + MongoDB document store)
- `docs-service` (Quarkus docs API / collaboration)

### 1) Create a `.env` file (same folder as `docker-compose.yml`)

Minimum needed:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

If you run on a remote VM and access it via public IP (no SSH port-forwarding), also set:
```
# example
NEXT_PUBLIC_API_BASE_URL=http://<PUBLIC_IP>:8080
CORS_ORIGINS=http://<PUBLIC_IP>:3000
```

### 2) Build & start

```
docker compose up -d --build
```

Open:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/health
- MinIO console: http://localhost:9001

### 3) Stop

```
docker compose down
```

## Oracle Cloud VM notes

On the VM, install Docker + Compose plugin, clone the repo, create `.env`, then run:

```
docker compose up -d --build
```

Make sure your OCI Security List/NSG allows inbound TCP ports:
- 3000 (frontend)
- 8080 (backend)
- 9001 (optional, MinIO console)

Alternatively, use SSH port-forwarding and keep `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`.