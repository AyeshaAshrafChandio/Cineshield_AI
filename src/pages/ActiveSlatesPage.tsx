import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { apiFetch } from '../lib/authClient';

interface Project {
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
  createdAt: string;
  updatedAt: string;
}

interface ActiveSlatesPageProps {
  onNavigate: (page: PageId, projectId?: string) => void;
  onOpenNewProject: () => void;
}

export const ActiveSlatesPage: React.FC<ActiveSlatesPageProps> = ({
  onNavigate,
  onOpenNewProject,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'IN_PROD' | 'POST_PROD' | 'DEV'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.warn('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredProjects = projects.filter((proj) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = proj.title.toLowerCase().includes(q);
      const matchFile = proj.script?.fileName.toLowerCase().includes(q);
      if (!matchTitle && !matchFile) return false;
    }

    if (activeFilter === 'IN_PROD') {
      return (
        proj.analysisStatus === 'queued' ||
        proj.analysisStatus === 'extracting_entities' ||
        proj.analysisStatus === 'risk_analysis'
      );
    }
    if (activeFilter === 'POST_PROD') {
      return proj.analysisStatus === 'complete' && (proj.overallRiskScore ?? 0) >= 50;
    }
    if (activeFilter === 'DEV') {
      return (
        !proj.analysisStatus ||
        (proj.analysisStatus === 'complete' && (proj.overallRiskScore ?? 0) < 50)
      );
    }
    return true;
  });

  return (
    <main className="md:ml-60 ml-0 pt-20 flex-1 p-4 md:p-margin-desktop bg-[#0A0A0A] min-h-[calc(100vh-64px)] overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2 tracking-tight">
            Active Slates
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl text-sm">
            Monitoring {projects.length} active screenplay productions. Continuous AI legal forensic risk analysis powered by Gemini Multi-Agent clearance pipelines.
          </p>
        </div>
        <div className="flex gap-4 self-stretch md:self-auto">
          <button
            onClick={onOpenNewProject}
            className="flex items-center gap-2 border border-outline-variant bg-primary text-on-primary px-4 py-2 font-label-caps text-label-caps hover:bg-primary-container transition-colors no-radius cursor-pointer font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Slate
          </button>
          <div className="flex bg-surface border border-outline-variant no-radius">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 font-label-caps text-label-caps no-radius flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-surface-container-high text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 font-label-caps text-label-caps no-radius border-l border-outline-variant flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface-container-high text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="List View"
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'IN_PROD', 'POST_PROD', 'DEV'] as const).map((filter) => {
            const labelMap = {
              ALL: 'ALL PROJECTS',
              IN_PROD: 'IN PRODUCTION (SCANNING)',
              POST_PROD: 'HIGH RISK / FLAGGED',
              DEV: 'CLEARED / LOW RISK',
            };
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`border font-label-caps text-[10px] px-3 py-1.5 cursor-pointer transition-colors no-radius ${
                  activeFilter === filter
                    ? 'bg-surface-variant border-primary text-primary font-bold'
                    : 'bg-[#121212] border-outline-variant text-on-surface-variant hover:border-primary'
                }`}
              >
                {labelMap[filter]}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search slates..."
            className="w-full bg-[#121212] border border-outline-variant text-on-surface font-body-md text-xs px-3 py-1.5 focus:border-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-on-surface-variant hover:text-on-surface text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && projects.length === 0 && (
        <div className="bg-[#121212] border border-outline-variant p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="font-label-caps text-xs text-on-surface-variant uppercase tracking-widest">
            Synchronizing Active Slates from CineShield Core...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProjects.length === 0 && (
        <div className="bg-[#121212] border border-outline-variant p-16 text-center max-w-2xl mx-auto my-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary"></div>
          <span className="material-symbols-outlined text-5xl text-primary/50 mb-4">
            folder_open
          </span>
          <h2 className="font-headline-md text-xl text-on-surface mb-2 uppercase tracking-wide">
            {searchQuery || activeFilter !== 'ALL'
              ? 'No Matching Slates Found'
              : 'No Active Slates Ingested'}
          </h2>
          <p className="font-body-md text-xs text-on-surface-variant mb-6 max-w-md mx-auto leading-relaxed">
            {searchQuery || activeFilter !== 'ALL'
              ? 'No projects match your current filter criteria. Try clearing search filters or ingesting a new screenplay.'
              : 'Ingest a screenplay (.fountain, .pdf, .txt) to initiate the automated Gemini multi-agent IP clearance, character conflict, and risk forensics pipeline.'}
          </p>
          <button
            onClick={onOpenNewProject}
            className="bg-primary text-on-primary font-label-caps text-xs px-6 py-3 hover:bg-primary-container transition-colors cursor-pointer font-bold inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            INGEST SCREENPLAY
          </button>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredProjects.length > 0 && (
        <div className="grid grid-cols-12 gap-gutter">
          {filteredProjects.map((proj, idx) => {
            const isScanning =
              proj.analysisStatus === 'queued' ||
              proj.analysisStatus === 'extracting_entities' ||
              proj.analysisStatus === 'risk_analysis';
            const risk = proj.overallRiskScore ?? 0;
            const isViolation = risk >= 70;
            const isUnderReview = risk >= 35 && risk < 70;
            const isCompliant = proj.analysisStatus === 'complete' && risk < 35;

            // Give the first scanning card full 8-column hero emphasis if scanning
            const colSpan = isScanning && idx === 0 ? 'col-span-12 lg:col-span-8' : 'col-span-12 md:col-span-6 lg:col-span-4';

            return (
              <div
                key={proj.id}
                className={`${colSpan} bg-[#121212] border border-[#2A2A2A] relative flex flex-col group hover:border-outline-variant transition-colors overflow-hidden`}
              >
                {isScanning && <div className="scanner-bar" />}
                <div
                  className={`absolute top-0 left-0 w-full h-[2px] ${
                    isScanning
                      ? 'bg-primary'
                      : isViolation
                      ? 'bg-error'
                      : isUnderReview
                      ? 'bg-primary-container'
                      : 'bg-outline-variant'
                  }`}
                />

                <div className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-label-caps text-[10px] text-primary tracking-widest">
                          STUDIO SLATE
                        </span>
                        <span className="w-1 h-1 bg-surface-variant rounded-full"></span>
                        <span className="font-body-md text-[11px] text-on-surface-variant">
                          {proj.script?.fileType
                            ? `${proj.script.fileType.toUpperCase()} SCRIPT`
                            : 'SCREENPLAY'}
                        </span>
                      </div>
                      <h3 className="font-headline-md text-xl text-on-surface leading-snug">
                        {proj.title}
                      </h3>
                      {proj.script?.fileName && (
                        <span className="font-body-md text-[11px] text-on-surface-variant block mt-1 truncate max-w-xs">
                          {proj.script.fileName}
                        </span>
                      )}
                    </div>

                    <span
                      className={`font-label-caps text-[10px] px-2.5 py-1 border no-radius flex items-center gap-1 shrink-0 ${
                        isScanning
                          ? 'bg-surface-variant text-primary border-primary animate-pulse'
                          : isViolation
                          ? 'bg-error/20 text-error border-error'
                          : isUnderReview
                          ? 'bg-primary-container/20 text-primary-container border-primary-container'
                          : isCompliant
                          ? 'bg-surface-container text-on-surface-variant border-[#2A2A2A]'
                          : 'bg-surface-variant text-on-surface-variant border-outline-variant'
                      }`}
                    >
                      {isScanning && (
                        <span className="material-symbols-outlined text-[12px] text-primary animate-spin">
                          progress_activity
                        </span>
                      )}
                      {isScanning
                        ? proj.analysisStatus === 'queued'
                          ? 'QUEUED'
                          : proj.analysisStatus === 'extracting_entities'
                          ? 'EXTRACTING'
                          : 'ANALYZING'
                        : isViolation
                        ? 'FLAGGED'
                        : isUnderReview
                        ? 'UNDER REVIEW'
                        : isCompliant
                        ? 'CLEARED'
                        : 'PENDING'}
                    </span>
                  </div>

                  {/* Summary Box */}
                  <div className="mt-2 mb-4 bg-surface-container p-3 border border-outline-variant/30 font-body-md text-[11px] text-on-surface-variant">
                    {isScanning ? (
                      <span className="text-primary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                        Multi-agent pipeline processing screenplay scenes...
                      </span>
                    ) : proj.findingsCount > 0 ? (
                      <span>
                        <strong className="text-on-surface">{proj.findingsCount} IP Finding(s)</strong> detected across dialogue and entities.
                      </span>
                    ) : (
                      <span>Clearance pipeline calibrated. No severe IP conflicts detected.</span>
                    )}
                  </div>

                  {/* Metrics Footer */}
                  <div className="mt-auto pt-4 border-t border-[#2A2A2A] flex justify-between items-end">
                    <div>
                      <span className="block font-label-caps text-[9px] text-on-surface-variant mb-0.5">
                        RISK INDEX
                      </span>
                      <span
                        className={`font-body-md text-2xl font-bold ${
                          isScanning
                            ? 'text-primary'
                            : isViolation
                            ? 'text-error'
                            : isUnderReview
                            ? 'text-primary-container'
                            : 'text-on-surface'
                        }`}
                      >
                        {isScanning ? '--' : risk}
                        <span className="text-xs text-on-surface-variant/70 font-normal">/100</span>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onNavigate('dashboard', proj.id)}
                        className="bg-transparent border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-label-caps text-[10px] px-3 py-1.5 transition-colors cursor-pointer"
                      >
                        VIEW SCRIPT
                      </button>
                      <button
                        onClick={() => onNavigate('forensics', proj.id)}
                        className="bg-primary text-on-primary font-label-caps text-[10px] px-3 py-1.5 hover:bg-primary-container transition-colors cursor-pointer font-bold"
                      >
                        FORENSICS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredProjects.length > 0 && (
        <div className="bg-[#121212] border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-body-md text-xs">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                  <th className="p-4">Slate Title</th>
                  <th className="p-4">Script Asset</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Findings</th>
                  <th className="p-4">Risk Score</th>
                  <th className="p-4">Uploaded</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filteredProjects.map((proj) => {
                  const isScanning =
                    proj.analysisStatus === 'queued' ||
                    proj.analysisStatus === 'extracting_entities' ||
                    proj.analysisStatus === 'risk_analysis';
                  const risk = proj.overallRiskScore ?? 0;

                  return (
                    <tr key={proj.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="p-4 font-bold text-on-surface">{proj.title}</td>
                      <td className="p-4 text-on-surface-variant">
                        {proj.script?.fileName || 'Screenplay'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-label-caps text-[9px] px-2 py-0.5 border ${
                            isScanning
                              ? 'bg-surface-variant text-primary border-primary animate-pulse'
                              : risk >= 70
                              ? 'bg-error/20 text-error border-error'
                              : risk >= 35
                              ? 'bg-primary-container/20 text-primary-container border-primary-container'
                              : 'bg-surface-container text-on-surface-variant border-[#2A2A2A]'
                          }`}
                        >
                          {isScanning ? 'SCANNING' : risk >= 70 ? 'FLAGGED' : risk >= 35 ? 'IN REVIEW' : 'CLEARED'}
                        </span>
                      </td>
                      <td className="p-4 text-on-surface-variant">{proj.findingsCount} findings</td>
                      <td className="p-4 font-bold text-on-surface">{isScanning ? '--' : `${risk}/100`}</td>
                      <td className="p-4 text-on-surface-variant">
                        {new Date(proj.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => onNavigate('dashboard', proj.id)}
                          className="border border-outline-variant px-2.5 py-1 text-[10px] font-label-caps text-on-surface hover:text-primary hover:border-primary"
                        >
                          VIEW
                        </button>
                        <button
                          onClick={() => onNavigate('forensics', proj.id)}
                          className="bg-primary text-on-primary font-bold px-2.5 py-1 text-[10px] font-label-caps hover:bg-primary-container"
                        >
                          FORENSICS
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ingest CTA footer */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={onOpenNewProject}
          className="bg-transparent border border-outline-variant text-on-surface-variant font-label-caps text-[11px] px-8 py-3 hover:text-on-surface hover:border-on-surface transition-colors no-radius cursor-pointer"
        >
          INGEST ADDITIONAL SLATES
        </button>
      </div>
    </main>
  );
};
