'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getUser } from '../../lib/api';

/* ── SVG Icons ──────────────────────────────────────────── */
const Icons = {
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Inbox: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

function Sidebar({ user }) {
  const handleLogout = () => {
    localStorage.removeItem('campuswatch_user');
    localStorage.removeItem('campuswatch_leader');
    window.location.href = '/';
  };
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">Campus<span>Watch</span></div>
        <div className="tagline">Distributed System</div>
      </div>
      <div className="sidebar-user">
        <div className="user-avatar student-av">
          {user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div className="user-name">{user.name}</div>
        <div className="user-role">Student &middot; {user.userId}</div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-link active">
          <span className="nav-icon"><Icons.Calendar /></span>
          Resource Booking
        </span>
      </nav>
      <div className="sidebar-footer">
        <button className="nav-link" onClick={handleLogout}>
          <span className="nav-icon"><Icons.LogOut /></span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const RESOURCES  = ['Lab-1', 'Lab-2', 'Seminar Hall A', 'Seminar Hall B'];
const TIME_SLOTS = ['09:00–10:00','10:00–11:00','11:00–12:00','12:00–13:00','14:00–15:00','15:00–16:00','16:00–17:00'];

const STATUS_BADGE = {
  pending:  'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
};

export default function StudentDashboard() {
  const [user, setUser]           = useState(null);
  const [bookings, setBookings]   = useState([]);
  const [resource, setResource]   = useState(RESOURCES[0]);
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot]   = useState(TIME_SLOTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBookings = useCallback(async (userId) => {
    try {
      const data = await apiRequest(`/api/booking?requestedBy=${userId}`);
      setBookings(Array.isArray(data) ? data : (data?.data || []));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'student') { window.location.href = '/'; return; }
    setUser(u);
    fetchBookings(u.userId);
    const iv = setInterval(() => fetchBookings(u.userId), 5000);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiRequest('/api/booking', {
        method: 'POST',
        body: JSON.stringify({ resource, date, timeSlot, requestedBy: user.userId }),
      });
      showToast('Booking request submitted successfully.');
      fetchBookings(user.userId);
    } catch {
      showToast('Error submitting booking request. Please try again.', 'error');
    } finally { setSubmitting(false); }
  };

  const counts = {
    pending:  bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
  };

  if (!user) return null;

  return (
    <div className="app-layout">
      <Sidebar user={user} />

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'error' ? <Icons.AlertCircle /> : <Icons.CheckCircle />}
          {toast.msg}
        </div>
      )}

      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Student Dashboard — Resource Booking</span>
          <div className="topbar-right">
            <span className="badge badge-info">Auto-refreshing</span>
          </div>
        </div>

        <div className="page-body">
          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Requests</div>
              <div className="stat-value">{bookings.length}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{counts.pending}</div>
              <div className="stat-sub">Awaiting HOD decision</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approved</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{counts.approved}</div>
              <div className="stat-sub">Confirmed bookings</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rejected</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{counts.rejected}</div>
              <div className="stat-sub">Declined requests</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Booking form */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">New Booking Request</div>
                  <div className="card-subtitle">Request will be sent to HOD for approval</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Resource</label>
                <select className="form-select" value={resource} onChange={e => setResource(e.target.value)}>
                  {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time Slot</label>
                <select className="form-select" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Preview */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Request Preview</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {[['Resource', resource], ['Date', date], ['Time Slot', timeSlot], ['Requested By', user.userId]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: '0.1rem' }}>{k}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleSubmit}
                disabled={submitting}
              >
                <Icons.Send />
                {submitting ? 'Submitting...' : 'Submit Booking Request'}
              </button>
            </div>

            {/* Booking history */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">My Booking History</div>
                  <div className="card-subtitle">Updates every 5 seconds via Redis Pub/Sub</div>
                </div>
                <span className="badge badge-info">{bookings.length}</span>
              </div>

              {bookings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icons.Inbox />
                  </div>
                  <div className="empty-text">
                    No booking requests yet.<br />Submit a request using the form.
                  </div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Resource</th><th>Date</th><th>Time</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {[...bookings].reverse().map((b, i) => (
                      <tr key={i}>
                        <td className="fw-600">{b.resource}</td>
                        <td>{b.date}</td>
                        <td className="text-muted">{b.timeSlot}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[b.status] || 'badge-pending'}`}>
                            {(b.status || 'pending').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
