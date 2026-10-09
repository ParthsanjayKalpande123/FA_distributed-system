'use client';
import { useState } from 'react';
import { nodeBase } from '../lib/api';

/* ── Inline SVG icons (no emoji, no external deps) ──────── */
const Icons = {
  Teacher: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Student: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  HOD: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  Admin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Alert: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Server: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
};

const ROLE_META = {
  teacher: { label: 'Teacher',      Icon: Icons.Teacher, desc: 'Mark and manage attendance'    },
  student: { label: 'Student',      Icon: Icons.Student, desc: 'Book resources, track status'  },
  hod:     { label: 'HOD',          Icon: Icons.HOD,     desc: 'Approve or reject bookings'    },
  admin:   { label: 'System Admin', Icon: Icons.Admin,   desc: 'Monitor the Raft cluster'      },
};

const DEMO_ACCOUNTS = [
  { userId: 'T001',     password: 'sharma123',  role: 'teacher', name: 'Dr. Sharma'   },
  { userId: 'T002',     password: 'patel123',   role: 'teacher', name: 'Dr. Patel'    },
  { userId: 'S001',     password: 'rahul123',   role: 'student', name: 'Rahul Kumar'  },
  { userId: 'HOD001',   password: 'iyer123',    role: 'hod',     name: 'Prof. Iyer'   },
  { userId: 'ADMIN001', password: 'admin123',   role: 'admin',   name: 'System Admin' },
];

async function loginRequest(userId, password) {
  for (const port of [3001, 3002, 3003]) {
    try {
      const res = await fetch(`${nodeBase(port)}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
        signal: AbortSignal.timeout(2500),
      });
      const data = await res.json();
      if (res.ok) return { ok: true, user: data };
      return { ok: false, error: data.error || 'Invalid credentials.' };
    } catch { /* node down — try next */ }
  }
  return { ok: false, error: 'All nodes unreachable. Please try again.' };
}

export default function LoginPage() {
  const [userId,   setUserId]   = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [hint,     setHint]     = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('Please enter both User ID and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await loginRequest(userId.trim(), password);
    setLoading(false);
    if (result.ok) {
      localStorage.setItem('campuswatch_user', JSON.stringify(result.user));
      window.location.href = `/${result.user.role}`;
    } else {
      setError(result.error);
    }
  };

  const fillDemo = (acc) => {
    setUserId(acc.userId);
    setPassword(acc.password);
    setError('');
    setHint(false);
  };

  return (
    <div className="login-page">

      {/* ── Left panel ─────────────────────────────────── */}
      <div className="login-left">
        <div className="login-left-content fade-in">
          <div className="login-logo">Campus<span>Watch</span></div>
          <div className="login-tagline">
            Distributed Attendance &amp; Resource Booking System<br />
            Powered by Raft Consensus &middot; 3-Node Cluster
          </div>

          {/* Role cards */}
          <div className="role-cards">
            {Object.entries(ROLE_META).map(([role, m]) => (
              <div className="role-card" key={role}>
                <div className="rc-icon">
                  <m.Icon />
                </div>
                <div className="rc-title">{m.label}</div>
                <div className="rc-desc">{m.desc}</div>
              </div>
            ))}
          </div>


        </div>
      </div>

      {/* ── Right panel — login form ────────────────────── */}
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div className="login-form-title">Welcome Back</div>
            <div className="login-form-sub">Sign in with your campus credentials</div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <Icons.Alert />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} autoComplete="off">
            {/* User ID */}
            <div className="form-group">
              <label className="form-label" htmlFor="userId">User ID</label>
              <input
                id="userId"
                type="text"
                className="form-input"
                placeholder="e.g. T001, S001, ADMIN001"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: '0.5rem', gap: '0.5rem' }}
            >
              {loading ? 'Signing in...' : (
                <>Sign In <Icons.ArrowRight /></>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: '1.75rem' }}>
            <button
              type="button"
              onClick={() => setHint(!hint)}
              style={{
                background: 'none', border: '1px dashed var(--border-2)',
                borderRadius: 9, padding: '0.5rem 0.875rem',
                fontSize: '0.78rem', color: 'var(--text-3)',
                cursor: 'pointer', width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; }}
            >
              {hint ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
              {hint ? 'Hide' : 'Show'} demo credentials
            </button>

            {hint && (
              <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg)', padding: '0.5rem 0.875rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Click any row to auto-fill
                </div>
                {DEMO_ACCOUNTS.map(acc => {
                  const m = ROLE_META[acc.role];
                  return (
                    <button
                      key={acc.userId}
                      type="button"
                      onClick={() => fillDemo(acc)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        width: '100%', padding: '0.65rem 0.875rem',
                        background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: 'var(--brand-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--brand)', flexShrink: 0,
                      }}>
                        <m.Icon />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{acc.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                          ID: <strong>{acc.userId}</strong> &middot; PW: <strong>{acc.password}</strong>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-light)', padding: '0.15rem 0.5rem', borderRadius: 999, border: '1px solid var(--brand-mid)' }}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.7 }}>
            CampusWatch &middot; Distributed Systems Demo &middot; Raft Consensus
          </div>
        </div>
      </div>
    </div>
  );
}
