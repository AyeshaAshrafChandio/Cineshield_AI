import React, { useState } from 'react';
import { UserSession, setStoredUser, apiFetch } from '../lib/authClient';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: UserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'counsel' | 'producer' | 'auditor'>('counsel');
  const [clearance, setClearance] = useState<'LEVEL_03' | 'LEVEL_04' | 'LEVEL_05'>('LEVEL_04');
  const [studio, setStudio] = useState('Studio Alpha');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Google sign-in failed on server.');
      }
      const loggedInUser: UserSession = {
        ...data.user,
        token: data.token,
      };
      setStoredUser(loggedInUser);
      if (onSuccess) onSuccess(loggedInUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
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
        if (!password.trim()) throw new Error('Please provide your password.');
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Login failed.');
        }
        setStoredUser({
          ...data.user,
          token: data.token,
        });
        if (onSuccess) onSuccess(data.user);
      } else {
        if (!email.trim() || !name.trim()) {
          throw new Error('Name and email are required for registration.');
        }
        if (!password.trim() || password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
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
            password: password.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Sign up failed.');
        }
        setStoredUser({
          ...data.user,
          token: data.token,
        });
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
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container p-3 no-radius text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Quick Google Sign In via Firebase Auth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-surface-container-highest border border-outline-variant hover:border-primary text-on-surface text-xs font-label-caps flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9c-.4-.7-.8-1.5-.8-2.4z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
              />
            </svg>
            <span className="font-bold">SIGN IN WITH GOOGLE WORKSPACE</span>
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-[10px] font-mono text-outline uppercase tracking-wider">OR STUDIO CREDENTIALS</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-label-caps uppercase tracking-wider text-outline font-bold">
                Passcode / Password {mode === 'login' ? '(Studio Credentials)' : '(Min 6 chars)'}
              </label>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-container-high border border-outline-variant focus:border-primary px-3 py-2 text-on-surface text-xs font-mono"
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
  </div>
);
};
