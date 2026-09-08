import React, { useState } from 'react';
import { PageId } from '../types/frontend';

interface ForensicsPageProps {
  projectId?: string;
  onNavigate: (page: PageId, projectId?: string) => void;
}

interface DetectedEntity {
  id: string;
  name: string;
  icon: string;
  type: string;
  riskLevel: 'HIGH RISK' | 'UNDER REVIEW' | 'CLEARED';
  matchPercent: number;
}

export const ForensicsPage: React.FC<ForensicsPageProps> = ({
  projectId,
  onNavigate,
}) => {
  const [activeProjectName] = useState(projectId ? 'Active Script Sequence' : 'Neon Horizon');
  const [selectedEntity, setSelectedEntity] = useState<DetectedEntity | null>(null);
  const [isQueryingPrecedents, setIsQueryingPrecedents] = useState(false);
  const [deepQuerySuccess, setDeepQuerySuccess] = useState<string | null>(null);

  const entities: DetectedEntity[] = [
    {
      id: 'e1',
      name: '"Cypher Corp" Logo',
      icon: 'warning',
      type: 'Background Asset',
      riskLevel: 'HIGH RISK',
      matchPercent: 99,
    },
    {
      id: 'e2',
      name: 'Character Name: "J. Doe"',
      icon: 'gavel',
      type: 'Dialogue/Script',
      riskLevel: 'UNDER REVIEW',
      matchPercent: 85,
    },
    {
      id: 'e3',
      name: 'Generic Car Design',
      icon: 'check_circle',
      type: 'Prop',
      riskLevel: 'CLEARED',
      matchPercent: 12,
    },
    {
      id: 'e4',
      name: '"OmniCorp" Hologram Banner',
      icon: 'warning',
      type: 'VFX Foreground',
      riskLevel: 'HIGH RISK',
      matchPercent: 94,
    },
    {
      id: 'e5',
      name: 'Synthwave Audio Cue #04',
      icon: 'music_note',
      type: 'Audio Master Track',
      riskLevel: 'UNDER REVIEW',
      matchPercent: 78,
    },
  ];

  const handleRunDeepQuery = async () => {
    setIsQueryingPrecedents(true);
    setDeepQuerySuccess(null);
    try {
      // Simulate IBM watsonx / Gemini legal precedent vector search
      await new Promise((resolve) => setTimeout(resolve, 800));
      setDeepQuerySuccess('Deep neural legal precedent query completed: Found 4 authoritative 9th Circuit rulings on fair use and parody.');
    } finally {
      setIsQueryingPrecedents(false);
    }
  };

  const handleExportLog = () => {
    const logData = {
      project: activeProjectName,
      timestamp: new Date().toISOString(),
      frameSequence: '#042-089',
      scanConfidence: '98.4%',
      entities,
      status: 'AUDITED_AND_VERIFIED',
    };
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cineshield_forensic_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="ml-60 mt-16 p-gutter flex-1 overflow-y-auto h-[calc(100vh-64px)] bg-[#0A0A0A]">
      <header className="mb-gutter flex justify-between items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            Project: <span className="text-primary">{activeProjectName}</span>
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Forensic Deep-Dive Analysis — Frame Sequence #042-089
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleExportLog}
            className="bg-transparent border border-outline text-on-surface px-4 py-2 font-label-caps text-label-caps hover:bg-[#1E1E1E] transition-colors rounded-none flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Export Log
          </button>
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-gutter h-[calc(100%-80px)]">
        {/* Left Column: Detected Entities & Metrics */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
          {/* Top Row: Metrics */}
          <div className="grid grid-cols-3 gap-gutter h-28">
            <div className="panel p-4 flex flex-col justify-between metric-glow-danger relative overflow-hidden">
              <div className="scanner-bar"></div>
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                Critical Risks
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-error">03</span>
                <span className="font-label-caps text-label-caps text-error">Flags</span>
              </div>
            </div>

            <div className="panel p-4 flex flex-col justify-between metric-glow-warning relative overflow-hidden">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                Entities Pending Review
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-primary">12</span>
                <span className="font-label-caps text-label-caps text-primary">Items</span>
              </div>
            </div>

            <div className="panel p-4 flex flex-col justify-between relative">
              <span className="font-label-caps text-label-caps text-on-surface-variant">
                Scan Confidence
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">98.4</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant">%</span>
              </div>
            </div>
          </div>

          {/* Main Area: Visualization & Entity List */}
          <div className="flex-1 panel relative overflow-hidden flex flex-col min-h-[380px]">
            {/* Scanning Visualization Header */}
            <div className="h-44 border-b border-[#2A2A2A] relative bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 1px, #fdbc13 1px, transparent 2px)',
                  backgroundSize: '100% 4px',
                }}
              ></div>

              {/* Central Scan Ring */}
              <div className="relative w-32 h-32 rounded-full border border-[#2A2A2A] flex items-center justify-center">
                <div className="absolute inset-0 border border-primary rounded-full animate-ping opacity-20"></div>
                <div className="w-24 h-24 rounded-full border border-[#504533] flex items-center justify-center relative">
                  <div
                    className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"
                    style={{ animationDuration: '3s' }}
                  ></div>
                  <span className="material-symbols-outlined text-primary text-[32px]">
                    policy
                  </span>
                </div>
              </div>

              <div className="absolute top-4 left-4">
                <span className="font-label-caps text-label-caps text-primary animate-pulse">
                  ANALYZING ASSETS...
                </span>
              </div>
            </div>

            {/* Entity List */}
            <div className="flex-1 p-0 overflow-y-auto">
              <div className="sticky top-0 bg-[#121212] border-b border-[#2A2A2A] px-4 py-2 flex justify-between items-center z-10">
                <span className="font-label-caps text-label-caps text-on-surface-variant">
                  Detected Entities
                </span>
                <div className="flex gap-2">
                  <button className="text-on-surface-variant hover:text-primary cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <tbody>
                  {entities.map((entity) => {
                    const isHigh = entity.riskLevel === 'HIGH RISK';
                    const isReview = entity.riskLevel === 'UNDER REVIEW';

                    return (
                      <tr
                        key={entity.id}
                        onClick={() => setSelectedEntity(entity)}
                        className={`border-b border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors cursor-pointer ${
                          !isHigh && !isReview ? 'opacity-70' : ''
                        }`}
                      >
                        <td className="p-4 font-body-md text-body-md w-1/3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`material-symbols-outlined text-[18px] ${
                                isHigh
                                  ? 'text-error'
                                  : isReview
                                  ? 'text-primary'
                                  : 'text-outline'
                              }`}
                            >
                              {entity.icon}
                            </span>
                            <span className="text-on-surface">{entity.name}</span>
                          </div>
                        </td>
                        <td className="p-4 font-body-md text-body-md text-on-surface-variant w-1/4">
                          {entity.type}
                        </td>
                        <td className="p-4 w-1/4">
                          <span
                            className={`font-label-caps text-label-caps px-2 py-1 rounded-none inline-block ${
                              isHigh
                                ? 'bg-[#FF3E3E] text-black font-bold'
                                : isReview
                                ? 'bg-[#F4B400] text-black font-bold'
                                : 'bg-[#2A2A2A] text-on-surface'
                            }`}
                          >
                            {entity.riskLevel}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-body-md text-body-md text-on-surface-variant">
                            {entity.matchPercent}% Match
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Legal Precedents */}
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <div className="glass-panel flex-1 flex flex-col p-6 h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Legal Precedents
              </h3>
              <span className="material-symbols-outlined text-primary">account_balance</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Precedent Item 1 */}
              <div className="border border-[#2A2A2A] p-4 bg-[#0A0A0A]">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-caps text-label-caps text-error">CASE #892-A</span>
                  <span className="font-body-md text-body-md text-on-surface-variant text-xs">
                    1998
                  </span>
                </div>
                <h4 className="font-body-md text-body-md font-bold mb-2 text-on-surface">
                  MegaCorp v. IndieStudios
                </h4>
                <p className="font-body-md text-body-md text-on-surface-variant text-sm mb-3">
                  Injunction granted for incidental background use of stylized corporate logo closely resembling registered trademark.
                </p>
                <div className="flex gap-2">
                  <span className="bg-[#2A2A2A] text-on-surface font-label-caps text-[10px] px-1.5 py-0.5 rounded-none">
                    TRADEMARK
                  </span>
                  <span className="bg-[#2A2A2A] text-on-surface font-label-caps text-[10px] px-1.5 py-0.5 rounded-none">
                    BACKGROUND
                  </span>
                </div>
              </div>

              {/* Precedent Item 2 */}
              <div className="border border-[#2A2A2A] p-4 bg-[#0A0A0A]">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-caps text-label-caps text-primary">CASE #441-B</span>
                  <span className="font-body-md text-body-md text-on-surface-variant text-xs">
                    2012
                  </span>
                </div>
                <h4 className="font-body-md text-body-md font-bold mb-2 text-on-surface">
                  Doe Estate v. Pictures Inc.
                </h4>
                <p className="font-body-md text-body-md text-on-surface-variant text-sm mb-3">
                  Fair use upheld for character name incidental to plot, lacking distinct biographical similarities to plaintiff.
                </p>
                <div className="flex gap-2">
                  <span className="bg-[#2A2A2A] text-on-surface font-label-caps text-[10px] px-1.5 py-0.5 rounded-none">
                    DEFAMATION
                  </span>
                  <span className="bg-[#2A2A2A] text-on-surface font-label-caps text-[10px] px-1.5 py-0.5 rounded-none">
                    FAIR USE
                  </span>
                </div>
              </div>

              {deepQuerySuccess && (
                <div className="p-3 bg-surface-container border border-primary text-xs font-body-md text-primary">
                  {deepQuerySuccess}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
              <button
                onClick={handleRunDeepQuery}
                disabled={isQueryingPrecedents}
                className="w-full bg-transparent border border-primary text-primary px-4 py-3 font-label-caps text-label-caps hover:bg-primary hover:text-black transition-colors rounded-none flex justify-center items-center gap-2 cursor-pointer font-bold"
              >
                {isQueryingPrecedents ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    SEARCHING CASELAW...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">search</span>
                    Run Deep Query
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
