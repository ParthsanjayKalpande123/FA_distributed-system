'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getUser } from '../../lib/api';
import { BookingAnalytics } from '../../components/dashboard/WorkflowCapabilities';

/* ── SVG Icons ──────────────────────────────────────────── */
const Icons = {
  ClipboardCheck: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="8" y="2" width="8" height="4" rx="1"/><rect x="3" y="6" width="18" height="16" rx="2"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  XCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Inbox: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
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
        <div className="user-avatar hod-av">
          {user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div className="user-name">{user.name}</div>
        <div className="user-role">Head of Department &middot; {user.userId}</div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-link active">
          <span className="nav-icon"><Icons.ClipboardCheck /></span>
          Booking Approvals
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

export default function HodDashboard() {
  const [user, setUser]                     = useState(null);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [allBookings, setAllBookings]       = useState([]);
  const [actionLoading, setActionLoading]   = useState({});
  const [toast, setToast]                   = useState(null);
  const [activeTab, setActiveTab]           = useState('pending');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    try {
      const [pData, aData] = await Promise.all([
        apiRequest('/api/booking?status=pending'),
        apiRequest('/api/booking'),
      ]);
      setPendingBookings(Array.isArray(pData) ? pData : (pData?.data || []));
      setAllBookings(Array.isArray(aData) ? aData : (aData?.data || []));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'hod') { window.location.href = '/'; return; }
    setUser(u);
    fetchData();
    const iv = setInterval(fetchData, 6000);
    return () => clearInterval(iv);
  }, []);

  const handleAction = async (id, decision) => {
    setActionLoading(prev => ({ ...prev, [id]: decision }));
    try {
      const result = await apiRequest(`/api/booking/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, decidedBy: user.userId }),
      });
      if (result?.error) {
        showToast(result.message || 'This booking cannot be approved before an earlier request for the same slot.', 'error');
        await fetchData();
        return;
      }
      showToast(`Booking ${decision} successfully. Student notified via Redis Pub/Sub.`);
      fetchData();
    } catch {
      showToast('Error updating booking. Please try again.', 'error');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const counts = {
    pending:  allBookings.filter(b => b.status === 'pending').length,
    approved: allBookings.filter(b => b.status === 'approved').length,
    rejected: allBookings.filter(b => b.status === 'rejected').length,
  };

  if (!user) return null;

  const STATUS_BADGE = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

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
          <span className="topbar-title">HOD Dashboard — Booking Approvals</span>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm" onClick={fetchData}>
              <Icons.RefreshCw /> Refresh
            </button>
            <span className="badge badge-info">Auto-sync every 6s</span>
          </div>
        </div>

        <div className="page-body">
          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Requests</div>
              <div className="stat-value">{allBookings.length}</div>
              <div className="stat-sub">All booking requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Action</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{counts.pending}</div>
              <div className="stat-sub">Awaiting your decision</div>
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

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {[['pending', `Pending (${counts.pending})`], ['all', `All Bookings (${allBookings.length})`]].map(([t, label]) => (
              <button
                key={t}
                className={`btn ${activeTab === t ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(t)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Pending table */}
          {activeTab === 'pending' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Pending Booking Requests</div>
                  <div className="card-subtitle">FIFO by slot: approve the earliest pending request first. Decisions are replicated via Raft.</div>
                </div>
                {counts.pending > 0 && (
                  <span className="badge badge-pending pulse">{counts.pending} pending</span>
                )}
              </div>

              {pendingBookings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icons.Inbox />
                  </div>
                  <div className="empty-text">No pending requests. All caught up.</div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Queue</th><th>Resource</th><th>Date</th><th>Time Slot</th><th>Requested By</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {pendingBookings.map(b => (
                      <tr key={b.id}>
                        <td>#{b.queuePosition}</td>
                        <td className="fw-600">{b.resource}</td>
                        <td>{b.date}</td>
                        <td className="text-muted">{b.timeSlot}</td>
                        <td>
                          <span className="badge badge-info">{b.requestedBy}</span>
                        </td>
                        <td>
                          <div className="gap-2">
                            <button
                              className="btn btn-success btn-sm"
                              disabled={!!actionLoading[b.id]}
                              onClick={() => handleAction(b.id, 'approved')}
                            >
                              <Icons.CheckCircle />
                              {actionLoading[b.id] === 'approved' ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={!!actionLoading[b.id]}
                              onClick={() => handleAction(b.id, 'rejected')}
                            >
                              <Icons.XCircle />
                              {actionLoading[b.id] === 'rejected' ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* All bookings table */}
          {activeTab === 'all' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">All Booking Records</div>
                  <div className="card-subtitle">Complete history across all students</div>
                </div>
                <span className="badge badge-info">{allBookings.length} total</span>
              </div>

              {allBookings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icons.Inbox />
                  </div>
                  <div className="empty-text">No bookings in the system yet.</div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Queue</th><th>Resource</th><th>Date</th><th>Time</th><th>Requested By</th><th>Decided By</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {allBookings.map(b => (
                      <tr key={b.id}>
                        <td>#{b.queuePosition}</td>
                        <td className="fw-600">{b.resource}</td>
                        <td>{b.date}</td>
                        <td className="text-muted">{b.timeSlot}</td>
                        <td>{b.requestedBy}</td>
                        <td className="text-muted">{b.decidedBy || '—'}</td>
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
          )}

          <BookingAnalytics />
        </div>
      </div>
    </div>
  );
}
