import React, { useState, useEffect } from 'react';
import { PageId } from '../types/frontend';
import { getStoredUser, subscribeAuth, setStoredUser, UserSession, apiFetch } from '../lib/authClient';

interface ProfilePageProps {
  onNavigate: (page: PageId) => void;
  onOpenAuth?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate, onOpenAuth }) => {
  const [user, setUser] = useState<UserSession | null>(getStoredUser());
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'preferences' | 'api'>('account');
  const [criticalRiskAlerts, setCriticalRiskAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [backupEmail, setBackupEmail] = useState('legal.secure@cineshield.ai');
  const [phone, setPhone] = useState('+1 (555) 019-8234');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAuth((updated) => {
      setUser(updated);
    });
    return unsubscribe;
  }, []);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network failure on logout
    }
    setStoredUser(null);
    setLogoutNotice(true);
    setTimeout(() => setLogoutNotice(false), 4000);
  };

  return (
    <main className="md:ml-60 ml-0 pt-16 p-4 md:p-8 min-h-[calc(100vh-64px)] bg-[#0A0A0A] overflow-y-auto">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {logoutNotice && (
          <div className="p-4 bg-surface-container-high border border-primary text-primary font-body-md text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">lock</span>
              <span>Session cleared. You are currently in Guest / Logged Out state.</span>
            </div>
            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1 bg-primary text-on-primary font-label-caps text-xs font-bold"
              >
                Sign In Again
              </button>
            )}
          </div>
        )}

        {/* Executive Header Card */}
        <div className="bg-surface-container border border-outline-variant p-8 flex flex-col md:flex-row items-start md:items-center gap-8 relative overflow-hidden">
          <div className="relative">
            <div className="w-28 h-28 bg-[#1E1E1E] border border-outline-variant flex items-center justify-center overflow-hidden text-3xl font-bold text-primary">
              {user?.name ? user.name.charAt(0) : <span className="material-symbols-outlined text-primary text-5xl">person</span>}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary px-2 py-0.5 font-label-caps text-[10px] text-on-primary font-bold">
              {user ? 'VERIFIED' : 'GUEST'}
            </div>
          </div>

          <div className="flex-grow">
            <h1 className="font-display-lg text-2xl md:text-3xl text-on-surface font-bold">
              {user ? user.name : 'Guest Reviewer'}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 font-body-md text-sm text-on-surface-variant mt-2">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">badge</span>
                {user ? `${user.role.toUpperCase()} (Clearance Officer)` : 'Unauthenticated'}
              </span>
              <span className="hidden sm:block text-outline-variant">|</span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">domain</span>
                {user?.studio || 'Studio Alpha'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex justify-between items-center bg-surface-container-high p-3 border border-outline-variant">
              <span className="font-label-caps text-xs text-on-surface-variant">CLEARANCE</span>
              <span className="font-body-md text-primary font-bold text-sm">{user?.clearance || 'LEVEL_03'}</span>
            </div>

            <div className="flex gap-2">
              {onOpenAuth && (
                <button
                  onClick={onOpenAuth}
                  className="flex-1 py-1.5 px-2 bg-surface-container-high border border-outline-variant hover:border-primary text-[11px] font-label-caps text-on-surface text-center font-bold cursor-pointer transition-colors"
                >
                  {user ? 'SWITCH USER' : 'SIGN IN'}
                </button>
              )}
              {user && (
                <button
                  onClick={handleLogout}
                  className="py-1.5 px-2 bg-error-container/20 border border-error/40 hover:bg-error-container/40 text-[11px] font-label-caps text-error text-center font-bold cursor-pointer transition-colors"
                >
                  LOG OUT
                </button>
              )}
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-primary/10 border border-primary text-primary font-body-md text-sm">
            Profile changes and preferences saved successfully.
          </div>
        )}

        {/* Tab Header */}
        <div className="flex border-b border-outline-variant overflow-x-auto flex-nowrap">
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'account'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'security'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Security &amp; MFA
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'preferences'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Alerts &amp; Preferences
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-6 py-3 font-label-caps text-xs tracking-wider uppercase cursor-pointer border-b-2 transition-all ${
              activeTab === 'api'
                ? 'border-primary text-primary bg-surface-container-high'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            API Credentials
          </button>
        </div>

        {/* Tab 1: Account */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-container border border-outline-variant p-6 space-y-4">
              <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">contact_mail</span>
                Contact Information
              </h3>
              <div className="space-y-4 font-body-md text-xs">
                <div>
                  <label className="block text-outline uppercase font-label-caps mb-1">Primary Email</label>
                  <input
                    type="email"
                    readOnly
                    value={user?.email || 'guest@cineshield.internal'}
                    className="w-full bg-surface-container-high border border-outline-variant p-2 text-on-surface font-mono"
                  />
                </div>
                <div>
                  <label className="block text-outline uppercase font-label-caps mb-1">Backup Legal Contact</label>
                  <input
                    type="email"
                    value={backupEmail}
                    onChange={(e) => setBackupEmail(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant p-2 text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-outline uppercase font-label-caps mb-1">Emergency Phone Hotline</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant p-2 text-on-surface"
                  />
                </div>
                <button
                  onClick={handleSave}
                  className="bg-primary text-on-primary font-label-caps text-xs px-4 py-2 hover:bg-primary-container transition-colors cursor-pointer font-bold"
                >
                  Update Contact
                </button>
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-6 space-y-4">
              <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">notifications_active</span>
                Notifications &amp; Alerts
              </h3>
              <div className="space-y-4">
                <div
                  onClick={() => setCriticalRiskAlerts(!criticalRiskAlerts)}
                  className="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant cursor-pointer hover:border-outline"
                >
                  <div>
                    <h4 className="font-body-md text-sm text-on-surface">Critical Risk Alerts</h4>
                    <p className="font-body-md text-xs text-on-surface-variant mt-1">
                      Immediate SMS &amp; webhook alerts on high-risk copyright matches.
                    </p>
                  </div>
                  <div className={`w-10 h-5 relative transition-colors ${criticalRiskAlerts ? 'bg-primary' : 'bg-surface-variant'}`}>
                    <div className={`w-4 h-4 bg-black absolute top-0.5 transition-all ${criticalRiskAlerts ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>

                <div
                  onClick={() => setDailyDigest(!dailyDigest)}
                  className="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant cursor-pointer hover:border-outline"
                >
                  <div>
                    <h4 className="font-body-md text-sm text-on-surface">Daily Forensic Digest</h4>
                    <p className="font-body-md text-xs text-on-surface-variant mt-1">
                      Summary of all scanned scripts and cleared intellectual property.
                    </p>
                  </div>
                  <div className={`w-10 h-5 relative transition-colors ${dailyDigest ? 'bg-primary' : 'bg-surface-variant'}`}>
                    <div className={`w-4 h-4 bg-black absolute top-0.5 transition-all ${dailyDigest ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === 'security' && (
          <div className="bg-surface-container border border-outline-variant p-6 space-y-6">
            <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
              Two-Factor Authentication &amp; Hardware Key
            </h3>
            <p className="text-xs text-on-surface-variant">
              Hardware FIDO2 Security Key (YubiKey 5C) active for Level 05 Clearance Signatures.
            </p>
            <div className="p-4 bg-surface-container-high border border-primary/40 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-on-surface">FIDO2 Hardware Key</span>
                <p className="text-xs text-outline mt-1">Key ID: YK-88192-CS-ROOT (Linked to Studio Vault)</p>
              </div>
              <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-label-caps font-bold">ACTIVE</span>
            </div>
          </div>
        )}

        {/* Tab 3: Preferences */}
        {activeTab === 'preferences' && (
          <div className="bg-surface-container border border-outline-variant p-6 space-y-4">
            <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
              Forensic Scanner Display Configuration
            </h3>
            <p className="text-xs text-on-surface-variant">
              Default high-contrast Studio Dark display profile enabled. Radical square typography paired with JetBrains Mono.
            </p>
          </div>
        )}

        {/* Tab 4: API */}
        {activeTab === 'api' && (
          <div className="bg-surface-container border border-outline-variant p-6 space-y-4">
            <h3 className="font-label-caps text-sm text-on-surface uppercase font-bold">
              User API Clearance Key
            </h3>
            <p className="text-xs text-on-surface-variant">
              Individual developer tokens for command-line screenplay ingestion.
            </p>
            <input
              type="text"
              readOnly
              value="csk_usr_vane_005_9a1288b4009"
              className="w-full max-w-lg bg-surface-container-high border border-outline-variant p-2 text-primary text-xs font-mono"
            />
          </div>
        )}
      </div>
    </main>
  );
};
