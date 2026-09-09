import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { apiFetch } from '../lib/authClient';

interface TeamPageProps {
  onNavigate: (page: PageId) => void;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  clearance: string;
  status: 'Active' | 'Pending' | 'Offline';
}

export const TeamPage: React.FC<TeamPageProps> = ({ onNavigate }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Production Counsel');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTeam = async () => {
    try {
      const res = await apiFetch('/api/auth/team');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.warn('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim() || undefined,
          role: newMemberRole,
          clearance: 'LEVEL_04',
        }),
      });

      if (res.ok) {
        await loadTeam();
        setNewMemberName('');
        setNewMemberEmail('');
        setShowInviteModal(false);
      }
    } catch (err) {
      console.error('Failed to invite member:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="md:ml-60 ml-0 pt-16 p-4 md:p-8 min-h-[calc(100vh-64px)] bg-[#0A0A0A] overflow-y-auto">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-4 border-b border-outline-variant gap-4">
          <div>
            <div className="flex items-center space-x-2 text-primary font-label-caps text-[11px] tracking-widest uppercase mb-1">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              <span>Studio Legal Governance</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface uppercase tracking-tight">
              Studio Legal Team Management
            </h1>
            <p className="text-on-surface-variant font-body-md mt-1 text-sm">
              Manage executive roles, clearance authorization tiers, and active forensic auditor permissions.
            </p>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-primary text-on-primary font-label-caps text-xs px-4 py-2.5 hover:bg-primary-container transition-colors flex items-center gap-2 cursor-pointer font-bold"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Invite Counsel
          </button>
        </div>

        {/* Members Table Card */}
        <div className="bg-surface-container border border-outline-variant p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="border-b border-outline-variant">
                <tr className="font-label-caps text-xs text-on-surface-variant uppercase">
                  <th className="pb-4 px-3">Name</th>
                  <th className="pb-4 px-3">Role</th>
                  <th className="pb-4 px-3">Clearance Tier</th>
                  <th className="pb-4 px-3">Status</th>
                  <th className="pb-4 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-sm divide-y divide-outline-variant/30">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="py-4 px-3 font-bold text-on-surface">{member.name}</td>
                    <td className="py-4 px-3 text-on-surface-variant">{member.role}</td>
                    <td className="py-4 px-3">
                      <span className="bg-surface-container-highest px-2 py-1 border border-outline-variant text-primary text-[10px] font-bold">
                        {member.clearance}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className="flex items-center gap-2 text-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            member.status === 'Active' ? 'bg-primary' : 'bg-outline'
                          }`}
                        ></span>
                        <span className={member.status === 'Active' ? 'text-primary' : 'text-outline'}>
                          {member.status}
                        </span>
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <button
                        title="Remove member"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/auth/team/${member.id}`, { method: 'DELETE' });
                            setMembers((prev) => prev.filter((m) => m.id !== member.id));
                          } catch (err) {
                            console.error('Failed to remove team member:', err);
                          }
                        }}
                        className="text-outline hover:text-error transition-colors p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-surface-container border border-outline-variant max-w-md w-full p-6 space-y-4">
              <h3 className="font-headline-md text-lg font-bold text-on-surface">Invite Legal Counsel</h3>
              <form onSubmit={handleInvite} className="space-y-4 font-body-md text-xs">
                <div>
                  <label className="block text-outline uppercase font-label-caps mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="e.g. Rachel Chen"
                    className="w-full bg-surface-container-high border border-outline-variant p-2 text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-outline uppercase font-label-caps mb-1">Studio Role</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant p-2 text-on-surface"
                  >
                    <option>Production Counsel</option>
                    <option>Forensic IP Specialist</option>
                    <option>Clearance Coordinator</option>
                    <option>External Legal Auditor</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-outline-variant text-on-surface hover:bg-surface-container-high cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary font-bold hover:bg-primary-container cursor-pointer"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
