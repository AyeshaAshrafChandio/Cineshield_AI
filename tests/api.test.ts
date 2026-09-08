import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { apiRouter, errorHandler } from '../src/api/routes';
import { authMiddleware } from '../src/lib/security/auth';

describe('CineShield Backend API Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(authMiddleware);
    app.use('/api', apiRouter);
    app.use('/api', errorHandler);
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('cineshield-backend');
      expect(typeof res.body.databaseConfigured).toBe('boolean');
    });
  });

  describe('Screenplay Upload & Ingestion Flow', () => {
    let uploadedScriptId: string;
    let uploadedProjectId: string;

    const sampleFountain = `Title: NEON SHADOWS
Author: Chris Vance

EXT. DOWNTOWN ROOFTOP - NIGHT

A neon billboard flickers in the drizzle. DETECTIVE SHAW (40s) stands at the ledge.

SHAW
They knew we were coming.

> CUT TO: <

INT. POLICE CRUISER - CONTINUOUS

Shaw slides into the passenger seat.`;

    it('should reject upload if no file is sent', async () => {
      const res = await request(app).post('/api/scripts/upload');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject unpermitted file format', async () => {
      const res = await request(app)
        .post('/api/scripts/upload')
        .attach('file', Buffer.from('console.log("bad")'), 'script.js');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_FILE');
    });

    it('should successfully upload and parse a valid Fountain screenplay', async () => {
      const res = await request(app)
        .post('/api/scripts/upload')
        .attach('file', Buffer.from(sampleFountain), 'neon_shadows.fountain');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('uploaded');
      expect(res.body.fileType).toBe('fountain');
      expect(res.body.fileName).toBe('neon_shadows.fountain');

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(res.body.scriptId).toMatch(uuidRegex);
      expect(res.body.projectId).toMatch(uuidRegex);
      expect(res.body.scriptId).not.toBe('crypto.randomUUID()');

      uploadedScriptId = res.body.scriptId;
      uploadedProjectId = res.body.projectId;
    });

    it('should serve normalized screenplay data for screenplay viewer', async () => {
      const res = await request(app).get(`/api/scripts/${uploadedScriptId}/screenplay`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.title).toBe('NEON SHADOWS');
      expect(res.body.scenes.length).toBe(2);

      const scene1 = res.body.scenes[0];
      expect(scene1.heading).toBe('EXT. DOWNTOWN ROOFTOP - NIGHT');
      expect(scene1.elements.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent screenplay query', async () => {
      const randomId = crypto.randomUUID();
      const res = await request(app).get(`/api/scripts/${randomId}/screenplay`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SCRIPT_NOT_FOUND');
    });

    it('should return 400 for invalid UUID screenplay parameter', async () => {
      const res = await request(app).get('/api/scripts/invalid-uuid/screenplay');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should retrieve project details for project query', async () => {
      const res = await request(app).get(`/api/projects/${uploadedProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.project.id).toBe(uploadedProjectId);
      expect(res.body.project.title).toBe('NEON SHADOWS');
      expect(res.body.project.script.id).toBe(uploadedScriptId);
    });

    it('should start a real asynchronous analysis run', async () => {
      const res = await request(app)
        .post('/api/analysis/start')
        .send({ scriptId: uploadedScriptId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('queued');
      expect(res.body.analysisId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      const analysisId = res.body.analysisId;

      // Check analysis status endpoint
      const statusRes = await request(app).get(`/api/analysis/${analysisId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect([
        'queued',
        'parsing',
        'extracting_entities',
        'partner_analysis',
        'risk_analysis',
        'generating_recommendations',
        'complete',
        'failed',
      ]).toContain(statusRes.body.status);
      expect(statusRes.body.progress).toBeGreaterThanOrEqual(0);

      // Check findings endpoint
      const findingsRes = await request(app).get(`/api/analysis/${analysisId}/findings`);
      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.success).toBe(true);
      expect(Array.isArray(findingsRes.body.findings)).toBe(true);
      expect(typeof findingsRes.body.total).toBe('number');

      // Check report endpoint
      const reportRes = await request(app).get(`/api/reports/${analysisId}`);
      expect(reportRes.status).toBe(200);
      expect(reportRes.body.success).toBe(true);
      expect(reportRes.body.report.analysisId).toBe(analysisId);
      expect(Array.isArray(reportRes.body.report.findings)).toBe(true);

      // Check evidence endpoint
      const evidenceRes = await request(app).get(`/api/analysis/${analysisId}/evidence`);
      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.success).toBe(true);
      expect(Array.isArray(evidenceRes.body.evidence)).toBe(true);
    });

    it('should reject unauthorized access from different tenant user', async () => {
      // Attempt to access project with another user ID
      const res = await request(app)
        .get(`/api/projects/${uploadedProjectId}`)
        .set('x-user-id', 'intruder-user-id');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return NOT_FOUND if rewrite requested for non-existent finding', async () => {
      const fakeFindingId = crypto.randomUUID();
      const res = await request(app)
        .post(`/api/findings/${fakeFindingId}/rewrite`)
        .send({ prompt: 'Rewrite dialogue to remove trademark mention' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toContain('NOT_FOUND');
    });

    it('should cascade delete project and purge associated data', async () => {
      const res = await request(app).delete(`/api/projects/${uploadedProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify project is now 404
      const getRes = await request(app).get(`/api/projects/${uploadedProjectId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Cloud Run Health Probes', () => {
    it('should pass readiness probe', async () => {
      const res = await request(app).get('/api/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.service).toBe('cineshield-backend');
    });

    it('should return system status without sensitive data', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('cineshield-backend');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body).not.toHaveProperty('databaseUrl');
      expect(res.body).not.toHaveProperty('apiKey');
    });
  });
});
