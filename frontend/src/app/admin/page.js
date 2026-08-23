'use client';
import { useState, useEffect, useRef } from 'react';
import { getUser } from '../../lib/api';
import { useWebSocket } from '../../lib/useWebSocket';

const NODES = [
  { id: 'node-a', port: 3001, name: 'Node A' },
  { id: 'node-b', port: 3002, name: 'Node B' },
  { id: 'node-c', port: 3003, name: 'Node C' }
];

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [nodeHealth, setNodeHealth] = useState({});
  const { clusterState, events, connected } = useWebSocket(3001); // Connect to Node A's WS by default
  const feedEndRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    setUser(u);

    // Poll health directly from all nodes
    const pollHealth = async () => {
      const healthData = {};
      for (const node of NODES) {
        try {
          // Note: using localhost directly for direct client->node requests bypassing proxy
          const res = await fetch(`http://localhost:${node.port}/health`, { method: 'GET' });
          if (res.ok) {
            const data = await res.json();
            healthData[node.id] = { status: 'alive', data };
          } else {
            healthData[node.id] = { status: 'dead' };
          }
        } catch (e) {
          healthData[node.id] = { status: 'dead' };
        }
      }
      setNodeHealth(healthData);
    };

    pollHealth();
    const interval = setInterval(pollHealth, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  const handleCrash = async (port) => {
    try {
      await fetch(`http://localhost:${port}/api/simulate-crash`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('campuswatch_user');
    window.location.href = '/';
  };

  if (!user) return null;

  return (
    <div className="container">
      {connected ? (
        <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          🟢 Connected to cluster
        </div>
      ) : (
        <div className="pulse" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          🔴 Disconnected — reconnecting...
        </div>
      )}

      <div className="header">
        <h1>Admin Dashboard — Cluster Monitor</h1>
        <div className="nav-info">
          <span>{user.name}</span>
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="grid-3 mb-4">
        {NODES.map(node => {
          const health = nodeHealth[node.id];
          const isAlive = health && health.status === 'alive';
          const isLeader = health && health.data && health.data.state === 'leader';
          
          return (
            <div key={node.id} className={`card node-card ${isLeader ? 'leader' : (isAlive ? 'follower' : 'dead')}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>{node.name}</h2>
                <span className={`badge ${isLeader ? 'badge-pending' : 'badge-approved'}`} style={{ backgroundColor: isLeader ? 'var(--primary)' : 'var(--text-muted)', color: 'white' }}>
                  {isAlive ? (isLeader ? 'Leader' : 'Follower') : 'Dead'}
                </span>
              </div>
              
              <div className="mb-4">
                <div><span className={`status-dot ${isAlive ? 'alive' : 'dead'}`}></span>{isAlive ? 'Alive' : 'Dead'}</div>
                {isAlive && health.data && (
                  <div className="mt-2 text-muted" style={{ fontSize: '0.9rem' }}>
                    <div>Term: {health.data.currentTerm}</div>
                    <div>Log Length: {health.data.logLength || 0}</div>
                    <div>Commit Index: {health.data.commitIndex}</div>
                  </div>
                )}
              </div>

              <button 
                className="btn btn-danger" 
                style={{ width: '100%' }}
                onClick={() => handleCrash(node.port)}
                disabled={!isAlive}
              >
                {isAlive ? 'Kill Node' : 'Node Stopped'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid-2 gap-2">
        <div className="card">
          <h2 className="mb-4">Live Event Feed</h2>
          <div className="log-feed">
            {events.length === 0 ? (
              <div className="log-entry">Waiting for events...</div>
            ) : (
              events.map((ev, i) => (
                <div key={i} className="log-entry">{ev}</div>
              ))
            )}
            <div ref={feedEndRef} />
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4">Communication Channels</h2>
          <table className="table mb-4">
            <tbody>
              <tr>
                <td><strong>Raft RPC</strong></td>
                <td><span className="badge badge-approved">Active</span></td>
              </tr>
              <tr>
                <td><strong>WebSocket</strong></td>
                <td>
                  <span className={`badge ${connected ? 'badge-approved' : 'badge-rejected'}`}>
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Redis Pub/Sub</strong></td>
                <td><span className="badge badge-approved">Active</span></td>
              </tr>
              <tr>
                <td><strong>Gossip</strong></td>
                <td><span className="badge badge-approved">Active</span></td>
              </tr>
            </tbody>
          </table>

          <h2 className="mb-4 mt-4">Replication Status</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Log Length</th>
                <th>Commit Index</th>
              </tr>
            </thead>
            <tbody>
              {NODES.map(node => {
                const data = nodeHealth[node.id]?.data;
                return (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>{data ? (data.logLength || 0) : '-'}</td>
                    <td>{data ? (data.commitIndex || 0) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
