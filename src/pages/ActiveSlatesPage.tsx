import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';

interface ActiveSlatesPageProps {
  onNavigate: (page: PageId, projectId?: string) => void;
  onOpenNewProject: () => void;
}

interface ApiProject {
  id: string;
  title: string;
  script?: {
    id: string;
    fileName: string;
    fileType: string;
    title: string;
    uploadedAt: string;
  } | null;
  analysisStatus: string | null;
  latestAnalysisId: string | null;
  overallRiskScore: number | null;
  findingsCount: number;
  createdAt: string;
}

export const ActiveSlatesPage: React.FC<ActiveSlatesPageProps> = ({
  onNavigate,
  onOpenNewProject,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'IN_PROD' | 'POST_PROD' | 'DEV'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          if (data.projects) {
            setApiProjects(data.projects);
          }
        }
      } catch (err) {
        console.warn('Could not fetch real projects list:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <main className="ml-60 flex-1 p-margin-desktop bg-[#0A0A0A] min-h-[calc(100vh-64px)]">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2">
            Active Slates
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-2xl">
            Monitoring {42 + apiProjects.length} active productions across 8 studios. AI forensic analysis running continuously on ingested dailies and pre-vis assets.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onOpenNewProject}
            className="flex items-center gap-2 border border-outline-variant bg-surface px-4 py-2 text-on-surface font-label-caps text-label-caps hover:bg-surface-container-high transition-colors no-radius cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Slate
          </button>
          <div className="flex bg-surface border border-outline-variant no-radius">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 font-label-caps text-label-caps no-radius flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-surface-container-high text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 font-label-caps text-label-caps no-radius border-l border-outline-variant flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface-container-high text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-3 mb-8">
        <span
          onClick={() => setActiveFilter('ALL')}
          className={`border font-label-caps text-[10px] px-3 py-1 cursor-pointer transition-colors ${
            activeFilter === 'ALL'
              ? 'bg-surface-variant border-primary text-on-surface'
              : 'bg-[#121212] border-outline-variant text-on-surface-variant hover:border-primary'
          }`}
        >
          ALL PROJECTS
        </span>
        <span
          onClick={() => setActiveFilter('IN_PROD')}
          className={`border font-label-caps text-[10px] px-3 py-1 cursor-pointer transition-colors ${
            activeFilter === 'IN_PROD'
              ? 'bg-surface-variant border-primary text-on-surface'
              : 'bg-[#121212] border-outline-variant text-on-surface-variant hover:border-primary'
          }`}
        >
          IN PRODUCTION
        </span>
        <span
          onClick={() => setActiveFilter('POST_PROD')}
          className={`border font-label-caps text-[10px] px-3 py-1 cursor-pointer transition-colors ${
            activeFilter === 'POST_PROD'
              ? 'bg-surface-variant border-primary text-on-surface'
              : 'bg-[#121212] border-outline-variant text-on-surface-variant hover:border-primary'
          }`}
        >
          POST-PRODUCTION
        </span>
        <span
          onClick={() => setActiveFilter('DEV')}
          className={`border font-label-caps text-[10px] px-3 py-1 cursor-pointer transition-colors ${
            activeFilter === 'DEV'
              ? 'bg-surface-variant border-primary text-on-surface'
              : 'bg-[#121212] border-outline-variant text-on-surface-variant hover:border-primary'
          }`}
        >
          DEVELOPMENT
        </span>
      </div>

      {/* Real Ingested Projects Banner if user added scripts */}
      {apiProjects.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="font-label-caps text-xs text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">bolt</span>
              INGESTED BACKEND PRODUCTIONS ({apiProjects.length})
            </span>
          </div>
          <div className="grid grid-cols-12 gap-gutter">
            {apiProjects.map((proj) => {
              const isScanning = proj.analysisStatus === 'running' || proj.analysisStatus === 'pending';
              const risk = proj.overallRiskScore ?? 68;
              const isViolation = risk >= 75;

              return (
                <div
                  key={proj.id}
                  className="col-span-12 lg:col-span-4 bg-[#121212] border border-[#2A2A2A] relative flex flex-col group hover:border-outline-variant transition-colors"
                >
                  {isScanning && <div className="scanner-bar" />}
                  <div
                    className={`absolute top-0 left-0 w-full h-[2px] ${
                      isViolation ? 'bg-error' : 'bg-primary-container'
                    }`}
                  />
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-label-caps text-[10px] text-primary tracking-widest">
                            STUDIO ALPHA
                          </span>
                          <span className="w-1 h-1 bg-surface-variant rounded-full"></span>
                          <span className="font-body-md text-[12px] text-on-surface-variant">
                            {proj.script?.fileType ? `${proj.script.fileType.toUpperCase()} SCRIPT` : 'Direct Dailies'}
                          </span>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-on-surface leading-none">
                          {proj.title}
                        </h3>
                      </div>
                      <span
                        className={`font-label-caps text-[10px] px-2 py-1 border no-radius ${
                          isScanning
                            ? 'bg-surface-variant text-on-surface border-outline-variant animate-pulse'
                            : isViolation
                            ? 'bg-error text-on-error border-error'
                            : 'bg-primary-container text-on-primary-container border-primary-container'
                        }`}
                      >
                        {isScanning ? 'SCANNING' : isViolation ? 'VIOLATION' : 'IN REVIEW'}
                      </span>
                    </div>

                    <div className="mt-2 mb-4 bg-surface-container p-3 border border-outline-variant/30 font-body-md text-[12px] text-on-surface-variant">
                      {proj.findingsCount > 0
                        ? `${proj.findingsCount} risk findings flagged by clearance agents.`
                        : 'Gemini multi-agent legal clearance running.'}
                    </div>

                    <div className="mt-auto flex justify-between items-end border-t border-[#2A2A2A] pt-4">
                      <div>
                        <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                          RISK SCORE
                        </span>
                        <span
                          className={`font-body-md text-2xl font-bold ${
                            isViolation ? 'text-error' : 'text-primary'
                          }`}
                        >
                          {risk}
                          <span className="text-sm opacity-70">/100</span>
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigate('dashboard', proj.id)}
                        className="bg-primary-container text-on-primary-container font-label-caps text-[10px] px-4 py-2 hover:bg-primary transition-colors cursor-pointer font-bold"
                      >
                        OPEN VIEWER
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stitch Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-gutter">
        {/* Project Card 1: Scanning (High Priority) */}
        <div className="col-span-12 lg:col-span-8 bg-[#121212] border border-[#2A2A2A] relative overflow-hidden flex flex-col group hover:border-outline-variant transition-colors">
          <div className="scanner-bar"></div>
          <div className="p-6 flex flex-col h-full border-b-[2px] border-transparent">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label-caps text-[10px] text-primary tracking-widest">
                    WARNER BROS.
                  </span>
                  <span className="w-1 h-1 bg-surface-variant rounded-full"></span>
                  <span className="font-body-md text-[12px] text-on-surface-variant">
                    Post-Production
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface leading-none">
                  Project: OMEGA PROTOCOL
                </h3>
                <p className="font-body-md text-on-surface-variant mt-2 text-sm max-w-xl">
                  VFX Sequence 42B ingested. Running neural comparison against protected intellectual property databases.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="bg-surface-variant text-on-surface font-label-caps text-[10px] px-2 py-1 mb-2 border border-outline-variant animate-pulse flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-primary">
                    radar
                  </span>
                  SCANNING
                </span>
                <div className="text-right">
                  <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                    RISK PROBABILITY
                  </span>
                  <span className="font-body-md text-2xl text-on-surface font-bold">--%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-auto pt-6 border-t border-[#2A2A2A]">
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  ASSETS ANALYZED
                </span>
                <span className="font-body-md text-on-surface">1,402 / 5,000</span>
              </div>
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  EST. COMPLETION
                </span>
                <span className="font-body-md text-on-surface">02:14:00</span>
              </div>
              <div className="text-right">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="text-primary font-label-caps text-[10px] hover:underline underline-offset-4 flex items-center justify-end gap-1 w-full h-full cursor-pointer"
                >
                  VIEW LIVE STREAM{' '}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Project Card 2: Violation (Alert) */}
        <div className="col-span-12 lg:col-span-4 bg-[#121212] border border-[#2A2A2A] relative flex flex-col group hover:border-error-container transition-colors">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-error"></div>
          <div className="p-6 flex flex-col h-full bg-error-container/5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label-caps text-[10px] text-error tracking-widest">
                    UNIVERSAL
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface leading-none">
                  ECHOES OF TOMORROW
                </h3>
              </div>
              <span className="bg-error text-on-error font-label-caps text-[10px] px-2 py-1 border border-error no-radius">
                VIOLATION
              </span>
            </div>
            <div className="mt-4 mb-6">
              <span className="block font-label-caps text-[10px] text-error mb-1">
                CRITICAL MATCH DETECTED
              </span>
              <div className="bg-surface-container p-3 border border-error/30 font-body-md text-[12px] text-on-surface-variant">
                Structural similarity &gt; 92% found in Act 3 dialogue script vs. Protected DB Entry [A-773].
              </div>
            </div>
            <div className="mt-auto flex justify-between items-end border-t border-[#2A2A2A] pt-4">
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  RISK SCORE
                </span>
                <span className="font-body-md text-3xl text-error font-bold">
                  98<span className="text-sm text-error/70">/100</span>
                </span>
              </div>
              <button
                onClick={() => onNavigate('forensics')}
                className="bg-transparent border border-error text-error font-label-caps text-[10px] px-4 py-2 hover:bg-error/10 transition-colors cursor-pointer"
              >
                REVIEW REPORT
              </button>
            </div>
          </div>
        </div>

        {/* Project Card 3: Compliant */}
        <div className="col-span-12 lg:col-span-4 bg-[#121212] border border-[#2A2A2A] flex flex-col hover:border-outline-variant transition-colors group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[#2A2A2A] group-hover:bg-outline-variant transition-colors"></div>
          <div className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">
                    SONY PICTURES
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface leading-none">
                  THE SILENT SEA
                </h3>
              </div>
              <span className="bg-transparent text-on-surface-variant font-label-caps text-[10px] px-2 py-1 border border-[#2A2A2A] no-radius">
                COMPLIANT
              </span>
            </div>
            <div className="mt-auto flex justify-between items-end border-t border-[#2A2A2A] pt-4">
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  LAST SCAN
                </span>
                <span className="font-body-md text-[12px] text-on-surface">2 hrs ago</span>
              </div>
              <div className="text-right">
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  RISK SCORE
                </span>
                <span className="font-body-md text-xl text-on-surface font-bold">
                  12<span className="text-sm text-on-surface-variant">/100</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Card 4: Under Review */}
        <div className="col-span-12 lg:col-span-4 bg-[#121212] border border-[#2A2A2A] flex flex-col hover:border-outline-variant transition-colors group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-primary-container"></div>
          <div className="p-6 flex flex-col h-full bg-primary-container/5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label-caps text-[10px] text-primary tracking-widest">
                    PARAMOUNT
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface leading-none">
                  NEON HORIZON
                </h3>
              </div>
              <span className="bg-primary-container text-on-primary-container font-label-caps text-[10px] px-2 py-1 border border-primary-container no-radius whitespace-nowrap">
                UNDER REVIEW
              </span>
            </div>
            <div className="mt-auto flex justify-between items-end border-t border-[#2A2A2A] pt-4">
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  FLAGGED ASSETS
                </span>
                <span className="font-body-md text-[14px] text-primary">3 Audio Tracks</span>
              </div>
              <div className="text-right">
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  RISK SCORE
                </span>
                <span className="font-body-md text-xl text-primary font-bold">
                  64<span className="text-sm text-primary/70">/100</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Card 5: Compliant */}
        <div className="col-span-12 lg:col-span-4 bg-[#121212] border border-[#2A2A2A] flex flex-col hover:border-outline-variant transition-colors group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[#2A2A2A] group-hover:bg-outline-variant transition-colors"></div>
          <div className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">
                    A24
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface leading-none">
                  MIDNIGHT SUN
                </h3>
              </div>
              <span className="bg-transparent text-on-surface-variant font-label-caps text-[10px] px-2 py-1 border border-[#2A2A2A] no-radius">
                COMPLIANT
              </span>
            </div>
            <div className="mt-auto flex justify-between items-end border-t border-[#2A2A2A] pt-4">
              <div>
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  LAST SCAN
                </span>
                <span className="font-body-md text-[12px] text-on-surface">5 hrs ago</span>
              </div>
              <div className="text-right">
                <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                  RISK SCORE
                </span>
                <span className="font-body-md text-xl text-on-surface font-bold">
                  04<span className="text-sm text-on-surface-variant">/100</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onOpenNewProject}
          className="bg-transparent border border-outline-variant text-on-surface-variant font-label-caps text-[12px] px-8 py-3 hover:text-on-surface hover:border-on-surface transition-colors no-radius cursor-pointer"
        >
          INGEST ADDITIONAL SLATES
        </button>
      </div>
    </main>
  );
};
