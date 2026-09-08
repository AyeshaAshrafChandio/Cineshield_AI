-- Migration: 0001_production_hardening
-- Adds evidence and reports tables, cascading constraints, and performance indexes

CREATE TABLE IF NOT EXISTS "evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
  "finding_id" text REFERENCES "risk_findings"("id") ON DELETE CASCADE,
  "entity_id" text,
  "provider" text NOT NULL,
  "evidence_type" text NOT NULL,
  "source" text,
  "content" text NOT NULL,
  "confidence" integer,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reports" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "overall_risk_score" integer,
  "summary" text,
  "status" text DEFAULT 'generated' NOT NULL,
  "report_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Production indexes
CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects"("user_id");
CREATE INDEX IF NOT EXISTS "scripts_project_id_idx" ON "scripts"("project_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_script_id_idx" ON "analysis_runs"("script_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_project_id_idx" ON "analysis_runs"("project_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_status_idx" ON "analysis_runs"("status");
CREATE INDEX IF NOT EXISTS "entities_analysis_id_idx" ON "entities"("analysis_id");
CREATE INDEX IF NOT EXISTS "entities_name_idx" ON "entities"("name");
CREATE INDEX IF NOT EXISTS "risk_findings_analysis_id_idx" ON "risk_findings"("analysis_id");
CREATE INDEX IF NOT EXISTS "risk_findings_category_idx" ON "risk_findings"("category");
CREATE INDEX IF NOT EXISTS "risk_findings_severity_idx" ON "risk_findings"("severity");
CREATE INDEX IF NOT EXISTS "rewrites_finding_id_idx" ON "rewrites"("finding_id");
CREATE INDEX IF NOT EXISTS "evidence_analysis_id_idx" ON "evidence"("analysis_id");
CREATE INDEX IF NOT EXISTS "evidence_finding_id_idx" ON "evidence"("finding_id");
CREATE INDEX IF NOT EXISTS "reports_analysis_id_idx" ON "reports"("analysis_id");
CREATE INDEX IF NOT EXISTS "reports_project_id_idx" ON "reports"("project_id");
