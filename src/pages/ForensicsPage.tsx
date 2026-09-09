import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { apiFetch } from '../lib/authClient';

interface ForensicsPageProps {
  projectId?: string;
  onNavigate: (page: PageId, projectId?: string) => void;
}

interface RealProject {
  id: string;
  title: string;
  latestAnalysisId: string | null;
  overallRiskScore: number | null;
  findingsCount: number;
}

interface FindingItem {
  id: string;
  analysisId: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sceneId?: string;
  elementId?: string;
  startOffset?: number;
  endOffset?: number;
  suggestedAction?: string;
}

interface EvidenceItem {
  id: string;
  findingId: string;
  snippet: string;
  sceneHeading: string;
  provider: string;
  confidence: number;
}

interface ReportEntity {
  id: string;
  name: string;
  type: string;
  count: number;
}

interface Alternative {
  text: string;
  explanation: string;
  preservedIntent: string;
  changes: string[];
}

export const ForensicsPage: React.FC<ForensicsPageProps> = ({
  projectId,
  onNavigate,
}) => {
  const [allProjects, setAllProjects] = useState<RealProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const [currentProject, setCurrentProject] = useState<RealProject | null>(null);

  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [entities, setEntities] = useState<ReportEntity[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [overallRisk, setOverallRisk] = useState<number>(0);

  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);
  const [creativeAlternatives, setCreativeAlternatives] = useState<Alternative[]>([]);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // Load projects list
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiFetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          const projs: RealProject[] = data.projects || [];
          setAllProjects(projs);
          if (!selectedProjectId && projs.length > 0) {
            // Pick first project with an analysis or first project
            const withAnalysis = projs.find((p) => p.latestAnalysisId) || projs[0];
            setSelectedProjectId(withAnalysis.id);
          }
        }
      } catch (err) {
        console.warn('Failed to load projects in Forensics:', err);
      }
    };
    fetchProjects();
  }, [projectId]);

  // Load report / findings for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }

    const proj = allProjects.find((p) => p.id === selectedProjectId) || null;
    setCurrentProject(proj);

    const loadForensicsData = async () => {
      setLoading(true);
      try {
        if (proj?.latestAnalysisId) {
          const repRes = await apiFetch(`/api/reports/${proj.latestAnalysisId}`);
          if (repRes.ok) {
            const repData = await repRes.json();
            const rep = repData.report;
            if (rep) {
              setFindings(rep.findings || []);
              setEntities(rep.entities || []);
              setEvidenceList(rep.evidence || []);
              setOverallRisk(rep.overallRiskScore ?? 0);
              if (rep.findings && rep.findings.length > 0) {
                setSelectedFinding(rep.findings[0]);
              } else {
                setSelectedFinding(null);
              }
            }
          }
        } else {
          // If no latestAnalysisId yet, check if project has an analysis
          const projRes = await apiFetch(`/api/projects/${selectedProjectId}`);
          if (projRes.ok) {
            const pData = await projRes.json();
            if (pData.project?.latestAnalysisId) {
              const repRes = await apiFetch(`/api/reports/${pData.project.latestAnalysisId}`);
              if (repRes.ok) {
                const repData = await repRes.json();
                const rep = repData.report;
                setFindings(rep.findings || []);
                setEntities(rep.entities || []);
                setEvidenceList(rep.evidence || []);
                setOverallRisk(rep.overallRiskScore ?? 0);
                if (rep.findings?.length) setSelectedFinding(rep.findings[0]);
              }
            } else {
              setFindings([]);
              setEntities([]);
              setEvidenceList([]);
              setSelectedFinding(null);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading forensics data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadForensicsData();
  }, [selectedProjectId, allProjects]);

  const handleRunCreativeRewrite = async () => {
    if (!selectedFinding) return;
    setIsGeneratingRewrite(true);
    setRewriteError(null);
    setCreativeAlternatives([]);
    try {
      const res = await apiFetch(`/api/findings/${selectedFinding.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: `Generate creative legal-safe alternatives for: ${selectedFinding.title}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreativeAlternatives(data.alternatives || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setRewriteError(err.error?.message || 'Failed to generate alternatives');
      }
    } catch (e) {
      setRewriteError('Network error connecting to Gemini Creative Rewrite Agent.');
    } finally {
      setIsGeneratingRewrite(false);
    }
  };

  const handleExportLog = () => {
    if (!currentProject) return;
    const logData = {
      project: currentProject.title,
      projectId: currentProject.id,
      analysisId: currentProject.latestAnalysisId,
      exportedAt: new Date().toISOString(),
      overallRiskScore: overallRisk,
      scannedEntities: entities,
      findings,
      evidence: evidenceList,
      pipelineStatus: 'VERIFIED_AUDIT_TRAIL',
    };
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cineshield_forensic_audit_${currentProject.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Metrics
  const criticalCount = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  const reviewCount = findings.filter((f) => f.severity === 'medium').length;
  const clearedCount = findings.filter((f) => f.severity === 'low').length;

  return (
    <main className="md:ml-60 ml-0 mt-16 p-4 md:p-gutter flex-1 overflow-y-auto h-[calc(100vh-64px)] bg-[#0A0A0A]">
      {/* Top Header */}
      <header className="mb-gutter flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Project:{' '}
              <span className="text-primary">
                {currentProject ? currentProject.title : 'Forensic Workspace'}
              </span>
            </h1>

            {/* Project Switcher Dropdown */}
            {allProjects.length > 1 && (
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Select Active Slate for Forensic Analysis"
                className="bg-[#121212] border border-outline-variant text-on-surface text-xs font-body-md px-2.5 py-1.5 focus:border-primary focus:outline-none"
              >
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 text-sm">
            Forensic Deep-Dive Analysis — Gemini Multi-Agent Clearance &amp; Evidence Audit
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleExportLog}
            disabled={!currentProject}
            className="bg-transparent border border-outline text-on-surface px-4 py-2 font-label-caps text-label-caps hover:bg-[#1E1E1E] transition-colors rounded-none flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Export Forensic Log
          </button>
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="bg-[#121212] border border-outline-variant p-12 text-center my-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="font-label-caps text-xs text-on-surface-variant uppercase tracking-widest">
            Compiling forensic entities and evidence from multi-agent pipeline...
          </p>
        </div>
      )}

      {/* Empty State if no project or no analysis */}
      {!loading && (!currentProject || !currentProject.latestAnalysisId) && (
        <div className="bg-[#121212] border border-outline-variant p-16 text-center max-w-2xl mx-auto my-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary"></div>
          <span className="material-symbols-outlined text-5xl text-primary/50 mb-4">
            biometric_setup
          </span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 uppercase tracking-wide">
            NO FORENSIC DATA AVAILABLE
          </h2>
          <p className="font-body-md text-xs text-on-surface-variant mb-6 max-w-md mx-auto leading-relaxed">
            There are no completed forensic scans for this project yet. Ingest a screenplay or start analysis from the Active Slates dashboard.
          </p>
          <button
            onClick={() => onNavigate('projects')}
            className="bg-primary text-on-primary font-label-caps text-xs px-6 py-3 hover:bg-primary-container transition-colors cursor-pointer font-bold inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">folder_open</span>
            GO TO ACTIVE SLATES
          </button>
        </div>
      )}

      {/* Main Content when project has analysis */}
      {!loading && currentProject && currentProject.latestAnalysisId && (
        <div className="space-y-gutter">
          {/* Top 3 Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Metric 1 */}
            <div className="bg-[#121212] border border-[#2A2A2A] p-6 relative">
              <div
                className={`absolute top-0 left-0 w-full h-[2px] ${
                  criticalCount > 0 ? 'bg-error' : 'bg-primary'
                }`}
              ></div>
              <div className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-wider text-[11px]">
                Critical Risks Identified
              </div>
              <div
                className={`font-headline-lg text-display-lg ${
                  criticalCount > 0 ? 'text-error' : 'text-on-surface'
                }`}
              >
                {criticalCount}
              </div>
              <p className="font-body-md text-on-surface-variant mt-2 text-xs">
                {criticalCount > 0
                  ? 'Urgent copyright or trademark exposure requiring legal action.'
                  : 'Zero high-severity clearance violations flagged.'}
              </p>
            </div>

            {/* Metric 2 */}
            <div className="bg-[#121212] border border-[#2A2A2A] p-6 relative">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-primary"></div>
              <div className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-wider text-[11px]">
                Overall Risk Index
              </div>
              <div className="font-headline-lg text-display-lg text-primary">
                {overallRisk}
                <span className="text-sm font-normal text-on-surface-variant/70">/100</span>
              </div>
              <p className="font-body-md text-on-surface-variant mt-2 text-xs">
                {overallRisk >= 70
                  ? 'Critical risk tier: Immediate clearance review mandatory.'
                  : overallRisk >= 35
                  ? 'Moderate risk tier: Production counsel review suggested.'
                  : 'Low risk tier: Standard clearance protocol satisfied.'}
              </p>
            </div>

            {/* Metric 3 */}
            <div className="bg-[#121212] border border-[#2A2A2A] p-6 relative">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-primary"></div>
              <div className="font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase tracking-wider text-[11px]">
                Entities Scanned
              </div>
              <div className="font-headline-lg text-display-lg text-on-surface">
                {entities.length || findings.length}
              </div>
              <p className="font-body-md text-on-surface-variant mt-2 text-xs">
                Extracted characters, brands, and organizational IP assets.
              </p>
            </div>
          </div>

          {/* 2-Column Split: Detected Entities List & Selected Entity Deep-Dive */}
          <div className="grid grid-cols-12 gap-gutter">
            {/* Left Col: Detected Entities & Findings Table */}
            <div className="col-span-12 lg:col-span-7 bg-[#121212] border border-[#2A2A2A] flex flex-col">
              <div className="p-4 border-b border-[#2A2A2A] flex justify-between items-center bg-surface-container">
                <h2 className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider text-xs">
                  Detected IP Findings &amp; Entities ({findings.length})
                </h2>
                <div className="flex gap-2">
                  <span className="font-label-caps text-[10px] px-2 py-0.5 bg-error/20 text-error border border-error">
                    {criticalCount} HIGH
                  </span>
                  <span className="font-label-caps text-[10px] px-2 py-0.5 bg-primary-container/20 text-primary-container border border-primary-container">
                    {reviewCount} REVIEW
                  </span>
                  <span className="font-label-caps text-[10px] px-2 py-0.5 bg-surface-variant text-on-surface-variant border border-outline-variant">
                    {clearedCount} LOW
                  </span>
                </div>
              </div>

              {findings.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant font-body-md text-xs">
                  No IP findings detected in this screenplay analysis.
                </div>
              ) : (
                <div className="divide-y divide-[#2A2A2A] overflow-y-auto max-h-[600px]">
                  {findings.map((f) => {
                    const isSelected = selectedFinding?.id === f.id;
                    const isHigh = f.severity === 'critical' || f.severity === 'high';
                    const isMed = f.severity === 'medium';

                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          setSelectedFinding(f);
                          setCreativeAlternatives([]);
                          setRewriteError(null);
                        }}
                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-surface-container-high border-l-4 border-primary'
                            : 'hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined text-lg ${
                              isHigh ? 'text-error' : isMed ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            {isHigh ? 'warning' : isMed ? 'gavel' : 'check_circle'}
                          </span>
                          <div>
                            <div className="font-body-md text-sm font-bold text-on-surface">
                              {f.title}
                            </div>
                            <div className="font-label-caps text-[10px] text-on-surface-variant mt-0.5">
                              CATEGORY: {f.category}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-label-caps text-[10px] px-2 py-0.5 border ${
                              isHigh
                                ? 'bg-error/20 text-error border-error'
                                : isMed
                                ? 'bg-primary-container/20 text-primary-container border-primary-container'
                                : 'bg-surface-container text-on-surface-variant border-[#2A2A2A]'
                            }`}
                          >
                            {f.severity.toUpperCase()}
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Col: Deep-Dive Forensic & Creative Alternatives */}
            <div className="col-span-12 lg:col-span-5 bg-[#121212] border border-[#2A2A2A] p-6 flex flex-col justify-between">
              {selectedFinding ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-caps text-[10px] text-primary tracking-widest uppercase">
                        Forensic Entity Deep-Dive
                      </span>
                      <span
                        className={`font-label-caps text-[10px] px-2 py-0.5 border ${
                          selectedFinding.severity === 'critical' || selectedFinding.severity === 'high'
                            ? 'bg-error/20 text-error border-error'
                            : selectedFinding.severity === 'medium'
                            ? 'bg-primary-container/20 text-primary-container border-primary-container'
                            : 'bg-surface-container text-on-surface-variant border-[#2A2A2A]'
                        }`}
                      >
                        {selectedFinding.severity.toUpperCase()} SEVERITY
                      </span>
                    </div>
                    <h3 className="font-headline-md text-xl text-on-surface">
                      {selectedFinding.title}
                    </h3>
                  </div>

                  {/* Finding Legal Description */}
                  <div className="bg-surface-container p-4 border border-outline-variant/40 space-y-2">
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider block">
                      Legal Risk Analysis &amp; Precedent Assessment
                    </span>
                    <p className="font-body-md text-xs text-on-surface leading-relaxed">
                      {selectedFinding.description}
                    </p>
                  </div>

                  {/* Suggested Legal Action */}
                  {selectedFinding.suggestedAction && (
                    <div className="bg-surface-container p-4 border border-primary/30 space-y-2">
                      <span className="font-label-caps text-[10px] text-primary uppercase tracking-wider block flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">recommend</span>
                        Recommended Action
                      </span>
                      <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                        {selectedFinding.suggestedAction}
                      </p>
                    </div>
                  )}

                  {/* Evidence & Registry Audit */}
                  {evidenceList.length > 0 && (
                    <div className="border-t border-[#2A2A2A] pt-4">
                      <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider block mb-2">
                        External Registry &amp; Evidence Audit
                      </span>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {evidenceList.map((ev, i) => (
                          <div
                            key={i}
                            className="bg-surface-container-low p-2.5 border border-[#2A2A2A] font-body-md text-[11px] text-on-surface-variant"
                          >
                            <div className="flex justify-between items-center mb-1 text-[10px] text-primary font-label-caps">
                              <span>{ev.provider}</span>
                              <span>CONFIDENCE: {ev.confidence}%</span>
                            </div>
                            <p>{ev.snippet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Creative Rewrite Section (Powered by Gemini 3.6 Flash) */}
                  <div className="border-t border-[#2A2A2A] pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-label-caps text-[10px] text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                        Gemini Creative Alternatives
                      </span>
                      <button
                        onClick={handleRunCreativeRewrite}
                        disabled={isGeneratingRewrite}
                        className="bg-primary text-on-primary font-label-caps text-[10px] px-3 py-1.5 hover:bg-primary-container transition-colors cursor-pointer font-bold disabled:opacity-50"
                      >
                        {isGeneratingRewrite ? 'GENERATING...' : 'GENERATE REWRITE'}
                      </button>
                    </div>

                    {rewriteError && (
                      <div className="p-2.5 bg-error/10 border border-error text-error text-[11px] font-body-md">
                        {rewriteError}
                      </div>
                    )}

                    {creativeAlternatives.length > 0 && (
                      <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                        {creativeAlternatives.map((alt, i) => (
                          <div
                            key={i}
                            className="bg-surface-container p-3 border border-primary/30 space-y-1 font-body-md text-xs"
                          >
                            <div className="text-on-surface font-bold">&ldquo;{alt.text}&rdquo;</div>
                            <div className="text-[11px] text-on-surface-variant leading-relaxed">
                              {alt.explanation}
                            </div>
                            <div className="text-[10px] text-primary font-label-caps mt-1">
                              Preserved Intent: {alt.preservedIntent}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-on-surface-variant font-body-md text-xs">
                  Select an entity from the list to view forensic details and generate AI legal alternatives.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
