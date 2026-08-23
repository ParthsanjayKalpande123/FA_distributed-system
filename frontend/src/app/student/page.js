'use client';
import { useState, useEffect } from 'react';
import { apiRequest, getUser } from '../../lib/api';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [resource, setResource] = useState('Lab-1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('09:00-10:00');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'student') {
      window.location.href = '/';
      return;
    }
    setUser(u);
    fetchBookings(u.userId);

    const interval = setInterval(() => fetchBookings(u.userId), 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBookings = async (userId) => {
    try {
      const data = await apiRequest(`/api/booking?requestedBy=${userId}`);
      if (Array.isArray(data)) {
        setBookings(data);
      } else if (data.data && Array.isArray(data.data)) {
        setBookings(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    try {
      await apiRequest('/api/booking', {
        method: 'POST',
        body: JSON.stringify({
          resource,
          date,
          timeSlot,
          requestedBy: user.userId
        })
      });
      showToast('Booking requested successfully!');
      fetchBookings(user.userId);
    } catch (err) {
      showToast('Error requesting booking', 'error');
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
        <h1>Student Dashboard</h1>
        <div className="nav-info">
          <span>{user.name}</span>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="mb-4">Book a Resource</h2>
          <div className="form-group">
            <label className="form-label">Resource</label>
            <select className="form-select" value={resource} onChange={e => setResource(e.target.value)}>
              <option value="Lab-1">Lab-1</option>
              <option value="Lab-2">Lab-2</option>
              <option value="Seminar Hall A">Seminar Hall A</option>
              <option value="Seminar Hall B">Seminar Hall B</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Time Slot</label>
            <select className="form-select" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
              <option value="09:00-10:00">09:00-10:00</option>
              <option value="10:00-11:00">10:00-11:00</option>
              <option value="11:00-12:00">11:00-12:00</option>
              <option value="12:00-13:00">12:00-13:00</option>
              <option value="14:00-15:00">14:00-15:00</option>
              <option value="15:00-16:00">15:00-16:00</option>
              <option value="16:00-17:00">16:00-17:00</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSubmit}>Submit Booking Request</button>
        </div>

        <div className="card">
          <h2 className="mb-4">My Bookings</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Date / Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan="3">No bookings found.</td></tr>
              ) : (
                bookings.map((b, i) => (
                  <tr key={i}>
                    <td>{b.resource}</td>
                    <td>{b.date} <br/><small className="text-muted">{b.timeSlot}</small></td>
                    <td>
                      <span className={`badge badge-${b.status || 'pending'}`}>
                        {(b.status || 'pending').toUpperCase()}
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
