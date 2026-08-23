'use client';
import { useState, useEffect } from 'react';
import { apiRequest, getUser } from '../../lib/api';

export default function HodDashboard() {
  const [user, setUser] = useState(null);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'hod') {
      window.location.href = '/';
      return;
    }
    setUser(u);
    fetchData();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      const pendingData = await apiRequest('/api/booking?status=pending');
      const allData = await apiRequest('/api/booking');
      
      setPendingBookings(Array.isArray(pendingData) ? pendingData : (pendingData.data || []));
      setAllBookings(Array.isArray(allData) ? allData : (allData.data || []));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async (id, decision) => {
    try {
      await apiRequest(`/api/booking/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          decidedBy: user.userId
        })
      });
      showToast(`Booking ${decision} successfully!`);
      fetchData();
    } catch (err) {
      showToast('Error updating booking', 'error');
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
        <h1>HOD Dashboard</h1>
        <div className="nav-info">
          <span>{user.name}</span>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="mb-4">Pending Booking Requests</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Date / Time</th>
              <th>Requested By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingBookings.length === 0 ? (
              <tr><td colSpan="4">No pending requests.</td></tr>
            ) : (
              pendingBookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.resource}</td>
                  <td>{b.date} <br/><small className="text-muted">{b.timeSlot}</small></td>
                  <td>{b.requestedBy}</td>
                  <td>
                    <div className="gap-2">
                      <button className="btn btn-success" onClick={() => handleAction(b.id, 'approved')}>Approve</button>
                      <button className="btn btn-danger" onClick={() => handleAction(b.id, 'rejected')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="mb-4">All Bookings</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Date / Time</th>
              <th>Requested By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allBookings.length === 0 ? (
              <tr><td colSpan="4">No bookings found.</td></tr>
            ) : (
              allBookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.resource}</td>
                  <td>{b.date} <br/><small className="text-muted">{b.timeSlot}</small></td>
                  <td>{b.requestedBy}</td>
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
  );
}
