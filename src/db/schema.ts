import { pgTable, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Projects table
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('projects_user_id_idx').on(table.userId)]
);

// 3. Scripts table
export const scripts = pgTable(
  'scripts',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(), // 'pdf' | 'txt' | 'fountain'
    fileSize: integer('file_size').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('uploaded'),
    metadata: jsonb('metadata'), // total scenes, characters, duration
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('scripts_project_id_idx').on(table.projectId)]
);

// 4. Analysis Runs table
export const analysisRuns = pgTable(
  'analysis_runs',
  {
    id: text('id').primaryKey(),
    scriptId: text('script_id')
      .notNull()
      .references(() => scripts.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('queued'),
    progress: integer('progress').default(0).notNull(),
    stageMessage: text('stage_message'),
    errorMessage: text('error_message'),
    overallRiskScore: integer('overall_risk_score'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('analysis_runs_script_id_idx').on(table.scriptId),
    index('analysis_runs_project_id_idx').on(table.projectId),
    index('analysis_runs_status_idx').on(table.status),
  ]
);

// 5. Entities table
export const entities = pgTable(
  'entities',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'PERSON' | 'LOCATION' | 'ORGANIZATION' | 'BRAND'
    count: integer('count').default(1).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('entities_analysis_id_idx').on(table.analysisId),
    index('entities_name_idx').on(table.name),
  ]
);

// 6. Risk Findings table
export const riskFindings = pgTable(
  'risk_findings',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // 'IP_TRADEMARK' | 'DEFAMATION' | 'PARTNER_COMPLIANCE' | 'CULTURAL_SENSITIVITY'
    severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'critical'
    title: text('title').notNull(),
    description: text('description').notNull(),
    sceneId: text('scene_id'),
    elementId: text('element_id'),
    startOffset: integer('start_offset'),
    endOffset: integer('end_offset'),
    suggestedAction: text('suggested_action'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('risk_findings_analysis_id_idx').on(table.analysisId),
    index('risk_findings_category_idx').on(table.category),
    index('risk_findings_severity_idx').on(table.severity),
  ]
);

// 7. Rewrites table
export const rewrites = pgTable(
  'rewrites',
  {
    id: text('id').primaryKey(),
    findingId: text('finding_id')
      .notNull()
      .references(() => riskFindings.id, { onDelete: 'cascade' }),
    originalText: text('original_text').notNull(),
    suggestedText: text('suggested_text').notNull(),
    rationale: text('rationale').notNull(),
    status: text('status').default('pending').notNull(), // 'pending' | 'accepted' | 'rejected'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('rewrites_finding_id_idx').on(table.findingId)]
);

// 8. Evidence table (Partner and Narrative IP verification findings)
export const evidence = pgTable(
  'evidence',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    findingId: text('finding_id').references(() => riskFindings.id, { onDelete: 'cascade' }),
    entityId: text('entity_id'),
    provider: text('provider').notNull(), // 'ibm_watsonx' | 'cineshield_engine'
    evidenceType: text('evidence_type').notNull(), // 'TRADEMARK_CLEARANCE' | 'NARRATIVE_CONTEXT'
    source: text('source'),
    content: text('content').notNull(),
    confidence: integer('confidence'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('evidence_analysis_id_idx').on(table.analysisId),
    index('evidence_finding_id_idx').on(table.findingId),
  ]
);

// 9. Reports table (Compliance & Risk Assessment reports)
export const reports = pgTable(
  'reports',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    overallRiskScore: integer('overall_risk_score'),
    summary: text('summary'),
    status: text('status').default('generated').notNull(), // 'generated' | 'exported'
    reportData: jsonb('report_data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_analysis_id_idx').on(table.analysisId),
    index('reports_project_id_idx').on(table.projectId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  scripts: many(scripts),
  analysisRuns: many(analysisRuns),
  reports: many(reports),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  project: one(projects, {
    fields: [scripts.projectId],
    references: [projects.id],
  }),
  analysisRuns: many(analysisRuns),
}));

export const analysisRunsRelations = relations(analysisRuns, ({ one, many }) => ({
  script: one(scripts, {
    fields: [analysisRuns.scriptId],
    references: [scripts.id],
  }),
  project: one(projects, {
    fields: [analysisRuns.projectId],
    references: [projects.id],
  }),
  entities: many(entities),
  findings: many(riskFindings),
  evidence: many(evidence),
  reports: many(reports),
}));

export const riskFindingsRelations = relations(riskFindings, ({ one, many }) => ({
  analysis: one(analysisRuns, {
    fields: [riskFindings.analysisId],
    references: [analysisRuns.id],
  }),
  rewrites: many(rewrites),
  evidence: many(evidence),
}));

export const rewritesRelations = relations(rewrites, ({ one }) => ({
  finding: one(riskFindings, {
    fields: [rewrites.findingId],
    references: [riskFindings.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  analysis: one(analysisRuns, {
    fields: [evidence.analysisId],
    references: [analysisRuns.id],
  }),
  finding: one(riskFindings, {
    fields: [evidence.findingId],
    references: [riskFindings.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  analysis: one(analysisRuns, {
    fields: [reports.analysisId],
    references: [analysisRuns.id],
  }),
  project: one(projects, {
    fields: [reports.projectId],
    references: [projects.id],
  }),
}));
