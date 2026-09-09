import React, { useState } from 'react';
import { UserSession, setStoredUser, apiFetch } from '../lib/authClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: UserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'counsel' | 'producer' | 'auditor'>('counsel');
  const [clearance, setClearance] = useState<'LEVEL_03' | 'LEVEL_04' | 'LEVEL_05'>('LEVEL_04');
  const [studio, setStudio] = useState('Studio Alpha');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickLogin = async (executiveEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: executiveEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Authentication failed.');
      }
      setStoredUser(data.user);
      if (onSuccess) onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        if (!email.trim()) throw new Error('Please provide an email address.');
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Login failed.');
        }
        setStoredUser(data.user);
        if (onSuccess) onSuccess(data.user);
      } else {
        if (!email.trim() || !name.trim()) {
          throw new Error('Name and email are required for registration.');
        }
        const res = await apiFetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim(),
            role,
            clearance,
            studio: studio.trim() || 'Studio Alpha',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Sign up failed.');
        }
        setStoredUser(data.user);
        if (onSuccess) onSuccess(data.user);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface border border-outline-variant no-radius overflow-hidden shadow-2xl relative">
        {/* Scanner accent bar */}
        <div className="h-1 w-full bg-primary" />

        {/* Modal Header */}
        <div className="p-5 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">
              verified_user
            </span>
            <div>
              <h2 className="font-headline-md text-base text-on-surface uppercase tracking-wider font-bold">
                {mode === 'login' ? 'Studio Access Clearance' : 'Register New Counsel'}
              </h2>
              <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">
                CineShield Multi-Tenant Security Gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 no-radius cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Quick Demo Identities */}
        <div className="p-4 bg-surface-container border-b border-outline-variant">
          <span className="text-[10px] font-label-caps uppercase tracking-wider text-outline block mb-2 font-bold">
            Executive Demo Identities (1-Click Login):
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleQuickLogin('j.vane@studioalpha.com')}
              disabled={loading}
              className="text-left p-2 bg-surface-container-high border border-outline-variant hover:border-primary transition-colors cursor-pointer text-xs"
            >
              <div className="font-bold text-on-surface text-[11px] truncate">Julian Vane</div>
              <div className="text-[9px] text-primary font-mono">CLO • L5</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('m.thorne@studioalpha.com')}
              disabled={loading}
              className="text-left p-2 bg-surface-container-high border border-outline-variant hover:border-primary transition-colors cursor-pointer text-xs"
            >
              <div className="font-bold text-on-surface text-[11px] truncate">Marcus Thorne</div>
              <div className="text-[9px] text-primary font-mono">Forensics • L5</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('s.jenkins@studioalpha.com')}
              disabled={loading}
              className="text-left p-2 bg-surface-container-high border border-outline-variant hover:border-primary transition-colors cursor-pointer text-xs"
            >
              <div className="font-bold text-on-surface text-[11px] truncate">Sarah Jenkins</div>
              <div className="text-[9px] text-primary font-mono">Counsel • L4</div>
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-outline-variant">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-label-caps tracking-wider uppercase text-center border-b-2 transition-colors ${
              mode === 'login'
                ? 'border-primary text-primary bg-surface-container-high font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-label-caps tracking-wider uppercase text-center border-b-2 transition-colors ${
              mode === 'signup'
                ? 'border-primary text-primary bg-surface-container-high font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Register / Sign Up
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container p-3 no-radius text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-label-caps uppercase tracking-wider text-outline mb-1 font-bold">
                Full Name &amp; Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alexandra Rivers, VP Production"
                className="w-full bg-surface-container-high border border-outline-variant focus:border-primary px-3 py-2 text-on-surface text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-label-caps uppercase tracking-wider text-outline mb-1 font-bold">
              Studio Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., counsel@studio.com"
              className="w-full bg-surface-container-high border border-outline-variant focus:border-primary px-3 py-2 text-on-surface text-xs"
            />
          </div>

          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-label-caps uppercase text-outline mb-1 font-bold">
                    Organizational Role
                  </label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant px-2 py-2 text-on-surface text-xs"
                  >
                    <option value="counsel">Legal Counsel</option>
                    <option value="producer">Producer</option>
                    <option value="auditor">Forensic Auditor</option>
                    <option value="admin">Studio Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-label-caps uppercase text-outline mb-1 font-bold">
                    Security Clearance
                  </label>
                  <select
                    value={clearance}
                    onChange={(e: any) => setClearance(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant px-2 py-2 text-on-surface text-xs"
                  >
                    <option value="LEVEL_03">Level 03 (Observer)</option>
                    <option value="LEVEL_04">Level 04 (Reviewer)</option>
                    <option value="LEVEL_05">Level 05 (Full Clearance)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-label-caps uppercase text-outline mb-1 font-bold">
                  Studio Entity
                </label>
                <input
                  type="text"
                  value={studio}
                  onChange={(e) => setStudio(e.target.value)}
                  placeholder="Studio Alpha / Universal"
                  className="w-full bg-surface-container-high border border-outline-variant px-3 py-2 text-on-surface text-xs"
                />
              </div>
            </>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container-high border border-outline-variant text-on-surface text-xs font-label-caps hover:bg-surface-variant cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary text-on-primary font-label-caps text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
              <span>{mode === 'login' ? 'AUTHORIZE & SIGN IN' : 'CREATE ACCOUNT & INGEST'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
