'use client';
import { useState, useEffect, useRef } from 'react';
import { apiRequest, getUser } from '../../lib/api';
import { useWebSocket } from '../../lib/useWebSocket';
import { AdminSystems } from '../../components/dashboard/WorkflowCapabilities';

/* ── SVG Icons ──────────────────────────────────────────── */
const Icons = {
  Monitor: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  Radio: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Zap: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Ban: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ),
};

const NODES = [
  { id: 'node-a', port: 3001, name: 'Node A' },
  { id: 'node-b', port: 3002, name: 'Node B' },
  { id: 'node-c', port: 3003, name: 'Node C' },
];

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
        <div className="user-avatar admin-av">
          {user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div className="user-name">{user.name}</div>
        <div className="user-role">System Administrator &middot; {user.userId}</div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-link active">
          <span className="nav-icon"><Icons.Monitor /></span>
          Cluster Monitor
        </span>
        <span className="nav-link">
          <span className="nav-icon"><Icons.Radio /></span>
          Event Log
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

export default function AdminDashboard() {
  const [user, setUser]         = useState(null);
  const [nodeHealth, setNodeHealth] = useState({});
  const [failedNode, setFailedNode] = useState('');
  const [electionResults, setElectionResults] = useState(null);
  const [snapshotResult, setSnapshotResult] = useState(null);
  const [demoLoading, setDemoLoading] = useState('');
  const { events, connected }   = useWebSocket();
  const feedEndRef              = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'admin') { window.location.href = '/'; return; }
    setUser(u);

    const pollHealth = async () => {
      const result = {};
      await Promise.all(NODES.map(async node => {
        try {
          const res = await fetch(`http://${location.hostname}:${node.port}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) {
            result[node.id] = { status: 'alive', data: await res.json() };
          } else {
            result[node.id] = { status: 'dead' };
          }
        } catch {
          result[node.id] = { status: 'dead' };
        }
      }));
      setNodeHealth(result);
    };

    pollHealth();
    const iv = setInterval(pollHealth, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleRecover = async (port) => {
    try {
      await fetch(`http://${location.hostname}:${port}/api/simulate-recover`, { method: 'POST' });
    } catch { /* container itself is down: restart it with docker compose start */ }
  };

  const handleCrash = async (port) => {
    try {
      await fetch(`http://${location.hostname}:${port}/api/simulate-crash`, { method: 'POST' });
    } catch { /* node may go down before responding */ }
  };

  const compareElections = async () => {
    setDemoLoading('election');
    setElectionResults(null);
    try {
      const result = await apiRequest('/api/elections/compare', {
        method: 'POST',
        body: JSON.stringify({ failedNode: failedNode || null }),
      });
      if (result.error) throw new Error(result.error);
      setElectionResults(result);
    } catch (error) {
      setElectionResults({ error: error.message });
    } finally {
      setDemoLoading('');
    }
  };

  const captureSnapshot = async () => {
    setDemoLoading('snapshot');
    setSnapshotResult(null);
    try {
      const result = await apiRequest('/api/snapshots/capture', { method: 'POST' });
      if (result.error) throw new Error(result.error);
      setSnapshotResult(result);
    } catch (error) {
      setSnapshotResult({ error: error.message });
    } finally {
      setDemoLoading('');
    }
  };

  if (!user) return null;

  const aliveCount  = NODES.filter(n => nodeHealth[n.id]?.status === 'alive').length;
  const leader      = NODES.find(n => nodeHealth[n.id]?.data?.state === 'leader');
  const currentTerm = leader ? nodeHealth[leader.id]?.data?.currentTerm : '—';

  const CHANNELS = [
    { name: 'Raft RPC',      desc: 'RequestVote & AppendEntries',   status: 'active' },
    { name: 'WebSocket',     desc: 'Live cluster events to admin',  status: connected ? 'active' : 'down' },
    { name: 'Redis Pub/Sub', desc: 'Booking notifications',         status: 'active' },
    { name: 'Gossip',        desc: 'Peer liveness detection',       status: 'active' },
  ];

  return (
    <div className="app-layout">
      <Sidebar user={user} />

      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Admin — Cluster Monitor</span>
          <div className="topbar-right">
            <span className={`badge ${connected ? 'badge-approved' : 'badge-rejected'} ${!connected ? 'pulse' : ''}`}>
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        <div className="page-body">
          {/* Cluster summary */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">Nodes Online</div>
              <div className="stat-value" style={{ color: aliveCount === 3 ? 'var(--success)' : aliveCount > 0 ? 'var(--warning)' : 'var(--danger)' }}>
                {aliveCount}/3
              </div>
              <div className="stat-sub">Raft cluster health</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Current Leader</div>
              <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>
                {leader ? leader.name : 'None'}
              </div>
              <div className="stat-sub">Elected by majority</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Current Term</div>
              <div className="stat-value">{currentTerm}</div>
              <div className="stat-sub">Raft election term</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">WebSocket</div>
              <div className="stat-value" style={{ fontSize: '1rem', color: connected ? 'var(--success)' : 'var(--danger)' }}>
                {connected ? 'Connected' : 'Reconnecting'}
              </div>
              <div className="stat-sub">Real-time channel</div>
            </div>
          </div>

          {/* Node cards */}
          <div className="grid-3 mb-4">
            {NODES.map(node => {
              const h        = nodeHealth[node.id];
              const isAlive  = h?.status === 'alive';
              const isLeader = h?.data?.state === 'leader';
              const cardClass  = isLeader ? 'leader' : isAlive ? 'follower' : 'dead';
              const stateBadge = isLeader ? 'badge-leader' : isAlive ? 'badge-follower' : 'badge-dead';
              const stateText  = isLeader ? 'Leader' : isAlive ? 'Follower' : 'Dead';

              return (
                <div key={node.id} className={`node-card ${cardClass}`}>
                  <div className="node-card-title">
                    <span>{node.name}</span>
                    <span className={`badge ${stateBadge}`}>{stateText}</span>
                  </div>

                  <div className="node-meta">
                    <div className="node-meta-row">
                      <span className="key">Status</span>
                      <span className="val">
                        <span className={`status-dot ${isAlive ? 'alive' : 'dead'}`} />
                        {isAlive ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    {isAlive && h.data && (<>
                      <div className="node-meta-row">
                        <span className="key">Term</span>
                        <span className="val">{h.data.currentTerm}</span>
                      </div>
                      <div className="node-meta-row">
                        <span className="key">Log Length</span>
                        <span className="val">{h.data.logLength || 0}</span>
                      </div>
                      <div className="node-meta-row">
                        <span className="key">Commit Index</span>
                        <span className="val">{h.data.commitIndex}</span>
                      </div>
                      <div className="node-meta-row">
                        <span className="key">Port</span>
                        <span className="val">{node.port}</span>
                      </div>
                    </>)}
                  </div>

                  <button
                    className={`btn btn-block btn-sm ${isAlive ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => isAlive ? handleCrash(node.port) : handleRecover(node.port)}
                  >
                    {isAlive ? (
                      <><Icons.Zap /> Simulate Crash</>
                    ) : (
                      <><Icons.Ban /> Recover Node</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Algorithm comparison and consistent global snapshot demos */}
          <div className="grid-2 mb-4">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Leader Election Comparison</div>
                  <div className="card-subtitle">Compare modeled election outcomes using the cluster’s current reachability</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="election-failed-node">Simulated failed node</label>
                <select
                  id="election-failed-node"
                  className="form-select"
                  value={failedNode}
                  onChange={event => setFailedNode(event.target.value)}
                >
                  <option value="">None</option>
                  {NODES.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={compareElections} disabled={!!demoLoading}>
                {demoLoading === 'election' ? 'Comparing...' : 'Compare Algorithms'}
              </button>
              {electionResults?.error && <div className="alert alert-error mt-3">{electionResults.error}</div>}
              {electionResults?.results && (
                <>
                  <p className="text-muted mt-3">{electionResults.note}</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Algorithm</th><th>Winner</th><th>Messages</th><th>Est. time</th><th>Outcome</th></tr>
                      </thead>
                      <tbody>
                        {electionResults.results.map(result => (
                          <tr key={result.algorithm}>
                            <td>{result.algorithm}{result.implementedInCluster ? ' *' : ''}</td>
                            <td>{result.electedLeader || 'No leader'}</td>
                            <td>{result.messageCount}</td>
                            <td>{result.estimatedDurationMs} ms</td>
                            <td>{result.success ? result.details : 'No majority quorum'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-muted">Only Raft runs in the cluster. Bully and Ring are simulations; all durations are estimates, not live measurements.</div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Distributed Global-State Snapshot</div>
                  <div className="card-subtitle">Capture a consistent cut from the common applied Raft log prefix</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={captureSnapshot} disabled={!!demoLoading}>
                {demoLoading === 'snapshot' ? 'Capturing...' : 'Capture Global Snapshot'}
              </button>
              {snapshotResult?.error && <div className="alert alert-error mt-3">{snapshotResult.error}</div>}
              {snapshotResult?.globalState && (
                <div className="mt-3">
                  <div className="channel-row">
                    <div><div className="channel-name">Consistent cut</div><div className="text-muted">Applied log prefix index</div></div>
                    <span className="badge badge-info">{snapshotResult.cutIndex}</span>
                  </div>
                  <div className="channel-row">
                    <div><div className="channel-name">Participating nodes</div><div className="text-muted">{snapshotResult.participatingNodes.map(node => node.nodeId).join(', ') || 'None'}</div></div>
                    <span className="badge badge-approved">{snapshotResult.participatingNodes.length}</span>
                  </div>
                  {snapshotResult.unavailableNodes.length > 0 && (
                    <div className="alert alert-error mt-3">
                      Unavailable nodes: {snapshotResult.unavailableNodes.map(node => node.nodeId).join(', ')}
                    </div>
                  )}
                  <div className="channel-row">
                    <div className="channel-name">Attendance records</div>
                    <span>{snapshotResult.globalState.attendanceRecords}</span>
                  </div>
                  <div className="channel-row">
                    <div className="channel-name">Bookings</div>
                    <span>{snapshotResult.globalState.bookings.total} total · {snapshotResult.globalState.bookings.pending} pending · {snapshotResult.globalState.bookings.approved} approved</span>
                  </div>
                  <div className="channel-row">
                    <div className="channel-name">Files</div>
                    <span>{snapshotResult.globalState.files.totalFiles} · {snapshotResult.globalState.files.totalSize} bytes</span>
                  </div>
                  <p className="text-muted mt-3">{snapshotResult.explanation}</p>
                </div>
              )}
            </div>
          </div>

          <AdminSystems />

          {/* Bottom row */}
          <div className="grid-2">
            {/* Live event feed */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Live Event Feed</div>
                  <div className="card-subtitle">Real-time WebSocket stream from cluster</div>
                </div>
                <span className="badge badge-info">{events.length} events</span>
              </div>
              <div className="log-feed">
                {events.length === 0 ? (
                  <div style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Waiting for cluster events...</div>
                ) : (
                  events.map((ev, i) => (
                    <div className="log-entry" key={i}>{ev}</div>
                  ))
                )}
                <div ref={feedEndRef} />
              </div>
            </div>

            {/* Communication channels + replication */}
            <div>
              <div className="card mb-3">
                <div className="card-header">
                  <div className="card-title">Communication Channels</div>
                </div>
                {CHANNELS.map(ch => (
                  <div className="channel-row" key={ch.name}>
                    <div>
                      <div className="channel-name">{ch.name}</div>
                      <div className="text-muted">{ch.desc}</div>
                    </div>
                    <span className={`badge ${ch.status === 'active' ? 'badge-approved' : 'badge-rejected'}`}>
                      {ch.status === 'active' ? 'Active' : 'Down'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Replication Status</div>
                  <div className="card-subtitle">Per-node log &amp; commit state</div>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>Node</th><th>Log</th><th>Commit</th><th>State</th></tr>
                  </thead>
                  <tbody>
                    {NODES.map(node => {
                      const d = nodeHealth[node.id]?.data;
                      const isAlive = nodeHealth[node.id]?.status === 'alive';
                      return (
                        <tr key={node.id}>
                          <td className="fw-600">{node.name}</td>
                          <td>{d ? d.logLength || 0 : '—'}</td>
                          <td>{d ? d.commitIndex : '—'}</td>
                          <td>
                            <span className={`status-dot ${isAlive ? 'alive' : 'dead'}`} />
                            <span className="text-muted">{d?.state ?? 'offline'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
