import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { apiFetch } from '../lib/authClient';

interface SceneViewerPageProps {
  projectId?: string;
  onNavigate: (page: PageId, projectId?: string) => void;
}

interface FindingItem {
  id: string;
  analysisId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sceneId?: string;
  elementId?: string;
  startOffset?: number;
  endOffset?: number;
  suggestedAction?: string;
}

interface ScreenplayElement {
  id: string;
  type: 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber?: number;
  metadata?: Record<string, any>;
}

interface ScreenplayScene {
  id: string;
  sceneNumber: number;
  heading: string;
  location?: string;
  timeOfDay?: string;
  elements: ScreenplayElement[];
}

interface RealProject {
  id: string;
  title: string;
  script?: {
    id: string;
    fileName: string;
    fileType: string;
    title: string;
    uploadedAt: string;
  };
  analysisStatus: 'queued' | 'extracting_entities' | 'risk_analysis' | 'complete' | 'failed' | null;
  latestAnalysisId: string | null;
  overallRiskScore: number | null;
  findingsCount: number;
}

interface ComplianceReport {
  reportId: string;
  projectId: string;
  analysisId: string;
  analysisTimestamp: string;
  overallRiskScore: number;
  findings: FindingItem[];
  evidence: any[];
  recommendedActions: string[];
  disclaimer: string;
}

export const SceneViewerPage: React.FC<SceneViewerPageProps> = ({
  projectId,
  onNavigate,
}) => {
  const [allProjects, setAllProjects] = useState<RealProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const [project, setProject] = useState<RealProject | null>(null);

  const [scenes, setScenes] = useState<ScreenplayScene[]>([]);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeReport, setActiveReport] = useState<ComplianceReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Creative rewrites state
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);

  // 1. Fetch projects list if not loaded
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiFetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          const projs: RealProject[] = data.projects || [];
          setAllProjects(projs);
          if (!selectedProjectId && projs.length > 0) {
            setSelectedProjectId(projs[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch projects list:', err);
      }
    };
    fetchProjects();
  }, [projectId]);

  // 2. Fetch screenplay and findings when selectedProjectId changes
  const loadProjectData = async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch project info
      const projRes = await apiFetch(`/api/projects/${selectedProjectId}`);
      let currentProj: RealProject | null = null;
      if (projRes.ok) {
        const projData = await projRes.json();
        currentProj = projData.project;
        setProject(currentProj);
      }

      // Fetch screenplay structured scenes
      const scriptRes = await apiFetch(`/api/projects/${selectedProjectId}/screenplay`);
      if (scriptRes.ok) {
        const scriptData = await scriptRes.json();
        setScenes(scriptData.scenes || []);
      } else {
        setScenes([]);
      }

      // Fetch real findings if analysis exists
      if (currentProj?.latestAnalysisId) {
        const fRes = await apiFetch(`/api/analysis/${currentProj.latestAnalysisId}/findings`);
        if (fRes.ok) {
          const fData = await fRes.json();
          const loadedFindings = fData.findings || [];
          setFindings(loadedFindings);
          if (loadedFindings.length > 0) {
            setSelectedFinding(loadedFindings[0]);
          } else {
            setSelectedFinding(null);
          }
        } else {
          setFindings([]);
          setSelectedFinding(null);
        }
      } else {
        setFindings([]);
        setSelectedFinding(null);
      }
    } catch (err) {
      console.warn('Error fetching scene viewer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [selectedProjectId]);

  const isScanning =
    project?.analysisStatus === 'queued' ||
    project?.analysisStatus === 'extracting_entities' ||
    project?.analysisStatus === 'risk_analysis';

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      loadProjectData();
    }, 2500);
    return () => clearInterval(interval);
  }, [isScanning, selectedProjectId]);

  // Handler to trigger clearance analysis on demand
  const handleTriggerAnalysis = async () => {
    if (!project?.script?.id) return;
    try {
      setIsStartingAnalysis(true);
      const res = await apiFetch('/api/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: project.script.id,
          projectId: project.id,
          priority: 'high',
        }),
      });
      if (res.ok) {
        await loadProjectData();
      }
    } catch (err) {
      console.warn('Error triggering analysis:', err);
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  // 3. Generate or view compliance report
  const handleOpenComplianceReport = async () => {
    if (!project?.latestAnalysisId) return;
    setReportLoading(true);
    setShowReportModal(true);
    try {
      const res = await apiFetch(`/api/reports/${project.latestAnalysisId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveReport(data.report || null);
      }
    } catch (err) {
      console.warn('Failed to load compliance report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // 4. Request real creative rewrite
  const handleGenerateRewrite = async (finding: FindingItem) => {
    setIsGeneratingRewrite(true);
    setRewriteError(null);
    setAlternatives([]);
    try {
      const res = await apiFetch(`/api/findings/${finding.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: `Provide creative legal-safe alternatives for: ${finding.title}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlternatives(data.alternatives || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setRewriteError(err.error?.message || 'Could not generate creative alternatives.');
      }
    } catch (err) {
      setRewriteError('Failed to connect to Gemini Creative Rewrite agent.');
    } finally {
      setIsGeneratingRewrite(false);
    }
  };

  // Metric counts
  const flaggedCharacters = findings.filter(
    (f) => f.category.toLowerCase().includes('copyright') || f.category.toLowerCase().includes('character')
  ).length;
  const trademarkWarnings = findings.filter(
    (f) => f.category.toLowerCase().includes('trademark') || f.category.toLowerCase().includes('brand')
  ).length;

  return (
    <div className="flex flex-col xl:flex-row pt-16 min-h-screen bg-[#0A0A0A]">
      {/* Main Screenplay Column (Left/Center) */}
      <main className="md:ml-60 ml-0 flex-1 p-4 md:p-margin-desktop overflow-y-auto min-h-[calc(100vh-64px)] relative">
        <div className="max-w-3xl mx-auto pb-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#2A2A2A] pb-4 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  {project ? project.title : 'Screenplay Workspace'}
                </h1>
                {allProjects.length > 1 && (
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    aria-label="Select Project for Screenplay Viewer"
                    className="bg-[#121212] border border-outline-variant text-on-surface text-xs font-body-md px-2 py-1 focus:border-primary focus:outline-none"
                  >
                    {allProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <span className="font-body-md text-xs text-on-surface-variant block mt-1">
                {project?.script?.fileName || 'Screenplay Script Viewer'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 font-label-caps text-label-caps no-radius flex items-center gap-1.5 ${
                  isScanning
                    ? 'bg-[#F4B400] text-black animate-pulse'
                    : project?.analysisStatus === 'complete'
                    ? 'bg-surface-container-high border border-[#2A2A2A] text-primary'
                    : 'bg-surface-container-high border border-[#2A2A2A] text-on-surface-variant'
                }`}
              >
                {isScanning && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                )}
                {isScanning
                  ? 'SCANNING'
                  : project?.analysisStatus === 'complete'
                  ? 'ANALYZED'
                  : 'READY'}
              </span>
              <span className="bg-surface-container-high border border-[#2A2A2A] text-on-surface-variant px-2 py-1 font-label-caps text-label-caps">
                {project?.script?.fileType ? project.script.fileType.toUpperCase() : 'FOUNTAIN'}
              </span>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
              <p className="font-label-caps text-xs text-on-surface-variant tracking-widest">
                Ingesting screenplay elements and risk coordinates...
              </p>
            </div>
          )}

          {/* Empty state if no scenes */}
          {!loading && scenes.length === 0 && (
            <div className="bg-[#121212] border border-[#2A2A2A] p-12 text-center my-8">
              <span className="material-symbols-outlined text-4xl text-primary mb-3">
                description
              </span>
              <h3 className="font-headline-md text-lg text-on-surface mb-2 uppercase">
                No Screenplay Data Available
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant max-w-md mx-auto mb-6">
                Ingest a script file (.fountain, .pdf, .txt) in the Active Slates tab to populate the director screenplay viewer.
              </p>
              <button
                onClick={() => onNavigate('projects')}
                className="bg-primary text-on-primary font-label-caps text-xs px-4 py-2 hover:bg-primary-container font-bold"
              >
                GO TO ACTIVE SLATES
              </button>
            </div>
          )}

          {/* Real Screenplay Content */}
          {!loading && scenes.length > 0 && (
            <div className="font-body-lg text-body-lg text-on-surface-variant space-y-6">
              {scenes.map((scene) => (
                <div key={scene.id} className="space-y-4">
                  {/* Scene Heading */}
                  <div className="border-t border-[#2A2A2A] pt-4 mt-6">
                    <p className="text-center font-bold text-on-surface tracking-wider">
                      {scene.heading}
                    </p>
                  </div>

                  {/* Scene Elements */}
                  {scene.elements.map((el) => {
                    // Check if this element or text overlaps with any finding
                    const matchedFinding = findings.find((f) => {
                      if (f.elementId && f.elementId === el.id) return true;
                      const rawEntity = f.title.split(' - ')[0].trim().toLowerCase();
                      if (rawEntity && rawEntity.length >= 3 && el.text.toLowerCase().includes(rawEntity)) {
                        return true;
                      }
                      return false;
                    });

                    const isHighRisk =
                      matchedFinding &&
                      (matchedFinding.severity === 'critical' || matchedFinding.severity === 'high');
                    const isMedRisk = matchedFinding && matchedFinding.severity === 'medium';
                    const isSelected = selectedFinding?.id === matchedFinding?.id;
                    const entityKey = matchedFinding ? matchedFinding.title.split(' - ')[0].trim().toLowerCase() : undefined;

                    if (el.type === 'scene_heading') {
                      return null; // already rendered above
                    }

                    if (el.type === 'action') {
                      return (
                        <p
                          id={`screenplay-el-${el.id}`}
                          data-finding-id={matchedFinding?.id}
                          data-entity={entityKey}
                          key={el.id}
                          className={`text-left text-sm leading-relaxed transition-all ${
                            matchedFinding
                              ? isHighRisk
                                ? 'highlight-red p-2 border-l-2 border-error'
                                : 'highlight-yellow p-2 border-l-2 border-primary'
                              : 'text-on-surface-variant'
                          } ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                          onClick={() => matchedFinding && setSelectedFinding(matchedFinding)}
                        >
                          {el.text}
                        </p>
                      );
                    }

                    if (el.type === 'character') {
                      return (
                        <div
                          id={`screenplay-el-${el.id}`}
                          data-finding-id={matchedFinding?.id}
                          data-entity={entityKey}
                          key={el.id}
                          className={`mt-4 text-center ${
                            matchedFinding ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => matchedFinding && setSelectedFinding(matchedFinding)}
                        >
                          <span
                            className={`font-bold tracking-wider text-sm px-2 py-0.5 inline-block transition-all ${
                              matchedFinding
                                ? isHighRisk
                                  ? 'bg-error/30 text-error border-b-2 border-error'
                                  : 'bg-primary-container/30 text-primary border-b-2 border-primary'
                                : 'text-on-surface'
                            } ${isSelected ? 'ring-2 ring-primary bg-primary/20' : ''}`}
                          >
                            {el.text}
                          </span>
                        </div>
                      );
                    }

                    if (el.type === 'parenthetical') {
                      return (
                        <p id={`screenplay-el-${el.id}`} key={el.id} className="text-center text-xs italic text-outline">
                          {el.text}
                        </p>
                      );
                    }

                    if (el.type === 'dialogue') {
                      return (
                        <div
                          id={`screenplay-el-${el.id}`}
                          data-finding-id={matchedFinding?.id}
                          data-entity={entityKey}
                          key={el.id}
                          className={`max-w-md mx-auto text-center text-sm mb-4 leading-relaxed transition-all ${
                            matchedFinding
                              ? `${isHighRisk ? 'highlight-red border-l-2 border-error' : 'highlight-yellow border-l-2 border-primary'} p-2 cursor-pointer`
                              : ''
                          } ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                          onClick={() => matchedFinding && setSelectedFinding(matchedFinding)}
                        >
                          <p className="text-on-surface">{el.text}</p>
                          {matchedFinding && (
                            <div className="mt-1 flex items-center justify-center gap-1 font-label-caps text-[9px] uppercase">
                              <span
                                className={isHighRisk ? 'text-error font-bold' : 'text-primary font-bold'}
                              >
                                ⚠ {matchedFinding.title}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <p id={`screenplay-el-${el.id}`} key={el.id} className="text-xs text-on-surface-variant">
                        {el.text}
                      </p>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Right Column: Legal Risk Breakdown (Stitch Aside Panel) */}
      <aside className="w-full xl:w-[360px] md:ml-60 xl:ml-0 bg-[#121212] border-t xl:border-t-0 xl:border-l border-[#2A2A2A] flex flex-col p-4 md:p-6 gap-6 overflow-y-auto shrink-0">
        <h2 className="font-headline-md text-headline-md text-on-surface border-b border-[#2A2A2A] pb-2">
          Legal Risk Analysis
        </h2>

        {/* Risk Score Card */}
        <div className="bg-surface-container border border-[#2A2A2A] p-4 relative border-t-2 border-t-[#F4B400]">
          <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">
            OVERALL RISK SCORE
          </p>
          <div className="flex items-end gap-2">
            <span
              className={`font-display-lg text-display-lg ${
                (project?.overallRiskScore ?? 0) >= 70
                  ? 'text-error'
                  : (project?.overallRiskScore ?? 0) >= 35
                  ? 'text-primary'
                  : 'text-on-surface'
              }`}
            >
              {isScanning ? '--' : project?.overallRiskScore ?? 0}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant mb-2">/100</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container border border-[#2A2A2A] p-4 border-t-2 border-t-[#FF3E3E]">
            <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">
              FLAGGED CHARACTERS
            </p>
            <span className="font-headline-lg text-headline-lg text-[#FF3E3E]">
              {flaggedCharacters}
            </span>
          </div>
          <div className="bg-surface-container border border-[#2A2A2A] p-4 border-t-2 border-t-[#F4B400]">
            <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">
              TRADEMARK WARNINGS
            </p>
            <span className="font-headline-lg text-headline-lg text-primary">
              {trademarkWarnings}
            </span>
          </div>
        </div>

        {/* Critical Findings List */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <p className="font-label-caps text-label-caps text-on-surface-variant">
              CRITICAL FINDINGS ({findings.length})
            </p>
          </div>

          {findings.length === 0 ? (
            <div className="p-4 bg-surface-container text-xs text-on-surface-variant text-center font-body-md">
              {project?.script ? (
                <div className="space-y-2">
                  <p>No active legal findings for this screenplay.</p>
                  <button
                    onClick={handleTriggerAnalysis}
                    disabled={isStartingAnalysis}
                    className="w-full py-1.5 px-3 bg-primary text-black font-label-caps text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50"
                  >
                    {isStartingAnalysis ? 'SCANNING SCRIPT...' : 'RUN CLEARANCE PIPELINE'}
                  </button>
                </div>
              ) : (
                <p>No screenplay ingested yet.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {findings.map((f) => {
                const isSelected = selectedFinding?.id === f.id;
                const isCritical = f.severity === 'critical' || f.severity === 'high';

                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      setSelectedFinding(f);
                      setAlternatives([]);
                      setRewriteError(null);

                      // Smoothly scroll to the corresponding line in the screenplay
                      const rawEntity = f.title.split(' - ')[0].trim().toLowerCase();
                      const targetEl =
                        (f.elementId ? document.getElementById(`screenplay-el-${f.elementId}`) : null) ||
                        document.querySelector(`[data-finding-id="${f.id}"]`) ||
                        (rawEntity ? document.querySelector(`[data-entity*="${rawEntity}"]`) : null);

                      if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className={`flex justify-between items-center p-2.5 border border-[#2A2A2A] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-surface-container-high border-primary text-primary'
                        : 'bg-surface-container hover:bg-[#1E1E1E] text-on-surface'
                    }`}
                  >
                    <span className="font-body-md text-xs truncate max-w-[190px]">
                      {f.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 font-label-caps text-[9px] ${
                        isCritical
                          ? 'bg-[#FF3E3E] text-white'
                          : 'bg-[#F4B400] text-black'
                      }`}
                    >
                      {f.severity.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Finding Detail & Action */}
          {selectedFinding && (
            <div className="mt-4 p-3 bg-surface-container border border-outline-variant/40 space-y-2">
              <span className="font-label-caps text-[10px] text-primary uppercase block">
                Targeted Legal Analysis
              </span>
              <p className="font-body-md text-xs text-on-surface leading-relaxed">
                {selectedFinding.description}
              </p>
              {selectedFinding.suggestedAction && (
                <div className="pt-2 border-t border-[#2A2A2A] text-[11px] font-body-md text-on-surface-variant">
                  <strong className="text-primary">Action:</strong> {selectedFinding.suggestedAction}
                </div>
              )}
              <button
                onClick={() => handleGenerateRewrite(selectedFinding)}
                disabled={isGeneratingRewrite}
                className="w-full mt-2 bg-transparent border border-primary text-primary hover:bg-primary hover:text-black transition-colors font-label-caps text-[10px] py-2 cursor-pointer font-bold disabled:opacity-50"
              >
                {isGeneratingRewrite ? 'GENERATING ALTERNATIVES...' : 'GET GEMINI REWRITES'}
              </button>

              {rewriteError && (
                <p className="text-xs text-error font-body-md mt-1">{rewriteError}</p>
              )}

              {alternatives.length > 0 && (
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                  {alternatives.map((alt, i) => (
                    <div
                      key={i}
                      className="p-2 bg-surface-container-high border border-primary/30 text-xs font-body-md"
                    >
                      <div className="font-bold text-on-surface">&ldquo;{alt.text}&rdquo;</div>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        {alt.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate Compliance Report CTA Button */}
        <button
          onClick={handleOpenComplianceReport}
          disabled={!project?.latestAnalysisId}
          className="w-full bg-primary-container text-on-primary-container font-label-caps text-label-caps py-4 mt-auto hover:bg-primary transition-colors border border-transparent cursor-pointer font-bold disabled:opacity-50"
        >
          GENERATE COMPLIANCE REPORT
        </button>
      </aside>

      {/* Compliance Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#121212] border border-[#2A2A2A] max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[#2A2A2A]">
              <div>
                <h3 className="font-headline-md text-lg text-on-surface">
                  CineShield AI Compliance Audit
                </h3>
                <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                  Project: {project?.title} • ID #{project?.id.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg px-2"
              >
                ✕
              </button>
            </div>

            {reportLoading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="font-label-caps text-xs text-on-surface-variant uppercase">
                  Compiling legal clearance certificate...
                </p>
              </div>
            ) : activeReport ? (
              <div className="mt-4 space-y-4 font-body-md text-xs">
                <div className="flex justify-between items-center p-3 bg-surface-container border border-outline-variant/30">
                  <span className="font-label-caps text-on-surface-variant">OVERALL RISK INDEX</span>
                  <span className="font-display-lg text-xl text-primary font-bold">
                    {activeReport.overallRiskScore} / 100
                  </span>
                </div>

                <div>
                  <h4 className="font-label-caps text-on-surface mb-2 uppercase">
                    Findings &amp; Mitigations ({activeReport.findings?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {activeReport.findings?.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 bg-surface-container border border-[#2A2A2A] space-y-1"
                      >
                        <div className="flex justify-between font-bold text-on-surface">
                          <span>{f.title}</span>
                          <span className="font-label-caps text-[10px] text-primary uppercase">
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-on-surface-variant text-[11px]">{f.description}</p>
                        {f.suggestedAction && (
                          <p className="text-[10px] text-primary font-label-caps">
                            Recommended: {f.suggestedAction}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {activeReport.recommendedActions?.length > 0 && (
                  <div>
                    <h4 className="font-label-caps text-on-surface mb-2 uppercase">
                      Action Items for Production Counsel
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
                      {activeReport.recommendedActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-surface-container-low border border-[#2A2A2A] text-[10px] text-on-surface-variant/70 italic">
                  {activeReport.disclaimer}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(activeReport, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `compliance_report_${project?.id.slice(0, 8)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-primary text-on-primary font-label-caps text-xs px-4 py-2 hover:bg-primary-container font-bold"
                  >
                    DOWNLOAD AUDIT JSON
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="border border-outline-variant text-on-surface font-label-caps text-xs px-4 py-2 hover:bg-[#1E1E1E]"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-on-surface-variant">
                Could not load report details.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
