# CineShield AI — Google Cloud Production Deployment Guide

This guide details the steps to deploy CineShield AI to **Google Cloud Run** with a managed **Cloud SQL PostgreSQL** database and **Google Secret Manager** for zero-trust credential handling.

---

## 1. Architecture Overview

- **Compute**: Google Cloud Run (Fully managed, containerized microservice running Node 20 LTS, scales from 0 to 10 instances).
- **Database**: Cloud SQL for PostgreSQL (version 15+), using connection pooling with max 20 connections per container instance and SSL.
- **AI Engine**: Google Gemini API (`@google/genai` SDK using `gemini-2.5-flash`) for multi-agent risk clearance, entity extraction, and creative alternatives.
- **Partner Integration**: IBM watsonx Granite-13b runtime evidence verification and Bob development environment tracking.
- **Secrets Management**: Google Cloud Secret Manager for `DATABASE_URL` and `GEMINI_API_KEY`.
- **Observability**: Cloud Logging with Google structured JSON payloads (`severity`, `component`, `traceId`, `durationMs`).

---

## 2. Prerequisites & GCP Setup

Ensure the Google Cloud CLI (`gcloud`) is installed and authenticated:

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

Enable required Google Cloud APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Database Setup (Cloud SQL PostgreSQL)

### 3.1 Provision Instance
```bash
gcloud sql instances create cineshield-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase
```

### 3.2 Create Database and User
```bash
gcloud sql databases create cineshield --instance=cineshield-db
gcloud sql users create cineshield_user --instance=cineshield-db --password=STRONG_PASSWORD
```

### 3.3 Connection String
In Cloud Run with Cloud SQL connector:
```
postgresql://cineshield_user:STRONG_PASSWORD@/cineshield?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:cineshield-db
```

---

## 4. Secret Manager Configuration

Create the production secrets:

```bash
# Store PostgreSQL connection string
echo -n "postgresql://cineshield_user:STRONG_PASSWORD@/cineshield?host=/cloudsql/YOUR_GCP_PROJECT_ID:us-central1:cineshield-db" | \
  gcloud secrets create cineshield-database-url --data-file=-

# Store Gemini API Key
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | \
  gcloud secrets create cineshield-gemini-api-key --data-file=-

# Optional: IBM Watsonx API Key (if enabled)
echo -n "YOUR_IBM_API_KEY" | \
  gcloud secrets create cineshield-ibm-api-key --data-file=-
```

Grant Cloud Run's default service account permission to access the secrets:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_GCP_PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding cineshield-database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cineshield-gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 5. Artifact Registry & Container Build

Create a Docker repository in Artifact Registry:

```bash
gcloud artifacts repositories create cineshield-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="CineShield AI container repository"
```

Build and push the container image:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

---

## 6. Manual Deploy to Cloud Run

If deploying directly via `gcloud run deploy`:

```bash
gcloud run deploy cineshield-ai \
  --image=us-central1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/cineshield-repo/cineshield-ai:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=2 \
  --memory=2Gi \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --add-cloudsql-instances=YOUR_GCP_PROJECT_ID:us-central1:cineshield-db \
  --set-secrets="DATABASE_URL=cineshield-database-url:latest,GEMINI_API_KEY=cineshield-gemini-api-key:latest" \
  --set-env-vars="NODE_ENV=production,GEMINI_MODEL=gemini-2.5-flash"
```

---

## 7. Automated Database Migrations

CineShield AI runs database migrations automatically on server startup via `runMigrations()` in `server.ts`.

To verify database tables manually:
```bash
npm run db:push
```

---

## 8. Verification & Health Probes

1. **Liveness Probe**:
   ```bash
   curl -i https://YOUR_SERVICE_URL/api/health
   # Expected: HTTP 200 {"status":"ok","service":"cineshield-backend","databaseConfigured":true,...}
   ```

2. **Readiness Probe**:
   ```bash
   curl -i https://YOUR_SERVICE_URL/api/ready
   # Expected: HTTP 200 {"status":"ready","service":"cineshield-backend",...}
   ```

3. **Status Probe**:
   ```bash
   curl -i https://YOUR_SERVICE_URL/api/status
   # Returns uptime, node version, and memory usage without exposing secrets.
   ```

4. **Screenplay Ingestion & Analysis**:
   ```bash
   curl -X POST https://YOUR_SERVICE_URL/api/scripts/upload \
     -F "file=@test_script.txt"
   ```
