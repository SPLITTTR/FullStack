new: setup:

kind create cluster --name splitttr
docker build -t splitttr/drive-backend:local ./Drive/backend
docker build -t splitttr/mdb-service:local ./mdb-service
docker build -t splitttr/docs-service:local ./docs-service

docker build -t splitttr/drive-frontend:local --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=publishable_key ./Drive/frontend

kind load docker-image splitttr/drive-backend:local --name splitttr
kind load docker-image splitttr/mdb-service:local --name splitttr
kind load docker-image splitttr/docs-service:local --name splitttr
kind load docker-image splitttr/drive-frontend:local --name splitttr

kubectl apply -f k8s/00-namespace.yaml
kubectl apply -n splitttr -f k8s/10-postgres.yaml
kubectl apply -n splitttr -f k8s/11-mongo.yaml
kubectl apply -n splitttr -f k8s/12-minio.yaml
kubectl apply -n splitttr -f k8s/13-minio-init-job.yaml
kubectl apply -n splitttr -f k8s/20-configmap.yaml

kubectl create secret generic app-secrets -n splitttr --from-literal=CLERK_SECRET_KEY=secret_key --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -n splitttr -f k8s/30-mdb-service.yaml
kubectl apply -n splitttr -f k8s/31-docs-service.yaml
kubectl apply -n splitttr -f k8s/40-drive-backend.yaml
kubectl apply -n splitttr -f k8s/41-drive-frontend.yaml

in run z:
na enm cmd-ju:
kubectl port-forward -n splitttr svc/drive-backend 8080:8080

in na drugem:
kubectl port-forward -n splitttr svc/drive-frontend 3000:3000

in na tretjem:
kubectl port-forward -n splitttr svc/docs-service 8082:8082

restart:
docker build -t splitttr/docs-service:local ./docs-service
kind load docker-image splitttr/docs-service:local --name splitttr
kubectl rollout restart -n splitttr deploy/docs-service
kubectl rollout status  -n splitttr deploy/docs-service


old
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