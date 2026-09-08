# CineShield AI

> Automated Intellectual Property Pre-Screening & Legal Clearance Intelligence for Entertainment Productions.

---

## Architecture & Multi-Agent Pipeline

CineShield AI processes full-length screenplays (in Fountain, PDF, and plaintext formats) through a deterministic, privacy-first multi-agent workflow:

1. **Script Parser Agent (Deterministic)**: Ingests screenplay files, parses scene headers, character dialogue, parentheticals, transitions, and action blocks into normalized structural AST data with exact character offsets.
2. **IP Entity Detection Agent (Gemini 3.8 Flash)**: Extracts commercial brands, distinctive fictional characters, products, organizations, copyrighted elements, and real-world persons with narrative context.
3. **IBM Partner Evidence Layer (IBM watsonx.ai)**: Queries IBM Cloud IAM and IBM watsonx.ai Foundation Models (`ibm/granite-13b-chat-v2`) to verify corporate ownership, trademark classes, and registered rights. Accurately reports unconfigured status when credentials are not supplied without fabricating false registry entries.
4. **Gemini Risk Analysis Agent (Gemini 3.8 Flash)**: Synthesizes screenplay context and partner evidence through legal pre-screening safety guardrails. Operates under the strict rule that **No Evidence ≠ No Risk**.
5. **Deterministic Scoring Rubric**: Aggregates entity severities, occurrence counts, and confidence scores into calibrated project clearance metrics (LOW 0–34, MEDIUM 35–64, HIGH 65–100).
6. **Creative Rewrite Agent (Gemini 3.8 Flash)**: Generates 3 clearance-safe dialogue/action alternatives that preserve dramatic intent, narrative beat timing, and character voice.

---

## IBM Track Integration

### IBM Bob Development Usage

IBM Bob served as an interactive AI development partner and coding assistant throughout the engineering lifecycle of CineShield AI for this hackathon track. Specifically, Bob was utilized for:

- **Architecture & Decoupling Strategy**: Assisted in architecting the `PartnerEvidenceProvider` abstraction layer (`src/lib/partners/ibm/`), ensuring the core screening pipeline remains vendor-neutral and independent of proprietary SDK lock-in.
- **Zod Schema Engineering**: Aided in designing and refining strict TypeScript/Zod schemas for IAM token responses, IBM watsonx REST generation requests, and normalized partner evidence payloads.
- **IAM Authentication & Token Lifecycle**: Guided the implementation of the IBM Cloud IAM token exchange (`https://iam.cloud.ibm.com/identity/token`) with token expiration caching, 60-second safety buffers, and error classifications.
- **Reliability & Error Handling**: Assisted with implementing exponential backoff retries, `AbortController` request timeouts, and structured exception classes (`IbmAuthError`, `IbmApiError`, `IbmTimeoutError`, `IbmConfigError`).
- **Legal Clearance Guardrails**: Collaborated on designing the prompt engineering constraints for the Risk Analysis Agent, codifying the core heuristic: **Absence of external partner evidence does NOT imply absence of IP risk**.

*Note: In accordance with hackathon standards, IBM Bob is documented strictly as a developer coding assistant used during the engineering process. No fake "IBM Bob API" or simulated runtime endpoint exists in this repository.*

---

### IBM Runtime Integration

CineShield AI implements a genuine, production-grade runtime integration with **IBM watsonx.ai Foundation Models** via the official IBM Cloud IAM Identity Services and watsonx Machine Learning REST APIs.

#### Implemented Services & Endpoints
- **IAM Token Exchange**: `POST https://iam.cloud.ibm.com/identity/token`
  - Exchanges `IBM_CLOUD_API_KEY` for a temporary IAM Bearer access token using standard OAuth grant type `urn:ibm:params:oauth:grant-type:apikey`.
- **IBM watsonx.ai Text Generation**: `POST {IBM_WATSONX_SERVICE_URL}/ml/v1/text/generation?version=2023-05-29`
  - Targets provisioned Foundation Models (default: `ibm/granite-13b-chat-v2`).
  - Scoped to the user's watsonx `project_id`.

#### Data Minimization & Privacy
- CineShield AI **never** sends the full screenplay to external partner APIs.
- Only the specific detected entity name, classified type, and a truncated 150-character excerpt are passed to IBM watsonx for corporate brand and trademark verification.

#### Truthful Evidence & Unconfigured Behavior
- If `IBM_CLOUD_API_KEY` or `IBM_WATSONX_PROJECT_ID` is not configured:
  - The adapter returns `isAvailable: false`, `matches: []`, and an explicit note: *"IBM watsonx partner credentials are not configured. External registry verification was not queried, and no external trademark or copyright data was fabricated."*
  - The analysis pipeline continues smoothly without crashing.
  - The downstream Risk Analysis Agent receives notice that partner evidence was unavailable and evaluates inherent risk based on screenplay context.
- **Zero Fabrication**: The system never invents fake trademark registration numbers, fake corporate owners, fake URLs, or synthetic database hits.

---

### Judge Verification

Judges can verify both the development usage and runtime implementation using the steps below:

#### 1. Verify Partner Architecture
Inspect the clean adapter structure in `src/lib/partners/ibm/`:
- `config.ts`: Environment configuration and validation.
- `types.ts`: TypeScript contracts for IAM, watsonx, and normalized evidence.
- `client.ts`: Real IAM token exchange, HTTP requests, timeout handling, retries, and structured errors.
- `adapter.ts`: Implements `PartnerEvidenceProvider`, executes entity verification, and normalizes evidence.
- `src/lib/agents/evidenceService.ts`: Decoupled intermediary connecting the agent pipeline to the partner provider.

#### 2. Verify Automated Tests
Run the comprehensive test suite:
```bash
npm run test
```
The test suite validates:
- IBM adapter configuration parsing.
- Truthful unconfigured behavior (no fabricated data).
- IAM token caching and expiration calculations.
- Request timeout handling (`IbmTimeoutError`).
- Authentication failure handling (`IbmAuthError` on 401/403).
- API error handling (`IbmApiError`).
- Strict schema validation and JSON extraction.
- The **No Evidence ≠ No Risk** principle across agent boundaries.
- Live integration test execution (dynamically runs if live IBM credentials are configured in `.env`, or skips gracefully with clear explanation).

#### 3. Optional Live Testing with IBM Credentials
To test with real IBM Cloud credentials:
1. Copy `.env.example` to `.env` (or configure secrets in AI Studio).
2. Set:
   ```env
   IBM_CLOUD_API_KEY="your-ibm-cloud-api-key"
   IBM_WATSONX_PROJECT_ID="your-watsonx-project-id"
   IBM_WATSONX_SERVICE_URL="https://us-south.ml.cloud.ibm.com"
   ```
3. Execute `npm run test` or trigger an analysis run via the backend API.

---

## Environment Variables

| Variable | Description | Default / Source |
|---|---|---|
| `GEMINI_API_KEY` | Required for Gemini 3.8 Flash multi-agent intelligence | Google AI Studio Secrets |
| `IBM_CLOUD_API_KEY` | IBM Cloud API Key for IAM Token authentication | IBM Cloud Console (IAM) |
| `IBM_WATSONX_PROJECT_ID` | IBM watsonx Project GUID | watsonx Project Settings |
| `IBM_WATSONX_SERVICE_URL` | Base URL for IBM watsonx ML service | `https://us-south.ml.cloud.ibm.com` |
| `IBM_WATSONX_MODEL_ID` | IBM watsonx Foundation Model identifier | `ibm/granite-13b-chat-v2` |
| `IBM_REQUEST_TIMEOUT_MS` | Request timeout in milliseconds | `8000` |
| `IBM_MAX_RETRIES` | Max retries for transient errors | `2` |
| `DATABASE_URL` | PostgreSQL connection string | Local or Cloud SQL instance |
