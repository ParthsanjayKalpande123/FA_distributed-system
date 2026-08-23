'use client';
import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export default function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch users (mock endpoint from backend)
    // For this, we'll assume GET /api/users returns an array of users
    const fetchUsers = async () => {
      try {
        const data = await apiRequest('/api/users');
        if (data && Array.isArray(data)) {
           setUsers(data);
           if (data.length > 0) setSelectedUser(data[0].userId);
        } else {
           // Fallback if no backend users endpoint
           setUsers([
             { userId: 't1', name: 'Dr. Smith', role: 'teacher' },
             { userId: 's1', name: 'Alice Student', role: 'student' },
             { userId: 'h1', name: 'Prof. Johnson', role: 'hod' },
             { userId: 'a1', name: 'System Admin', role: 'admin' }
           ]);
           setSelectedUser('t1');
        }
      } catch (err) {
        console.error(err);
        setUsers([
             { userId: 't1', name: 'Dr. Smith', role: 'teacher' },
             { userId: 's1', name: 'Alice Student', role: 'student' },
             { userId: 'h1', name: 'Prof. Johnson', role: 'hod' },
             { userId: 'a1', name: 'System Admin', role: 'admin' }
        ]);
        setSelectedUser('t1');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleLogin = () => {
    const user = users.find(u => u.userId === selectedUser);
    if (user) {
      localStorage.setItem('campuswatch_user', JSON.stringify(user));
      window.location.href = `/${user.role}`;
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container" style={{ marginTop: '10vh' }}>
      <div className="card" style={{ maxWidth: '400px', margin: 'auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>CampusWatch</h1>
        <p className="mb-4" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          Distributed Attendance & Booking System
        </p>

        <div className="form-group">
          <label className="form-label">Select User to Login</label>
          <select 
            className="form-select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            {users.map(u => (
              <option key={u.userId} value={u.userId}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    </div>
  );
}
