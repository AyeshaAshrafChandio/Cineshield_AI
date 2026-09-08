# CineShield AI — Google Cloud Production Deployment Guide

This comprehensive guide outlines the end-to-end architecture, provisioning, security hardening, and deployment procedures for **CineShield AI** on **Google Cloud Platform (GCP)**.

---

## 1. System Architecture Overview

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                   Google Cloud Platform                 │
                          │                                                         │
   [Web Browser / Client] │  ┌───────────────────────────────────────────────────┐  │
              │           │  │            Cloud Run Service (Node 20)            │  │
              ▼           │  │                                                   │  │
    HTTPS / TLS Term ────┼─►│  • Express HTTP REST API                          │  │
                          │  │  • React SPA Frontend Distribution                │  │
                          │  │  • Multi-Agent Clearance Pipeline                 │  │
                          │  │  • Structured Cloud Logging (JSON)                │  │
                          │  └────────┬──────────────┬──────────────┬────────────┘  │
                          │           │              │              │               │
                          │           ▼              ▼              ▼               │
                          │    ┌─────────────┐┌─────────────┐┌─────────────┐        │
                          │    │  Cloud SQL  ││ Cloud Storage││ Cloud Tasks │        │
                          │    │ (Postgres15)││  (Private)  ││   Queue     │        │
                          │    └─────────────┘└─────────────┘└─────────────┘        │
                          │           ▲              ▲              ▲               │
                          │           │              │              │               │
                          │    ┌──────┴──────────────┴──────────────┴──────┐        │
                          │    │          Secret Manager Ingestion         │        │
                          │    │  (DATABASE_URL, GEMINI_API_KEY, etc.)     │        │
                          │    └───────────────────────────────────────────┘        │
                          └───────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │    Google Gemini AI SDK     │
                                       │   (gemini-2.5-flash via     │
                                       │      @google/genai)         │
                                       └─────────────────────────────┘
```

### Core Architecture Components
1. **Google Cloud Run**: Fully managed serverless container running Node 20 LTS. Handles HTTP requests, Server-Sent Events (SSE) streaming, and SPA static hosting. Automatically scales from 0 to N instances based on concurrent traffic.
2. **Cloud SQL for PostgreSQL (v15+)**: ACID-compliant source of truth for projects, scripts, analysis runs, detected entities, risk findings, evidence records, creative rewrites, and generated reports. Connection pooling with max 20 connections per container instance.
3. **Google Cloud Storage (GCS)**: Secure private bucket with uniform bucket-level access for storing normalized screenplay structures and temporary processing files with short-lived V4 signed URLs.
4. **Google Cloud Tasks**: Managed task queue (`cineshield-analysis-queue`) for resilient, asynchronous multi-agent background execution with automatic retries and exponential backoff.
5. **Google Secret Manager**: Zero-trust credential isolation. Injects production secrets directly into Cloud Run container memory at runtime without exposing them to source control or container images.
6. **Google Gemini 2.5 Flash**: Orchestrated multi-agent pipeline using the `@google/genai` TypeScript SDK for structural parsing, entity extraction, risk scoring, and creative rewrites.
7. **IBM watsonx Partner Track**: Optional enterprise trademark verification via watsonx foundation models.
8. **Cloud Logging & Monitoring**: Structured JSON logs conforming to Google Cloud Logging specification (`severity`, `httpRequest`, `timestamp`, `traceContext`, `userId`, `analysisId`).

---

## 2. Prerequisites & Initial GCP Setup

### 2.1 Tooling & Authentication
Ensure you have the latest `gcloud` CLI installed and authenticated:
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### 2.2 Enable Required Google Cloud APIs
Enable the necessary API services:
```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Step-by-Step Infrastructure Provisioning

### 3.1 Service Account & Least-Privilege IAM Setup
Create a dedicated runtime service account for the CineShield Cloud Run service:
```bash
gcloud iam service-accounts create cineshield-runner \
  --display-name="CineShield AI Production Runtime Service Account"

RUNNER_SA="cineshield-runner@${YOUR_GCP_PROJECT_ID}.iam.gserviceaccount.com"
```

Assign least-privilege IAM roles:
```bash
# Allow Cloud SQL connectivity
gcloud projects add-iam-policy-binding ${YOUR_GCP_PROJECT_ID} \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/cloudsql.client"

# Allow Cloud Tasks enqueuing
gcloud projects add-iam-policy-binding ${YOUR_GCP_PROJECT_ID} \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/cloudtasks.enqueuer"

# Allow Invoker role for internal Cloud Task dispatch
gcloud projects add-iam-policy-binding ${YOUR_GCP_PROJECT_ID} \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/run.invoker"
```

### 3.2 Cloud SQL (PostgreSQL 15+) Provisioning
Provision the managed PostgreSQL database instance:
```bash
gcloud sql instances create cineshield-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --availability-type=REGIONAL
```

Create the application database and user:
```bash
# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 24)

# Create database
gcloud sql databases create cineshield --instance=cineshield-db

# Create production database user
gcloud sql users create cineshield_app \
  --instance=cineshield-db \
  --password="${DB_PASSWORD}"
```

### 3.3 Google Cloud Storage (Private Bucket) Provisioning
Create a private bucket for storing screenplay assets with Uniform Bucket-Level Access:
```bash
BUCKET_NAME="cineshield-screenplays-${YOUR_GCP_PROJECT_ID}"

gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --location=us-central1 \
  --uniform-bucket-level-access

# Configure 30-day lifecycle deletion rule for transient files
cat << 'EOF' > /tmp/gcs-lifecycle.json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }
  ]
}
EOF
gcloud storage buckets update "gs://${BUCKET_NAME}" --lifecycle-file=/tmp/gcs-lifecycle.json
rm /tmp/gcs-lifecycle.json

# Grant Storage Object Admin role to the runtime service account
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/storage.objectAdmin"
```

### 3.4 Google Cloud Tasks Queue Setup
Create the background worker queue:
```bash
gcloud tasks queues create cineshield-analysis-queue \
  --location=us-central1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=5 \
  --max-attempts=3 \
  --min-backoff=5s \
  --max-backoff=60s
```

### 3.5 Google Secret Manager Configuration
Store sensitive credentials in Secret Manager:
```bash
# 1. Cloud SQL Connection String
DB_CONN_STR="postgresql://cineshield_app:${DB_PASSWORD}@/cineshield?host=/cloudsql/${YOUR_GCP_PROJECT_ID}:us-central1:cineshield-db"
echo -n "${DB_CONN_STR}" | gcloud secrets create cineshield-database-url --data-file=-

# 2. Gemini API Key
echo -n "YOUR_PRODUCTION_GEMINI_API_KEY" | gcloud secrets create cineshield-gemini-api-key --data-file=-

# 3. Internal Task Secret
TASK_SECRET=$(openssl rand -hex 32)
echo -n "${TASK_SECRET}" | gcloud secrets create cineshield-task-secret --data-file=-

# 4. (Optional) IBM Cloud API Key
echo -n "YOUR_IBM_CLOUD_API_KEY" | gcloud secrets create cineshield-ibm-api-key --data-file=-
```

Grant Secret Accessor role to the runtime service account:
```bash
gcloud secrets add-iam-policy-binding cineshield-database-url \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cineshield-gemini-api-key \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cineshield-task-secret \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cineshield-ibm-api-key \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Artifact Registry & Container Build

Create a Docker repository in Google Artifact Registry:
```bash
gcloud artifacts repositories create cineshield-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="CineShield AI container repository"
```

Build and push the multi-stage Docker image via Cloud Build:
```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION="us-central1",_SERVICE_NAME="cineshield-ai",_ARTIFACT_REPO="cineshield-repo"
```

---

## 5. Google Cloud Run Deployment

Deploy the container service to Google Cloud Run:
```bash
gcloud run deploy cineshield-ai \
  --image="us-central1-docker.pkg.dev/${YOUR_GCP_PROJECT_ID}/cineshield-repo/cineshield-ai:latest" \
  --region=us-central1 \
  --platform=managed \
  --service-account="${RUNNER_SA}" \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=2 \
  --memory=2Gi \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --add-cloudsql-instances="${YOUR_GCP_PROJECT_ID}:us-central1:cineshield-db" \
  --set-secrets="DATABASE_URL=cineshield-database-url:latest,GEMINI_API_KEY=cineshield-gemini-api-key:latest,INTERNAL_TASK_SECRET=cineshield-task-secret:latest" \
  --set-env-vars="NODE_ENV=production,GEMINI_MODEL=gemini-2.5-flash,GCS_BUCKET_NAME=cineshield-screenplays-${YOUR_GCP_PROJECT_ID},CLOUD_TASKS_QUEUE=cineshield-analysis-queue,CLOUD_TASKS_LOCATION=us-central1,SERVICE_URL=https://cineshield-ai-xyz-uc.a.run.app,CLOUD_RUN_SERVICE_ACCOUNT=${RUNNER_SA}"
```

---

## 6. Environment Variables Reference

| Variable | Description | Source | Default / Example |
|---|---|---|---|
| `NODE_ENV` | Application environment mode | Cloud Run Env Var | `production` |
| `PORT` | Container listen port | Cloud Run Env Var | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Secret Manager | `postgresql://cineshield_app:...@/cineshield?host=/cloudsql/...` |
| `GEMINI_API_KEY` | Gemini API Key for multi-agent clearance | Secret Manager | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model alias | Cloud Run Env Var | `gemini-2.5-flash` |
| `GCS_BUCKET_NAME` | Private bucket for screenplay persistence | Cloud Run Env Var | `cineshield-screenplays-xyz` |
| `CLOUD_TASKS_QUEUE` | Google Cloud Tasks queue name | Cloud Run Env Var | `cineshield-analysis-queue` |
| `CLOUD_TASKS_LOCATION`| Google Cloud Tasks location | Cloud Run Env Var | `us-central1` |
| `SERVICE_URL` | Deployed Cloud Run HTTPS URL | Cloud Run Env Var | `https://cineshield-ai-xyz.run.app` |
| `INTERNAL_TASK_SECRET` | Secret token verifying internal Cloud Tasks | Secret Manager | Random 32-byte hex |
| `IBM_CLOUD_API_KEY` | Optional IBM Cloud API key for watsonx | Secret Manager | Optional |
| `IBM_WATSONX_PROJECT_ID` | Optional IBM watsonx project identifier | Cloud Run Env Var | Optional |

---

## 7. Database Migrations Guide

CineShield AI includes an automated, atomic, reproducible migration runner:
- **Automatic Execution on Startup**: When `server.ts` boots in production with `DATABASE_URL` configured, `runMigrations()` checks the `drizzle/` directory against the `__cineshield_migrations` table inside an atomic SQL transaction (`BEGIN ... COMMIT`).
- **Reproducibility**: SQL files (`0000_initial.sql`, `0001_production_hardening.sql`) use idempotent statements (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON DELETE CASCADE`).
- **Zero-Downtime Safe**: All foreign keys and indexes are created safely without locking existing active read queries.
- **Manual Migration Verification**:
  ```bash
  npm run db:migrate
  ```

---

## 8. Verification, Health Checks & Smoke Testing

### 8.1 Liveness Probe (`GET /api/health`)
Checks container responsiveness without exposing internal configuration details:
```bash
curl -i https://YOUR_SERVICE_URL/api/health
```
**Expected Response (HTTP 200)**:
```json
{
  "status": "ok",
  "service": "cineshield-backend",
  "databaseConfigured": true,
  "geminiConfigured": true,
  "timestamp": "2026-09-08T08:00:00.000Z"
}
```

### 8.2 Readiness Probe (`GET /api/ready`)
Verifies critical production dependencies (PostgreSQL database and Gemini API key):
```bash
curl -i https://YOUR_SERVICE_URL/api/ready
```
**Expected Response (HTTP 200)**:
```json
{
  "status": "ready",
  "service": "cineshield-backend",
  "checks": {
    "database": "healthy",
    "gemini": "configured"
  },
  "timestamp": "2026-09-08T08:00:00.000Z"
}
```

### 8.3 System Status (`GET /api/status`)
Provides safe operational telemetry:
```bash
curl -i https://YOUR_SERVICE_URL/api/status
```

### 8.4 Full Pipeline Smoke Test
Verify screenplay ingestion and asynchronous analysis:
```bash
# 1. Upload sample screenplay
UPLOAD_RES=$(curl -s -X POST https://YOUR_SERVICE_URL/api/scripts/upload \
  -F "file=@test_screenplay.txt")
SCRIPT_ID=$(echo $UPLOAD_RES | jq -r '.scriptId')

# 2. Start asynchronous multi-agent analysis
ANALYSIS_RES=$(curl -s -X POST https://YOUR_SERVICE_URL/api/analysis/start \
  -H "Content-Type: application/json" \
  -d "{\"scriptId\":\"${SCRIPT_ID}\"}")
ANALYSIS_ID=$(echo $ANALYSIS_RES | jq -r '.analysisId')

# 3. Stream real-time agent execution progress via SSE
curl -N https://YOUR_SERVICE_URL/api/analysis/${ANALYSIS_ID}/stream

# 4. Fetch final clearance assessment report
curl -s https://YOUR_SERVICE_URL/api/analysis/${ANALYSIS_ID}/report | jq .
```

---

## 9. Security & Observability Architecture

1. **Non-Root Execution**: Container executes strictly as unprivileged `USER node` (UID 1000).
2. **Prompt-Injection Defenses**: Screenplay texts are treated strictly as untrusted data demarcated by XML boundary tags (`<screenplay_data_untrusted>`, `<untrusted_screenplay_text>`) with explicit system instruction override immunizations.
3. **Structured Cloud Logging**: Logs emitted in single-line JSON with automatic secret pattern redaction (tokens, keys, authorization headers, passwords).
4. **Data Retention & Cascade Deletion**: Complete cascade deletion support across projects, scripts, analysis runs, findings, entities, and GCS storage objects via `/api/projects/:id` and `/api/scripts/:id`.
