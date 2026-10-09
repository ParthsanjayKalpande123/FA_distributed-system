'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest, getUser } from '../../lib/api';
import { TeacherInsights } from '../../components/dashboard/WorkflowCapabilities';

/* ── SVG Icons ────────────────────────────────────────────── */
const Icons = {
  ClipboardList: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="8" y="2" width="8" height="4" rx="1"/><rect x="3" y="6" width="18" height="16" rx="2"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>
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
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
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

/* ── Constants ───────────────────────────────────────────── */

// PRN list: 123B1B146 to 123B1B220
const STUDENTS = Array.from({ length: 75 }, (_, i) => {
  const num = 146 + i;
  return { userId: `123B1B${num}`, prn: `123B1B${num}` };
});

const SUBJECTS = [
  { code: 'DS',    name: 'Distributed Systems' },
  { code: 'DBMS',  name: 'Database Management' },
  { code: 'OS',    name: 'Operating Systems' },
  { code: 'CN',    name: 'Computer Networks' },
  { code: 'SE',    name: 'Software Engineering' },
  { code: 'Maths', name: 'Engineering Mathematics' },
];

/* ── Sidebar ─────────────────────────────────────────────── */
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
        <div className="user-avatar teacher-av">
          {user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div className="user-name">{user.name}</div>
        <div className="user-role">Teacher &middot; {user.userId}</div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-link active">
          <span className="nav-icon"><Icons.ClipboardList /></span>
          Attendance
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

/* ── Main Dashboard ──────────────────────────────────────── */
export default function TeacherDashboard() {
  const [user, setUser]                           = useState(null);
  const [subject, setSubject]                     = useState(SUBJECTS[0].code);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [date, setDate]                           = useState(new Date().toISOString().split('T')[0]);
  const [attendanceState, setAttendanceState]     = useState({});
  const [submitting, setSubmitting]               = useState(false);
  const [toast, setToast]                         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Initialize all PRNs as present by default
  const initAttendance = () => {
    const init = {};
    STUDENTS.forEach(s => { init[s.userId] = true; });
    setAttendanceState(init);
  };

  const fetchAttendance = useCallback(async (d, sub) => {
    try {
      const data = await apiRequest(`/api/attendance?date=${d || date}&subject=${sub || subject}`);
      setAttendanceRecords(Array.isArray(data) ? data : (data?.data || []));
    } catch { /* silent */ }
  }, [date, subject]);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'teacher') { window.location.href = '/'; return; }
    setUser(u);
    initAttendance();
    fetchAttendance(new Date().toISOString().split('T')[0], SUBJECTS[0].code);
  }, []);

  // Re-fetch when subject or date changes
  useEffect(() => {
    fetchAttendance(date, subject);
  }, [subject, date]);

  const handleMarkAll = (present) => {
    const next = {};
    STUDENTS.forEach(s => { next[s.userId] = present; });
    setAttendanceState(next);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await Promise.all(STUDENTS.map(s =>
        apiRequest('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            studentId: s.userId,
            date,
            subject,
            present: !!attendanceState[s.userId],
            markedBy: user.userId,
          }),
        })
      ));
      showToast(`Attendance for ${subject} submitted and replicated to all nodes.`);
      fetchAttendance(date, subject);
    } catch {
      showToast('Error submitting attendance. Please try again.', 'error');
    } finally { setSubmitting(false); }
  };

  const presentCount = Object.values(attendanceState).filter(Boolean).length;
  const absentCount  = STUDENTS.length - presentCount;

  if (!user) return null;

  const selectedSubjectName = SUBJECTS.find(s => s.code === subject)?.name || subject;

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
          <span className="topbar-title">Teacher Dashboard — Attendance Management</span>
          <div className="topbar-right">
            <span className="badge badge-info">Raft Replicated</span>
          </div>
        </div>

        <div className="page-body">
          {/* Stats */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Students</div>
              <div className="stat-value">{STUDENTS.length}</div>
              <div className="stat-sub">PRN 123B1B146–220</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Present</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{presentCount}</div>
              <div className="stat-sub">Marked present</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Absent</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{absentCount}</div>
              <div className="stat-sub">Marked absent</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Attendance Rate</div>
              <div className="stat-value">
                {Math.round((presentCount / STUDENTS.length) * 100)}%
              </div>
              <div className="stat-sub">{selectedSubjectName}</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Mark attendance */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Mark Attendance</div>
                  <div className="card-subtitle">Select subject, date, then mark each PRN</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => fetchAttendance(date, subject)}>
                  <Icons.RefreshCw /> Refresh
                </button>
              </div>

              {/* Subject selector */}
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                >
                  {SUBJECTS.map(s => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date selector */}
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              {/* Mark All buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleMarkAll(true)}>
                  <Icons.CheckCircle /> Mark All Present
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleMarkAll(false)}>
                  <Icons.XCircle /> Mark All Absent
                </button>
              </div>

              {/* PRN list */}
              <div className="mb-3" style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  PRN — {selectedSubjectName}
                </div>
                {STUDENTS.map(s => (
                  <div className="checkbox-row" key={s.userId}>
                    <input
                      type="checkbox"
                      id={`chk-${s.userId}`}
                      checked={!!attendanceState[s.userId]}
                      onChange={e => setAttendanceState(prev => ({ ...prev, [s.userId]: e.target.checked }))}
                    />
                    <label htmlFor={`chk-${s.userId}`}>
                      {s.prn}
                    </label>
                    <span className={`badge ${attendanceState[s.userId] ? 'badge-approved' : 'badge-rejected'}`}>
                      {attendanceState[s.userId] ? (
                        <><Icons.CheckCircle /> Present</>
                      ) : (
                        <><Icons.XCircle /> Absent</>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleSubmit}
                disabled={submitting}
              >
                <Icons.Send />
                {submitting ? 'Submitting...' : `Submit ${subject} Attendance`}
              </button>
            </div>

            {/* Attendance records */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Attendance Records</div>
                  <div className="card-subtitle">{selectedSubjectName} — {date}</div>
                </div>
                <span className="badge badge-info">{attendanceRecords.length} records</span>
              </div>

              {attendanceRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icons.Inbox />
                  </div>
                  <div className="empty-text">
                    No records for <strong>{subject}</strong> on {date}.<br />
                    Submit attendance above to populate.
                  </div>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>PRN</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((r, i) => (
                      <tr key={i}>
                        <td className="fw-600">{r.studentId}</td>
                        <td className="text-muted">{r.subject || subject}</td>
                        <td>
                          <span className={`badge ${r.present ? 'badge-approved' : 'badge-rejected'}`}>
                            {r.present ? <><Icons.CheckCircle /> Present</> : <><Icons.XCircle /> Absent</>}
                          </span>
                        </td>
                        <td className="text-muted">{r.markedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <TeacherInsights />
        </div>
      </div>
    </div>
  );
}
