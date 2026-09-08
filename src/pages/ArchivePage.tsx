import React, { useState } from 'react';
import { PageId } from '../types/frontend';

interface ArchiveRecord {
  id: string;
  project: string;
  studio: string;
  date: string;
  type: string;
  clearanceId: string;
  status: 'CLEARED' | 'FLAGGED';
  riskScore: number;
  auditHash: string;
}

interface ArchivePageProps {
  onNavigate: (page: PageId, projectId?: string) => void;
}

export const ArchivePage: React.FC<ArchivePageProps> = ({ onNavigate }) => {
  const [selectedStudio, setSelectedStudio] = useState('All Studios');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedType, setSelectedType] = useState('All Types');

  const records: ArchiveRecord[] = [
    {
      id: 'rec-1',
      project: 'Project Neon Dawn',
      studio: 'Warner Bros',
      date: '2024-11-04',
      type: 'Character Clearance',
      clearanceId: '#C-992-XD',
      status: 'CLEARED',
      riskScore: 8,
      auditHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      id: 'rec-2',
      project: 'The Quantum Paradox',
      studio: 'Universal',
      date: '2024-08-22',
      type: 'Trademark Filing',
      clearanceId: '#T-441-PQ',
      status: 'FLAGGED',
      riskScore: 89,
      auditHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    },
    {
      id: 'rec-3',
      project: 'Cyber City 2099',
      studio: 'Paramount',
      date: '2024-06-15',
      type: 'Music & Script',
      clearanceId: '#M-104-AZ',
      status: 'CLEARED',
      riskScore: 14,
      auditHash: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
    },
    {
      id: 'rec-4',
      project: 'Apex Horizon',
      studio: 'Sony Pictures',
      date: '2024-04-10',
      type: 'Deep Forensic Scan',
      clearanceId: '#F-882-KW',
      status: 'CLEARED',
      riskScore: 19,
      auditHash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    },
    {
      id: 'rec-5',
      project: 'Chronos Directive',
      studio: 'Warner Bros',
      date: '2024-02-01',
      type: 'Full Legal Audit',
      clearanceId: '#L-339-RT',
      status: 'FLAGGED',
      riskScore: 78,
      auditHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    },
  ];

  const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(records[0]);

  const filteredRecords = records.filter((r) => {
    if (selectedStudio !== 'All Studios' && r.studio !== selectedStudio) return false;
    if (selectedType !== 'All Types' && !r.type.toLowerCase().includes(selectedType.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="pt-16 md:pl-60 min-h-screen p-margin-mobile md:p-margin-desktop bg-[#0A0A0A]">
      <div className="max-w-[container-max] mx-auto">
        {/* Header Section */}
        <div className="mb-8 border-b border-outline-variant pb-6">
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2">
            Secure Vault
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Access completed compliance reports and historical forensics scans.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          {/* Filters & Search Panel (Left Col) */}
          <div className="xl:col-span-3 space-y-gutter">
            <div className="bg-panel p-6 border border-[#2A2A2A]">
              <h3 className="font-label-caps text-label-caps text-primary mb-4 border-b border-outline-variant pb-2">
                Filter Records
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                    Studio
                  </label>
                  <select
                    value={selectedStudio}
                    onChange={(e) => setSelectedStudio(e.target.value)}
                    className="w-full bg-surface border-b border-outline-variant text-on-surface font-body-md py-2 sharp-edge focus:border-primary focus:ring-0"
                  >
                    <option value="All Studios">All Studios</option>
                    <option value="Paramount">Paramount</option>
                    <option value="Universal">Universal</option>
                    <option value="Warner Bros">Warner Bros</option>
                    <option value="Sony Pictures">Sony Pictures</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-surface border-b border-outline-variant text-on-surface font-body-md py-2 sharp-edge focus:border-primary focus:ring-0"
                  >
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                    Clearance Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full bg-surface border-b border-outline-variant text-on-surface font-body-md py-2 sharp-edge focus:border-primary focus:ring-0"
                  >
                    <option value="All Types">All Types</option>
                    <option value="Character">Character</option>
                    <option value="Trademark">Trademark</option>
                    <option value="Music">Audio / Music</option>
                    <option value="Audit">Full Audit</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Data List (Center Col) */}
          <div className="xl:col-span-6 space-y-gutter">
            <div className="bg-panel border border-[#2A2A2A]">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
                <span className="font-label-caps text-label-caps text-on-surface">
                  Archive Index
                </span>
                <span className="font-body-md text-on-surface-variant text-xs">
                  Showing {filteredRecords.length} of {records.length} records
                </span>
              </div>

              <div className="divide-y divide-outline-variant">
                {filteredRecords.map((item) => {
                  const isSelected = selectedRecord?.id === item.id;
                  const isCleared = item.status === 'CLEARED';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedRecord(item)}
                      className={`p-4 cursor-pointer transition-colors relative border-l-2 ${
                        isSelected
                          ? 'border-primary bg-[#1E1E1E]'
                          : 'border-transparent hover:border-primary hover:bg-[#1E1E1E]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-headline-md text-headline-md text-on-surface text-lg">
                          {item.project}
                        </h4>
                        <span
                          className={`px-2 py-1 font-label-caps text-[10px] font-bold ${
                            isCleared
                              ? 'bg-primary/20 text-primary'
                              : 'bg-error/20 text-error'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 font-body-md text-xs text-on-surface-variant">
                        <div>
                          <span className="text-on-surface block mb-1">Studio:</span>
                          {item.studio}
                        </div>
                        <div>
                          <span className="text-on-surface block mb-1">Date:</span>
                          {item.date}
                        </div>
                        <div>
                          <span className="text-on-surface block mb-1">Type:</span>
                          {item.type}
                        </div>
                        <div>
                          <span className="text-on-surface block mb-1">ID:</span>
                          {item.clearanceId}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview Panel (Right Col) */}
          <div className="xl:col-span-3">
            <div className="glass-panel p-6 h-full flex flex-col border border-[#2A2A2A]">
              <div className="flex items-center gap-2 mb-6 border-b border-outline-variant pb-4">
                <span className="material-symbols-outlined text-primary">verified_user</span>
                <h3 className="font-label-caps text-label-caps text-primary font-bold">
                  Certificate Preview
                </h3>
              </div>

              {selectedRecord ? (
                <div className="flex-1 flex flex-col justify-between space-y-4 font-body-md text-xs">
                  <div>
                    <div className="p-3 bg-[#0A0A0A] border border-[#2A2A2A] mb-3">
                      <span className="block font-label-caps text-[10px] text-on-surface-variant mb-1">
                        CLEARANCE CERTIFICATE ID
                      </span>
                      <span className="font-body-md text-primary font-bold">
                        {selectedRecord.clearanceId}
                      </span>
                    </div>

                    <div className="space-y-2 text-on-surface-variant">
                      <p>
                        <strong className="text-on-surface">Title:</strong> {selectedRecord.project}
                      </p>
                      <p>
                        <strong className="text-on-surface">Studio:</strong> {selectedRecord.studio}
                      </p>
                      <p>
                        <strong className="text-on-surface">Forensic Risk Score:</strong>{' '}
                        <span
                          className={`font-bold ${
                            selectedRecord.riskScore > 50 ? 'text-error' : 'text-primary'
                          }`}
                        >
                          {selectedRecord.riskScore}/100
                        </span>
                      </p>
                      <p>
                        <strong className="text-on-surface">Status:</strong>{' '}
                        <span
                          className={`font-label-caps px-1 py-0.5 text-[9px] ${
                            selectedRecord.status === 'CLEARED'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-error/20 text-error'
                          }`}
                        >
                          {selectedRecord.status}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 p-2 bg-[#0A0A0A] border border-outline-variant/30 text-[10px] text-on-surface-variant break-all">
                      <span className="block text-[9px] font-label-caps text-primary mb-1">
                        CRYPTOGRAPHIC PROOF (SHA256)
                      </span>
                      {selectedRecord.auditHash}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#2A2A2A] flex flex-col gap-2">
                    <button
                      onClick={() => onNavigate('dashboard')}
                      className="w-full py-2 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold hover:bg-primary transition-colors cursor-pointer"
                    >
                      OPEN IN VIEWER
                    </button>
                    <button
                      onClick={() => onNavigate('forensics')}
                      className="w-full py-2 bg-transparent border border-outline-variant text-on-surface font-label-caps text-label-caps hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      VIEW RAW FORENSICS
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <span className="material-symbols-outlined text-4xl mb-2">description</span>
                  <p className="font-body-md text-sm">Select a record to view its clearance certificate.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
