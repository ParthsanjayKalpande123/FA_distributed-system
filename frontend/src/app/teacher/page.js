'use client';
import { useState, useEffect } from 'react';
import { apiRequest, getUser } from '../../lib/api';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceState, setAttendanceState] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'teacher') {
      window.location.href = '/';
      return;
    }
    setUser(u);
    fetchStudents();
    fetchAttendance();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStudents = async () => {
    try {
      const data = await apiRequest('/api/users/student');
      if (Array.isArray(data)) {
        setStudents(data);
        const initial = {};
        data.forEach(s => initial[s.userId] = true);
        setAttendanceState(initial);
      } else {
        // Mock data fallback
        const mock = [
          { userId: 's1', name: 'Alice Student' },
          { userId: 's2', name: 'Bob Student' }
        ];
        setStudents(mock);
        const initial = {};
        mock.forEach(s => initial[s.userId] = true);
        setAttendanceState(initial);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendance = async () => {
    try {
      const data = await apiRequest(`/api/attendance?date=${date}`);
      if (Array.isArray(data)) {
        setAttendanceRecords(data);
      } else if (data.data && Array.isArray(data.data)) {
        setAttendanceRecords(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    try {
      const promises = students.map(s => {
        return apiRequest('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            studentId: s.userId,
            date,
            present: attendanceState[s.userId],
            markedBy: user.userId
          })
        });
      });
      await Promise.all(promises);
      showToast('Attendance submitted successfully!');
      fetchAttendance();
    } catch (err) {
      showToast('Error submitting attendance', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('campuswatch_user');
    window.location.href = '/';
  };

  if (!user) return null;

  return (
    <div className="container">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}
      
      <div className="header">
        <h1>Teacher Dashboard</h1>
        <div className="nav-info">
          <span>{user.name}</span>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="mb-4">Mark Attendance</h2>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>

          <table className="table mb-4">
            <thead>
              <tr>
                <th>Student</th>
                <th>Present</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.userId}>
                  <td>{s.name}</td>
                  <td>
                    <input 
                      type="checkbox"
                      checked={attendanceState[s.userId] || false}
                      onChange={e => setAttendanceState(prev => ({...prev, [s.userId]: e.target.checked}))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn btn-primary" onClick={handleSubmit}>Submit Attendance</button>
        </div>

        <div className="card">
          <h2 className="mb-4">Today's Attendance</h2>
          <button className="btn btn-primary mb-2" onClick={fetchAttendance}>Refresh</button>
          <table className="table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr><td colSpan="2">No records found for today.</td></tr>
              ) : (
                attendanceRecords.map((r, i) => (
                  <tr key={i}>
                    <td>{r.studentId}</td>
                    <td>
                      <span className={`badge ${r.present ? 'badge-approved' : 'badge-rejected'}`}>
                        {r.present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
