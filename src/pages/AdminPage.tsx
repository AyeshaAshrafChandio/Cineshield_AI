import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { apiFetch } from '../lib/authClient';

interface AdminPageProps {
  onNavigate: (page: PageId) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'models' | 'audit'>('infrastructure');
  const [clusterStatus, setClusterStatus] = useState({
    activeNodes: 8,
    totalNodes: 8,
    cpuUsage: 24,
    memoryUsage: 41,
    latencyMs: 18,
    status: 'OPTIMAL',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check real backend status
    apiFetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.memoryUsage?.heapUsed) {
          setClusterStatus((prev) => ({
            ...prev,
            memoryUsage: Math.round((data.memoryUsage.heapUsed / data.memoryUsage.heapTotal) * 100),
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleRestartCluster = () => {
    setStatusMessage('Cluster node health re-synchronized across 8 forensic workers.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <main className="md:ml-60 ml-0 pt-16 p-4 md:p-8 min-h-[calc(100vh-64px)] bg-[#0A0A0A] overflow-y-auto">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Header & Status */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-4 border-b border-outline-variant gap-4">
          <div>
            <div className="flex items-center space-x-2 text-primary font-label-caps text-[11px] tracking-widest uppercase mb-1">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Central Governance Engine • Root Clearance</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface uppercase tracking-tight">
              System Administration &amp; Governance
            </h1>
            <p className="text-on-surface-variant font-body-md mt-1 text-[13px] max-w-3xl">
              Studio-wide legal AI infrastructure, cluster provisioning, tenant licenses, and high-clearance access audit.
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-surface-container-low px-4 py-2 border border-outline-variant self-start lg:self-auto">
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-outline uppercase">Infrastructure Health</span>
              <span className="font-label-caps text-xs text-primary font-bold">ALL 8 NODES ONLINE</span>
            </div>
            <div className="h-6 w-[1px] bg-outline-variant"></div>
            <span className="w-2.5 h-2.5 bg-primary rounded-full animate-ping"></span>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-primary/10 border border-primary text-primary font-body-md text-sm">
            {statusMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant overflow-x-auto flex-nowrap">
          <button
            onClick={() => setActiveTab('infrastructure')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'infrastructure'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Cluster Infrastructure
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'models'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            AI Agent Pipeline
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Clearance Audit Logs
          </button>
        </div>

        {/* Tab 1: Cluster Infrastructure */}
        {activeTab === 'infrastructure' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-surface-container border border-outline-variant p-5">
                <span className="font-label-caps text-[11px] text-on-surface-variant uppercase">Compute Load</span>
                <div className="text-2xl font-display-lg text-on-surface mt-2">{clusterStatus.cpuUsage}%</div>
                <div className="w-full bg-surface-container-highest h-1.5 mt-3 overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${clusterStatus.cpuUsage}%` }}></div>
                </div>
              </div>

              <div className="bg-surface-container border border-outline-variant p-5">
                <span className="font-label-caps text-[11px] text-on-surface-variant uppercase">Heap Memory</span>
                <div className="text-2xl font-display-lg text-on-surface mt-2">{clusterStatus.memoryUsage}%</div>
                <div className="w-full bg-surface-container-highest h-1.5 mt-3 overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${clusterStatus.memoryUsage}%` }}></div>
                </div>
              </div>

              <div className="bg-surface-container border border-outline-variant p-5">
                <span className="font-label-caps text-[11px] text-on-surface-variant uppercase">Cluster Nodes</span>
                <div className="text-2xl font-display-lg text-primary mt-2">
                  {clusterStatus.activeNodes} / {clusterStatus.totalNodes}
                </div>
                <p className="text-[11px] font-body-md text-on-surface-variant mt-2">Kubernetes Pods Synced</p>
              </div>

              <div className="bg-surface-container border border-outline-variant p-5">
                <span className="font-label-caps text-[11px] text-on-surface-variant uppercase">Forensic Ingress Latency</span>
                <div className="text-2xl font-display-lg text-on-surface mt-2">{clusterStatus.latencyMs}ms</div>
                <p className="text-[11px] font-body-md text-primary mt-2">Google Cloud Asia-SE1</p>
              </div>
            </div>

            {/* Active Nodes Table */}
            <div className="bg-surface-container border border-outline-variant p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
                  Active Forensic Worker Nodes
                </h3>
                <button
                  onClick={handleRestartCluster}
                  className="bg-primary text-on-primary font-label-caps text-xs px-4 py-2 hover:bg-primary-container transition-colors cursor-pointer"
                >
                  Sync Nodes
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-md text-xs">
                  <thead className="border-b border-outline-variant text-outline uppercase font-label-caps">
                    <tr>
                      <th className="py-3 px-4">Node ID</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Model Engine</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {[
                      { id: 'node-gemini-01', role: 'Script Parser Agent', engine: 'gemini-3.6-flash', status: 'READY', uptime: '99.98%' },
                      { id: 'node-gemini-02', role: 'Entity & Trademark Agent', engine: 'gemini-3.6-flash', status: 'READY', uptime: '99.94%' },
                      { id: 'node-gemini-03', role: 'Clearance & Risk Agent', engine: 'gemini-3.6-flash', status: 'ACTIVE', uptime: '99.99%' },
                      { id: 'node-gemini-04', role: 'Creative Dialogue Rewrite', engine: 'gemini-3.6-flash', status: 'READY', uptime: '100%' },
                      { id: 'node-partner-01', role: 'IBM WatsonX Precedent Adapter', engine: 'watsonx.ai / granited-13b', status: 'READY', uptime: '99.91%' },
                      { id: 'node-ingest-01', role: 'Fountain / PDF Stream Normalizer', engine: 'Native Node22 Parser', status: 'IDLE', uptime: '100%' },
                    ].map((node) => (
                      <tr key={node.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="py-3 px-4 font-bold text-on-surface">{node.id}</td>
                        <td className="py-3 px-4 text-on-surface-variant">{node.role}</td>
                        <td className="py-3 px-4 text-primary font-label-caps">{node.engine}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold">
                            {node.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-outline">{node.uptime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: AI Agent Pipeline */}
        {activeTab === 'models' && (
          <div className="bg-surface-container border border-outline-variant p-6 space-y-6">
            <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
              Multi-Agent Clearance Architecture
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-surface-container-high border border-outline-variant space-y-2">
                <span className="text-primary font-label-caps text-xs">Stage 1: Ingestion</span>
                <h4 className="font-bold text-on-surface">Screenplay Structure Parser</h4>
                <p className="text-xs text-on-surface-variant">
                  Extracts scenes, dialogue blocks, sluglines, parentheticals, and timestamps with strict fountain/pdf tokenization.
                </p>
              </div>

              <div className="p-4 bg-surface-container-high border border-outline-variant space-y-2">
                <span className="text-primary font-label-caps text-xs">Stage 2: Entity & Precedent</span>
                <h4 className="font-bold text-on-surface">Forensic Trademark & IP Scanner</h4>
                <p className="text-xs text-on-surface-variant">
                  Correlates script entities with trademark databases, USPTO classifications, and IBM WatsonX precedent archives.
                </p>
              </div>

              <div className="p-4 bg-surface-container-high border border-outline-variant space-y-2">
                <span className="text-primary font-label-caps text-xs">Stage 3: Mitigation</span>
                <h4 className="font-bold text-on-surface">Creative Dialogue Rewrite</h4>
                <p className="text-xs text-on-surface-variant">
                  Proposes tone-preserving script replacements with legal clearances and verifiable audit certificates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-surface-container border border-outline-variant p-6 space-y-4">
            <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
              Cryptographic Clearance Audit Trail
            </h3>
            <div className="space-y-3 font-body-md text-xs">
              {[
                { time: '14:52:10 UTC', action: 'SHA-256 Checksum Computed', detail: 'Script "Neon Nights" validated: 4e07408562bedb8b' },
                { time: '14:48:02 UTC', action: 'Multi-Agent Run Finalized', detail: 'Analysis run e509182a completed with 0 errors' },
                { time: '14:35:19 UTC', action: 'Tenant Security Auth', detail: 'User Julian Vane granted Level 05 Clearance' },
                { time: '14:20:00 UTC', action: 'IBM WatsonX Sync', detail: 'Updated legal precedent database weights' },
              ].map((log, i) => (
                <div key={i} className="p-3 bg-surface-container-high border-l-2 border-primary flex justify-between">
                  <div>
                    <span className="text-primary font-bold mr-3">[{log.time}]</span>
                    <span className="text-on-surface font-semibold">{log.action}: </span>
                    <span className="text-on-surface-variant">{log.detail}</span>
                  </div>
                  <span className="text-outline text-[11px]">VERIFIED</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
