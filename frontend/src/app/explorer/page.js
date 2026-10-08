'use client';
import { useState, useEffect } from 'react';
import { getUser } from '../../lib/api';

const Icons = {
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
};

export default function ExplorerPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(1);
  const [toast, setToast] = useState(null);

  // Tab 1 state
  const [chainValid, setChainValid] = useState(null);
  const [chainEntries, setChainEntries] = useState([]);
  
  // Tab 2 state
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileOwner, setFileOwner] = useState('');
  const [files, setFiles] = useState([]);
  const [fileStats, setFileStats] = useState({ totalFiles: 0, totalSize: 0 });
  const [viewedFile, setViewedFile] = useState(null);

  // Tab 3 state
  const [jobResult, setJobResult] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);

  // Tab 4 state
  const [services, setServices] = useState([]);
  const [invokeTarget, setInvokeTarget] = useState('node-a');
  const [invokeService, setInvokeService] = useState('attendance');
  const [invokeMethod, setInvokeMethod] = useState('');
  const [invokeArgs, setInvokeArgs] = useState('{}');
  const [invokeResult, setInvokeResult] = useState(null);

  // Tab 5 state
  const [faasFunctions, setFaasFunctions] = useState([]);
  const [faasExecutions, setFaasExecutions] = useState([]);
  const [customFnName, setCustomFnName] = useState('');
  const [customFnCode, setCustomFnCode] = useState(`return { message: 'Hello from serverless!', time: new Date().toISOString() };`);
  const [customFnOwner, setCustomFnOwner] = useState('');
  const [faasResult, setFaasResult] = useState(null);

  // Tab 6 state
  const [gwMethod, setGwMethod] = useState('GET');
  const [gwPath, setGwPath] = useState('/api/attendance?date=2026-10-05');
  const [gwBody, setGwBody] = useState('');
  const [gwResult, setGwResult] = useState(null);
  const [gwMetrics, setGwMetrics] = useState({ totalRequests: 0, nodeStats: {}, cacheHitRate: 0 });
  const [gwCache, setGwCache] = useState({ size: 0, hits: 0, misses: 0, hitRate: 0, entries: [] });
  const [gwCircuitBreakers, setGwCircuitBreakers] = useState({});

  // Tab 7 state
  const [capStatus, setCapStatus] = useState({ mode: 'CP', partitionedNodes: [], quorum: true, explanation: '' });
  const [capComparison, setCapComparison] = useState([]);
  const [capLog, setCapLog] = useState([]);
  const [capTestResult, setCapTestResult] = useState(null);
  const [capTestCommand, setCapTestCommand] = useState(JSON.stringify({ type: 'MARK_ATTENDANCE', studentId: 'CAP-TEST', date: '2026-10-05', present: true, markedBy: 'CAP-DEMO' }, null, 2));


  useEffect(() => {
    const u = getUser();
    if (!u) { window.location.href = '/'; return; }
    setUser(u);
    setFileOwner(u.userId);
    setCustomFnOwner(u.userId);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('campuswatch_user');
    window.location.href = '/';
  };

  // --- Tab 1 Methods ---
  const verifyChain = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/blockchain/verify');
      const data = await res.json();
      setChainValid(data);
      if(data.valid) showToast('Chain is valid');
      else showToast('Chain is invalid', 'error');
    } catch (err) {
      showToast('Error verifying chain', 'error');
    }
  };

  const loadChain = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/blockchain/chain');
      const data = await res.json();
      setChainEntries(data.chain || []);
      showToast('Chain loaded');
    } catch (err) {
      showToast('Error loading chain', 'error');
    }
  };

  // --- Tab 2 Methods ---
  const loadFiles = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {}
  };

  const loadFileStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/files/stats');
      const data = await res.json();
      setFileStats(data);
    } catch (err) {}
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileName || !fileContent) return showToast('Filename and content required', 'error');
    try {
      const payload = {
        name: fileName,
        content: btoa(fileContent),
        owner: fileOwner,
        mimeType: 'text/plain',
        size: fileContent.length
      };
      const res = await fetch('http://localhost:3001/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('File uploaded successfully');
        setFileName('');
        setFileContent('');
        loadFiles();
        loadFileStats();
      } else {
        const error = await res.json();
        showToast(error.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Error uploading file', 'error');
    }
  };

  const handleDeleteFile = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('File deleted');
        loadFiles();
        loadFileStats();
      }
    } catch (err) {
      showToast('Error deleting file', 'error');
    }
  };

  // --- Tab 3 Methods ---
  const runJob = async (jobType) => {
    setJobLoading(true);
    setJobResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/mapreduce/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType })
      });
      const data = await res.json();
      setJobResult(data);
      showToast('Job completed');
    } catch (err) {
      showToast('Error running job', 'error');
    } finally {
      setJobLoading(false);
    }
  };

  // --- Tab 4 Methods ---
  const discoverServices = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/discover');
      const data = await res.json();
      setServices(data.registry || []);
      showToast('Services discovered');
    } catch (err) {
      showToast('Error discovering services', 'error');
    }
  };

  const invokeRemote = async (e) => {
    e.preventDefault();
    try {
      const parsedArgs = JSON.parse(invokeArgs || '{}');
      const res = await fetch('http://localhost:3001/api/services/invoke-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetNodeId: invokeTarget,
          serviceName: invokeService,
          methodName: invokeMethod,
          args: parsedArgs
        })
      });
      const data = await res.json();
      setInvokeResult(data);
      showToast('Invocation completed');
    } catch (err) {
      showToast('Invalid JSON arguments or invocation failed', 'error');
    }
  };

  // --- Tab 5 Methods ---
  const loadFaasFunctions = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/faas/functions');
      const data = await res.json();
      setFaasFunctions(data.functions || []);
    } catch (err) { console.error(err); }
  };
  const loadFaasExecutions = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/faas/executions');
      const data = await res.json();
      setFaasExecutions(data.executions || []);
    } catch (err) { console.error(err); }
  };
  const registerFunction = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/faas/functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customFnName, code: customFnCode, owner: customFnOwner })
      });
      if (res.ok) {
        showToast('Function registered');
        setCustomFnName('');
        loadFaasFunctions();
      } else {
        showToast('Failed to register function', 'error');
      }
    } catch (err) {
      showToast('Error registering function', 'error');
    }
  };
  const invokeFunction = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/faas/invoke/${id}`, { method: 'POST' });
      const data = await res.json();
      setFaasResult(data);
      loadFaasExecutions();
      showToast('Function invoked');
    } catch (err) {
      showToast('Error invoking function', 'error');
    }
  };

  // --- Tab 6 Methods ---
  const loadGatewayMetrics = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/gateway/metrics');
      setGwMetrics(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadGatewayCache = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/gateway/cache');
      setGwCache(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadGatewayCBs = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/gateway/circuit-breakers');
      setGwCircuitBreakers(await res.json());
    } catch (err) { console.error(err); }
  };
  const routeGatewayRequest = async (e) => {
    e.preventDefault();
    try {
      const payload = { method: gwMethod, path: gwPath };
      if (gwMethod !== 'GET' && gwBody) payload.body = JSON.parse(gwBody);
      const res = await fetch('http://localhost:3001/api/gateway/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setGwResult(await res.json());
      showToast('Request routed via gateway');
      loadGatewayMetrics();
      loadGatewayCache();
      loadGatewayCBs();
    } catch (err) {
      showToast('Error routing request', 'error');
    }
  };
  const clearGatewayCache = async () => {
    try {
      await fetch('http://localhost:3001/api/gateway/cache/clear', { method: 'POST' });
      showToast('Cache cleared');
      loadGatewayCache();
      loadGatewayMetrics();
    } catch (err) { showToast('Error clearing cache', 'error'); }
  };
  const resetGatewayCBs = async () => {
    try {
      await fetch('http://localhost:3001/api/gateway/circuit-breakers/reset', { method: 'POST' });
      showToast('Circuit breakers reset');
      loadGatewayCBs();
      loadGatewayMetrics();
    } catch (err) { showToast('Error resetting circuit breakers', 'error'); }
  };

  // --- Tab 7 Methods ---
  const loadCapStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/cap/status');
      setCapStatus(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadCapComparison = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/cap/comparison');
      setCapComparison(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadCapLog = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/cap/log');
      const data = await res.json();
      setCapLog(data.log || []);
    } catch (err) { console.error(err); }
  };
  const switchCapMode = async (mode) => {
    try {
      await fetch('http://localhost:3001/api/cap/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      showToast(`Switched to ${mode} mode`);
      loadCapStatus();
      loadCapLog();
    } catch (err) { showToast('Error switching mode', 'error'); }
  };
  const partitionNode = async (nodeId) => {
    try {
      await fetch('http://localhost:3001/api/cap/partition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId })
      });
      showToast(`Node ${nodeId} partitioned`);
      loadCapStatus();
      loadCapLog();
    } catch (err) { showToast('Error partitioning node', 'error'); }
  };
  const healPartitions = async () => {
    try {
      await fetch('http://localhost:3001/api/cap/heal', { method: 'POST' });
      showToast('Partitions healed');
      loadCapStatus();
      loadCapLog();
    } catch (err) { showToast('Error healing partitions', 'error'); }
  };
  const testCapWrite = async () => {
    try {
      const cmd = JSON.parse(capTestCommand);
      const res = await fetch('http://localhost:3001/api/cap/test-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      setCapTestResult(await res.json());
      showToast('Test write completed');
      loadCapLog();
    } catch (err) { showToast('Error performing test write', 'error'); }
  };


  useEffect(() => {
    if (activeTab === 2) { loadFiles(); loadFileStats(); }
    if (activeTab === 5) { loadFaasFunctions(); loadFaasExecutions(); }
    if (activeTab === 6) { loadGatewayMetrics(); loadGatewayCache(); loadGatewayCBs(); }
    if (activeTab === 7) { loadCapStatus(); loadCapComparison(); loadCapLog(); }
  }, [activeTab]);

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="app-layout">
      <div className="main-content" style={{ marginLeft: 0 }}>
        {/* Header */}
        <div className="topbar">
          <span className="topbar-title">Unit IV Explorer — Distributed Paradigms</span>
          <div className="topbar-right">
            <span className="user-name" style={{ marginRight: '1rem' }}>{user.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <Icons.LogOut /> Logout
            </button>
          </div>
        </div>

        <div className="page-body">
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button className={`btn ${activeTab === 1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(1)}>🔗 Blockchain / DLT</button>
            <button className={`btn ${activeTab === 2 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(2)}>📁 Distributed File System</button>
            <button className={`btn ${activeTab === 3 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(3)}>🗺️ MapReduce (Hadoop)</button>
            <button className={`btn ${activeTab === 4 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(4)}>🏗️ Service Registry</button>
            <button className={`btn ${activeTab === 5 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(5)}>⚡ Serverless / FaaS</button>
            <button className={`btn ${activeTab === 6 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(6)}>🌐 API Gateway</button>
            <button className={`btn ${activeTab === 7 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(7)}>⚖️ CAP Theorem</button>
          </div>

          {/* Tab 1: Blockchain / DLT */}
          {activeTab === 1 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Each Raft log entry is hash-chained using SHA-256. The hash of each entry includes the previous entry's hash, creating a tamper-evident distributed ledger — the same principle behind blockchain.
              </div>
              
              <div className="mb-4 gap-2">
                <button className="btn btn-primary" onClick={verifyChain}>Verify Chain Integrity</button>
                <button className="btn btn-ghost" onClick={loadChain}>Load Full Chain</button>
              </div>

              {chainValid && (
                <div className={`alert ${chainValid.valid ? 'alert-success' : 'alert-error'}`}>
                  {chainValid.valid ? `✅ Chain Valid (Total entries: ${chainValid.totalEntries})` : `❌ Chain Broken at index ${chainValid.brokenAtIndex}`}
                </div>
              )}

              {chainEntries.length > 0 && (
                <div className="card">
                  <table className="table">
                    <thead>
                      <tr><th>Index</th><th>Term</th><th>Command Type</th><th>Hash</th><th>Prev Hash</th><th>Timestamp</th></tr>
                    </thead>
                    <tbody>
                      {chainEntries.map((entry, idx) => (
                        <tr key={idx}>
                          <td>{entry.index}</td>
                          <td>{entry.term}</td>
                          <td>{entry.command?.type || 'N/A'}</td>
                          <td style={{ fontFamily: 'monospace', background: '#f5f7fa' }}>{(entry.hash || '').substring(0, 16)}...</td>
                          <td style={{ fontFamily: 'monospace', background: '#f5f7fa' }}>{(entry.prevHash || '').substring(0, 16)}...</td>
                          <td>{new Date(entry.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: DFS */}
          {activeTab === 2 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Files are replicated across all nodes via Raft consensus. Upload on any node — read from any node. This demonstrates a simplified distributed file system.
              </div>
              
              <div className="grid-2 mb-4">
                <div className="card">
                  <div className="card-header"><div className="card-title">Upload File</div></div>
                  <form onSubmit={handleUpload}>
                    <div className="form-group">
                      <label className="form-label">File Name</label>
                      <input className="form-input" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. document.txt" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Content</label>
                      <textarea className="form-input" rows="4" value={fileContent} onChange={e => setFileContent(e.target.value)} placeholder="Enter plain text content..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Owner</label>
                      <select className="form-select" value={fileOwner} onChange={e => setFileOwner(e.target.value)}>
                        <option value="T001">Dr. Sharma (T001)</option>
                        <option value="T002">Dr. Patel (T002)</option>
                        <option value="S001">Rahul Kumar (S001)</option>
                        <option value="HOD001">Prof. Iyer (HOD001)</option>
                        <option value="ADMIN001">System Admin (ADMIN001)</option>
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary">Upload File</button>
                  </form>
                </div>

                <div className="stat-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginBottom: 0 }}>
                  <div className="stat-card">
                    <div className="stat-label">File System Stats</div>
                    <div className="stat-value">{fileStats.totalFiles} <span style={{ fontSize: '1rem' }}>files</span></div>
                    <div className="stat-sub">Total size: {fileStats.totalSize} bytes</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">Files Explorer</div></div>
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Owner</th><th>Size</th><th>Created At</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.id}>
                        <td>{f.name}</td>
                        <td>{f.owner}</td>
                        <td>{f.size} bytes</td>
                        <td>{new Date(f.createdAt).toLocaleString()}</td>
                        <td className="gap-2">
                          <button className="btn btn-sm btn-ghost" onClick={() => setViewedFile(f)}>View</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteFile(f.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && <tr><td colSpan="5" className="text-center text-muted">No files found.</td></tr>}
                  </tbody>
                </table>
              </div>

              {viewedFile && (
                <div className="card mt-4 fade-in">
                  <div className="card-header">
                    <div className="card-title">Viewing: {viewedFile.name}</div>
                    <button className="btn btn-sm btn-ghost" onClick={() => setViewedFile(null)}>Close</button>
                  </div>
                  <pre style={{ background: '#f5f7fa', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
                    {atob(viewedFile.content)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: MapReduce */}
          {activeTab === 3 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Inspired by Apache Hadoop's MapReduce paradigm. The leader node distributes 'map' tasks to all nodes in the cluster, collects partial results, then 'reduces' them into an aggregated answer.
              </div>

              <div className="grid-2 mb-4">
                {['attendance-summary', 'booking-analytics', 'file-stats', 'cluster-health'].map(job => (
                  <div className="card" key={job}>
                    <div className="card-title mb-2" style={{ textTransform: 'capitalize' }}>{job.replace('-', ' ')}</div>
                    <button className="btn btn-primary" onClick={() => runJob(job)} disabled={jobLoading}>
                      {jobLoading ? 'Running...' : 'Run Job'}
                    </button>
                  </div>
                ))}
              </div>

              {jobResult && (
                <div className="card fade-in">
                  <div className="card-header"><div className="card-title">Job Results</div></div>
                  <div className="grid-3 mb-3">
                    <div className="stat-card">
                      <div className="stat-label">Duration</div>
                      <div className="stat-value" style={{ fontSize: '1.25rem' }}>{jobResult.durationMs} ms</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Nodes Responded</div>
                      <div className="stat-value" style={{ fontSize: '1.25rem' }}>{jobResult.metrics?.nodesResponded} / {jobResult.metrics?.nodesQueried}</div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <span className="fw-600 mb-1 d-block">Nodes:</span>
                    <div className="gap-2">
                      {jobResult.metrics?.respondedNodeIds?.map(n => <span key={n} className="badge badge-approved">{n}</span>)}
                    </div>
                  </div>

                  <div className="fw-600 mb-1">Aggregated Data:</div>
                  <pre style={{ background: '#f5f7fa', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem' }}>
                    {JSON.stringify(jobResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Service Registry */}
          {activeTab === 4 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Demonstrates Distributed Object-Based Systems (like CORBA/Java RMI). Each node registers its services in a registry. Clients can discover services across the cluster and invoke methods on remote nodes via HTTP-based Remote Method Invocation.
              </div>

              <div className="mb-4">
                <button className="btn btn-primary" onClick={discoverServices}>Discover Services</button>
              </div>

              {services.length > 0 && (
                <div className="grid-3 mb-4">
                  {services.map(node => (
                    <div className="node-card" key={node.nodeId}>
                      <div className="node-card-title">{node.nodeId}</div>
                      <div className="node-meta">
                        {node.services.map(srv => (
                          <div key={srv.name} className="mb-2">
                            <span className="badge badge-info mb-1">{srv.name}</span>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Methods: {srv.methods.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <div className="card-header"><div className="card-title">Invoke Remote Method</div></div>
                <form onSubmit={invokeRemote}>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Target Node</label>
                      <select className="form-select" value={invokeTarget} onChange={e => setInvokeTarget(e.target.value)}>
                        <option value="node-a">Node A</option>
                        <option value="node-b">Node B</option>
                        <option value="node-c">Node C</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Service Name</label>
                      <select className="form-select" value={invokeService} onChange={e => { setInvokeService(e.target.value); setInvokeMethod(''); }}>
                        <option value="attendance">attendance</option>
                        <option value="booking">booking</option>
                        <option value="filesystem">filesystem</option>
                        <option value="cluster">cluster</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Method Name</label>
                      <select className="form-select" value={invokeMethod} onChange={e => setInvokeMethod(e.target.value)}>
                        <option value="" disabled>Select method...</option>
                        {invokeService === 'attendance' && <><option value="mark">mark</option><option value="query">query</option></>}
                        {invokeService === 'booking' && <><option value="create">create</option><option value="decide">decide</option><option value="query">query</option></>}
                        {invokeService === 'filesystem' && <><option value="upload">upload</option><option value="list">list</option><option value="stats">stats</option></>}
                        {invokeService === 'cluster' && <><option value="status">status</option><option value="health">health</option></>}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Arguments (JSON)</label>
                    <textarea className="form-input" rows="3" value={invokeArgs} onChange={e => setInvokeArgs(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-success" disabled={!invokeMethod}>Invoke</button>
                </form>
              </div>

              {invokeResult && (
                <div className="card mt-4 fade-in">
                  <div className="card-header">
                    <div className="card-title">Invocation Result</div>
                    <span className="badge badge-approved">{invokeResult.durationMs} ms</span>
                  </div>
                  <div className="mb-2"><strong>Invoked on:</strong> {invokeResult.invokedOn}</div>
                  <pre style={{ background: '#f5f7fa', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem' }}>
                    {JSON.stringify(invokeResult.result || invokeResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Serverless / FaaS */}
          {activeTab === 5 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Demonstrates Serverless / Function-as-a-Service architecture (like AWS Lambda or Cloudflare Workers). Functions are registered and executed on-demand in a sandboxed VM — no persistent server process, just invoke and get results.
              </div>
              
              <div className="grid-2 mb-4">
                <div className="card">
                  <div className="card-header"><div className="card-title">Available Functions</div></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {faasFunctions.map(fn => (
                      <div key={fn.id} style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{fn.name}</strong> 
                            {fn.builtin ? <span className="badge badge-success ml-2">Built-in</span> : <span className="badge badge-info ml-2">Custom</span>}
                          </div>
                          <button className="btn btn-sm btn-primary" onClick={() => invokeFunction(fn.id)}>Run</button>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Owner: {fn.owner}</div>
                      </div>
                    ))}
                    {faasFunctions.length === 0 && <div className="text-muted">No functions available</div>}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Register Custom Function</div></div>
                  <form onSubmit={registerFunction}>
                    <div className="form-group">
                      <label className="form-label">Function Name</label>
                      <input className="form-input" value={customFnName} onChange={e => setCustomFnName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Code (JavaScript)</label>
                      <textarea className="form-input" style={{ fontFamily: 'monospace' }} rows="5" value={customFnCode} onChange={e => setCustomFnCode(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Owner</label>
                      <input className="form-input" value={customFnOwner} onChange={e => setCustomFnOwner(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-success">Register</button>
                  </form>
                </div>
              </div>

              {faasResult && (
                <div className="card mb-4 fade-in">
                  <div className="card-header">
                    <div className="card-title">Execution Result</div>
                    <span className={`badge ${faasResult.success ? 'badge-success' : 'badge-danger'}`}>
                      {faasResult.durationMs} ms
                    </span>
                  </div>
                  <pre style={{ background: '#f5f7fa', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.85rem' }}>
                    {JSON.stringify(faasResult.result || faasResult.error, null, 2)}
                  </pre>
                </div>
              )}

              <div className="card">
                <div className="card-header"><div className="card-title">Execution Log</div></div>
                <table className="table">
                  <thead>
                    <tr><th>Function</th><th>Node</th><th>Duration (ms)</th><th>Status</th><th>Timestamp</th></tr>
                  </thead>
                  <tbody>
                    {faasExecutions.map((exec, idx) => (
                      <tr key={idx}>
                        <td>{exec.functionName}</td>
                        <td>{exec.nodeId}</td>
                        <td>{exec.durationMs}</td>
                        <td>{exec.success ? '✅' : '❌'}</td>
                        <td>{new Date(exec.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                    {faasExecutions.length === 0 && <tr><td colSpan="5" className="text-center text-muted">No executions yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 6: API Gateway */}
          {activeTab === 6 && (
            <div className="fade-in">
              <div className="alert alert-info">
                Demonstrates API Gateway patterns used by Cloudflare (CDN caching), Megaport (smart routing), and AWS (load balancing + circuit breakers). The gateway routes requests to the healthiest node, caches GET responses, and trips circuit breakers on failing nodes.
              </div>

              <div className="grid-2 mb-4">
                <div className="card">
                  <div className="card-header"><div className="card-title">Route Request</div></div>
                  <form onSubmit={routeGatewayRequest}>
                    <div className="form-group">
                      <label className="form-label">Method</label>
                      <select className="form-select" value={gwMethod} onChange={e => setGwMethod(e.target.value)}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Path</label>
                      <input className="form-input" value={gwPath} onChange={e => setGwPath(e.target.value)} />
                    </div>
                    {gwMethod === 'POST' && (
                      <div className="form-group">
                        <label className="form-label">Body (JSON)</label>
                        <textarea className="form-input" rows="3" value={gwBody} onChange={e => setGwBody(e.target.value)} />
                      </div>
                    )}
                    <button type="submit" className="btn btn-primary">Send via Gateway</button>
                  </form>
                  {gwResult && (
                    <div className="mt-4 p-3" style={{ background: '#f5f7fa', borderRadius: '8px' }}>
                      <div className="mb-2"><strong>Handled By:</strong> {gwResult.handledBy}</div>
                      <div className="mb-2"><strong>Latency:</strong> {gwResult.latencyMs} ms</div>
                      <div className="mb-2"><strong>Cached:</strong> {gwResult.cached ? 'Yes' : 'No'}</div>
                      <pre style={{ fontSize: '0.8rem', margin: 0 }}>{JSON.stringify(gwResult.data || gwResult.error, null, 2)}</pre>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card">
                    <div className="card-header"><div className="card-title">Gateway Metrics</div></div>
                    <div className="mb-2"><strong>Total Requests:</strong> {gwMetrics.totalRequests}</div>
                    <div className="mb-2"><strong>Cache Hit Rate:</strong> {(gwMetrics.cacheHitRate || 0).toFixed(1)}%</div>
                    <table className="table mt-2">
                      <thead><tr><th>Node</th><th>Reqs</th><th>Avg Latency</th></tr></thead>
                      <tbody>
                        {Object.entries(gwMetrics.nodeStats || {}).map(([node, stats]) => (
                          <tr key={node}>
                            <td>{node}</td>
                            <td>{stats.requests}</td>
                            <td>{Math.round(stats.totalLatency / (stats.requests || 1))} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Circuit Breakers</div>
                      <button className="btn btn-sm btn-ghost" onClick={resetGatewayCBs}>Reset All</button>
                    </div>
                    <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                      {Object.entries(gwCircuitBreakers || {}).map(([node, state]) => (
                        <div key={node} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f5f7fa', borderRadius: '4px' }}>
                          <span>{node}</span>
                          <span className={`badge ${state === 'closed' ? 'badge-success' : state === 'open' ? 'badge-danger' : 'badge-warning'}`}>
                            {state.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Cache Status</div>
                  <button className="btn btn-sm btn-danger" onClick={clearGatewayCache}>Clear Cache</button>
                </div>
                <div className="mb-3">
                  Size: {gwCache.size} | Hits: {gwCache.hits} | Misses: {gwCache.misses}
                </div>
                <table className="table">
                  <thead><tr><th>Key</th><th>Age (s)</th><th>Hits</th><th>Expired</th></tr></thead>
                  <tbody>
                    {(gwCache.entries || []).map(entry => (
                      <tr key={entry.key}>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.key}</td>
                        <td>{Math.round(entry.ageMs / 1000)}</td>
                        <td>{entry.hits}</td>
                        <td>{entry.expired ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {(gwCache.entries || []).length === 0 && <tr><td colSpan="4" className="text-center text-muted">Cache empty</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 7: CAP Theorem */}
          {activeTab === 7 && (
            <div className="fade-in">
              <div className="alert alert-info">
                The CAP Theorem states that a distributed system can guarantee at most 2 of 3: Consistency, Availability, Partition Tolerance. CampusWatch uses Raft (CP by default). Switch to AP mode to see how the system behaves differently during partitions.
              </div>

              <div className="grid-2 mb-4">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card-header"><div className="card-title">Current Status</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', padding: '1rem', background: capStatus.mode === 'CP' ? '#e0f2fe' : '#ffedd5', color: capStatus.mode === 'CP' ? '#0369a1' : '#c2410c', borderRadius: '8px' }}>
                      {capStatus.mode}
                    </div>
                    <div>
                      <div className="mb-1"><strong>Sacrifices:</strong> {capStatus.mode === 'CP' ? 'Availability' : 'Consistency'}</div>
                      <div className="text-muted" style={{ fontSize: '0.9rem' }}>{capStatus.explanation}</div>
                    </div>
                  </div>
                  
                  <div className="mt-2" style={{ padding: '1rem', background: '#f5f7fa', borderRadius: '8px' }}>
                    <div className="mb-2"><strong>Quorum:</strong> {capStatus.quorum ? '✅ Maintained' : '❌ Lost'}</div>
                    <div><strong>Partitioned Nodes:</strong> {capStatus.partitionedNodes.length > 0 ? capStatus.partitionedNodes.join(', ') : 'None'}</div>
                  </div>

                  <div className="mt-2">
                    <span className="fw-600 mb-2 d-block">Switch Mode:</span>
                    <div className="gap-2" style={{ display: 'flex' }}>
                      <button className={`btn ${capStatus.mode === 'CP' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => switchCapMode('CP')}>CP Mode (Raft Default)</button>
                      <button className={`btn ${capStatus.mode === 'AP' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => switchCapMode('AP')} style={capStatus.mode === 'AP' ? { backgroundColor: '#f97316', borderColor: '#f97316', color: '#fff' } : {}}>AP Mode (Eventual Consistency)</button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Simulate Partition</div></div>
                  <div className="mb-3 text-muted" style={{ fontSize: '0.9rem' }}>
                    Disconnect a node from the rest of the cluster to simulate a network partition.
                  </div>
                  <div className="gap-2 mb-4" style={{ display: 'flex', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => partitionNode('node-a')} disabled={capStatus.partitionedNodes.includes('node-a')}>Partition node-a</button>
                    <button className="btn btn-ghost" onClick={() => partitionNode('node-b')} disabled={capStatus.partitionedNodes.includes('node-b')}>Partition node-b</button>
                    <button className="btn btn-ghost" onClick={() => partitionNode('node-c')} disabled={capStatus.partitionedNodes.includes('node-c')}>Partition node-c</button>
                  </div>
                  <button className="btn btn-success" onClick={healPartitions} disabled={capStatus.partitionedNodes.length === 0}>Heal All Partitions</button>

                  <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #eee' }} />

                  <div className="card-title mb-2">Test Write</div>
                  <textarea className="form-input mb-2" rows="3" value={capTestCommand} onChange={e => setCapTestCommand(e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                  <button className="btn btn-primary" onClick={testCapWrite}>Test Write</button>
                  
                  {capTestResult && (
                    <div className="mt-3 p-3" style={{ background: capTestResult.success ? '#dcfce7' : '#fee2e2', borderRadius: '8px', fontSize: '0.9rem' }}>
                      <div className="fw-600 mb-1">{capTestResult.success ? '✅ Write Succeeded' : '❌ Write Failed'}</div>
                      <div>{capTestResult.explanation}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card mb-4">
                <div className="card-header"><div className="card-title">CP vs AP Comparison</div></div>
                <div className="grid-3">
                  {capComparison.map(comp => (
                    <div key={comp.mode} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px', opacity: comp.mode === 'CA' ? 0.6 : 1 }}>
                      <div className="fw-600 mb-2" style={{ fontSize: '1.2rem' }}>{comp.mode}</div>
                      <div className="mb-2"><strong>Guarantees:</strong> {comp.guarantees.join(' & ')}</div>
                      <div className="mb-2"><strong>Sacrifices:</strong> {comp.sacrifices}</div>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}><strong>Examples:</strong> {comp.examples}</div>
                      {comp.mode === 'CA' && <div className="mt-2 text-danger" style={{ fontSize: '0.8rem' }}>* Impossible in distributed systems (networks always fail)</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">Demo Log</div></div>
                <div className="log-feed" style={{ maxHeight: '300px', overflowY: 'auto', background: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {capLog.map((log, idx) => (
                    <div key={idx} className="log-entry mb-2" style={{ color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#4ade80' : '#94a3b8' }}>
                      <span style={{ opacity: 0.5, marginRight: '0.5rem' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      {log.message}
                    </div>
                  ))}
                  {capLog.length === 0 && <div className="text-muted">No logs yet. Try switching modes or making writes.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
