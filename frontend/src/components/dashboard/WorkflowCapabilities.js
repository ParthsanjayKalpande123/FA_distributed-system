'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

async function request(path, options) {
  const result = await apiRequest(path, options);
  if (result?.error) throw new Error(result.error);
  return result;
}

function JsonResult({ value }) {
  if (value == null) return null;
  return (
    <pre style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 8, overflowX: 'auto', fontSize: '0.8rem' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatAttendanceText(data) {
  const lines = ['CampusWatch Attendance Summary', `Generated: ${new Date().toLocaleString()}`, ''];

  if (Array.isArray(data)) {
    const validRecords = data.filter(record =>
      record.date && record.date !== 'undefined' && record.date !== 'null'
    );
    if (validRecords.length === 0) return `${lines.join('\n')}No attendance records found.\n`;
    for (const record of validRecords) {
      lines.push(
        `Date: ${record.date || 'Not specified'}`,
        `Subject: ${record.subject || 'General'}`,
        `Present: ${record.present}`,
        `Absent: ${record.absent}`,
        `Total: ${record.total}`,
        `Attendance: ${record.percentage}%`,
        ''
      );
    }
  } else {
    const dates = Object.entries(data || {}).filter(([date]) => date && date !== 'undefined' && date !== 'null');
    if (dates.length === 0) return `${lines.join('\n')}No attendance records found.\n`;
    for (const [date, counts] of dates) {
      lines.push(
        `Date: ${date || 'Not specified'}`,
        `Present: ${counts.present}`,
        `Absent: ${counts.absent}`,
        `Total: ${counts.total}`,
        ''
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function downloadAttendanceText(data, reportType) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([formatAttendanceText(data)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportType}-attendance-summary-${date}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CourseMaterials({ user, canUpload = false }) {
  const [files, setFiles] = useState([]);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    setError('');
    try {
      const result = await request('/api/files');
      const allFiles = Array.isArray(result) ? result : [];
      setFiles(allFiles.filter(file => file.owner?.startsWith('T')));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const uploadMaterial = async event => {
    event.preventDefault();
    if (!fileName.trim() || !content.trim()) {
      setError('Enter a file name and course material.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const bytes = new TextEncoder().encode(content);
      const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
      await request('/api/files', {
        method: 'POST',
        body: JSON.stringify({
          name: fileName.trim(),
          content: btoa(binary),
          owner: user.userId,
          mimeType: 'text/plain'
        })
      });
      setFileName('');
      setContent('');
      await refreshFiles();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const openFile = async file => {
    setError('');
    try {
      const result = await request(`/api/files/${encodeURIComponent(file.id)}`);
      setSelectedFile(result);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteFile = async file => {
    setLoading(true);
    setError('');
    try {
      await request(`/api/files/${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ deletedBy: user.userId })
      });
      if (selectedFile?.id === file.id) setSelectedFile(null);
      await refreshFiles();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const readContent = value => {
    const bytes = Uint8Array.from(atob(value || ''), char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  return (
    <section className="card mt-4">
      <div className="card-header">
        <div>
          <div className="card-title">Course Materials</div>
          <div className="card-subtitle">
            Shared as replicated file records through the CampusWatch cluster.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refreshFiles}>Refresh</button>
      </div>

      {error && <div className="alert alert-error mb-3">{error}</div>}

      {canUpload && (
        <form onSubmit={uploadMaterial} className="grid-2 mb-4">
          <div>
            <div className="form-group">
              <label className="form-label" htmlFor="course-file-name">Material title</label>
              <input
                id="course-file-name"
                className="form-input"
                value={fileName}
                onChange={event => setFileName(event.target.value)}
                placeholder="e.g. Distributed systems notes"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="course-file-content">Text content</label>
              <textarea
                id="course-file-content"
                className="form-input"
                rows="4"
                value={content}
                onChange={event => setContent(event.target.value)}
                placeholder="Add notes or an announcement for students"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Share with Students'}
            </button>
          </div>
          <div className="stat-card">
            <div className="stat-label">Shared course materials</div>
            <div className="stat-value">{files.length}</div>
            <div className="stat-sub">Replicated through Raft for cluster reads</div>
          </div>
        </form>
      )}

      {files.length === 0 ? (
        <div className="empty-state"><div className="empty-text">No course materials have been shared yet.</div></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Title</th><th>Shared by</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id}>
                  <td className="fw-600">{file.name}</td>
                  <td>{file.owner}</td>
                  <td>{file.size || 0} bytes</td>
                  <td>
                    <div className="gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openFile(file)}>Read</button>
                      {canUpload && file.owner === user.userId && (
                        <button className="btn btn-danger btn-sm" disabled={loading} onClick={() => deleteFile(file)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedFile && (
        <div className="mt-3">
          <div className="card-header">
            <div className="card-title">{selectedFile.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFile(null)}>Close</button>
          </div>
          <pre style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
            {readContent(selectedFile.content)}
          </pre>
        </div>
      )}
    </section>
  );
}

function DistributedReport({ title, jobType }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await request('/api/mapreduce/run', {
        method: 'POST',
        body: JSON.stringify({ jobType })
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card mt-4">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-subtitle">The cluster maps node data and returns the reduced report.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Collecting...' : 'Generate Report'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <>
          <div className="channel-row">
            <span className="channel-name">Nodes responded</span>
            <span>{result.phases?.reduce?.nodesResponded || 0} / {result.phases?.reduce?.nodesQueried || 0}</span>
          </div>
          <div className="channel-row">
            <span className="channel-name">Completed in</span>
            <span>{result.duration} ms</span>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: '1rem', borderRadius: 8, overflowX: 'auto' }}>
            {formatAttendanceText(result.phases?.reduce?.aggregatedData)}
          </pre>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => downloadAttendanceText(result.phases?.reduce?.aggregatedData, 'distributed')}
          >
            Download .txt
          </button>
        </>
      )}
    </section>
  );
}

export function TeacherInsights() {
  return (
    <>
      <DistributedReport title="Distributed Attendance Summary" jobType="attendance-summary" />
      <ServerlessAttendanceReport />
    </>
  );
}

function ServerlessAttendanceReport() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const functions = await request('/api/faas/functions');
      const report = functions.find(fn => fn.id === 'builtin-attendance-report');
      if (!report) throw new Error('The attendance report function is unavailable on this node.');
      setResult(await request(`/api/faas/invoke/${encodeURIComponent(report.id)}`, { method: 'POST' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card mt-4">
      <div className="card-header">
        <div>
          <div className="card-title">On-demand Attendance Report</div>
          <div className="card-subtitle">Generate a report when needed using the attendance report function.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {result && (result.success ? (
        <>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: '1rem', borderRadius: 8, overflowX: 'auto' }}>
            {formatAttendanceText(result.result?.data)}
          </pre>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => downloadAttendanceText(result.result?.data, 'on-demand')}
          >
            Download .txt
          </button>
        </>
      ) : <div className="alert alert-error">{result.error || 'Report generation failed.'}</div>)}
    </section>
  );
}

export function BookingAnalytics() {
  return <DistributedReport title="Distributed Booking Analytics" jobType="booking-analytics" />;
}

function LedgerPanel() {
  const [verification, setVerification] = useState(null);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLedger = async () => {
    setLoading(true);
    setError('');
    try {
      const [chain, verified] = await Promise.all([
        request('/api/blockchain/chain'),
        request('/api/blockchain/verify')
      ]);
      setEntries(chain.chain || []);
      setVerification(verified);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>Replicated Raft Ledger</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <p className="text-muted mb-3">Verify the hash chain on the leader&apos;s committed command log.</p>
        <button className="btn btn-primary btn-sm" onClick={loadLedger} disabled={loading}>
          {loading ? 'Checking...' : 'Verify and Load Ledger'}
        </button>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {verification && (
          <div className={`alert ${verification.valid ? 'alert-success' : 'alert-error'} mt-3`}>
            {verification.valid
              ? `Chain integrity verified: ${verification.totalEntries} entries.`
              : `Hash chain validation failed at entry ${verification.brokenAt}.`}
          </div>
        )}
        {entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Index</th><th>Term</th><th>Command</th><th>Hash</th></tr></thead>
              <tbody>
                {entries.slice(-8).reverse().map(entry => (
                  <tr key={entry.index}>
                    <td>{entry.index}</td>
                    <td>{entry.term}</td>
                    <td>{entry.command?.type}</td>
                    <td style={{ fontFamily: 'monospace' }}>{entry.hash?.slice(0, 16)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

function AdminMapReduce() {
  const [jobType, setJobType] = useState('cluster-health');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      setResult(await request('/api/mapreduce/run', {
        method: 'POST',
        body: JSON.stringify({ jobType })
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>Cluster and Storage Analytics</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="admin-mapreduce-job">Report</label>
          <select id="admin-mapreduce-job" className="form-select" value={jobType} onChange={event => setJobType(event.target.value)}>
            <option value="cluster-health">Cluster health</option>
            <option value="file-stats">Distributed file usage</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>{loading ? 'Collecting...' : 'Run Cluster Report'}</button>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {result && <JsonResult value={result.phases?.reduce} />}
      </div>
    </details>
  );
}

function ServiceDirectory() {
  const [registry, setRegistry] = useState(null);
  const [targetNode, setTargetNode] = useState('node-b');
  const [serviceName, setServiceName] = useState('cluster');
  const [methodName, setMethodName] = useState('status');
  const [args, setArgs] = useState('{}');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const discover = async () => {
    setError('');
    try {
      setRegistry(await request('/api/services/discover'));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const invoke = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResult(await request('/api/services/invoke-remote', {
        method: 'POST',
        body: JSON.stringify({
          targetNodeId: targetNode,
          serviceName,
          methodName,
          args: JSON.parse(args || '{}')
        })
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>Cluster Service Directory</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <p className="text-muted mb-3">Discover node services and invoke a remote cluster method.</p>
        <button className="btn btn-ghost btn-sm" onClick={discover}>Discover Services</button>
        {registry && <JsonResult value={registry} />}
        <form onSubmit={invoke} className="mt-3">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="service-target-node">Target node</label>
              <select id="service-target-node" className="form-select" value={targetNode} onChange={event => setTargetNode(event.target.value)}>
                <option value="node-a">Node A</option><option value="node-b">Node B</option><option value="node-c">Node C</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="service-name">Service</label>
              <select id="service-name" className="form-select" value={serviceName} onChange={event => {
                setServiceName(event.target.value);
                setMethodName(event.target.value === 'cluster' ? 'status' : 'query');
              }}>
                <option value="cluster">Cluster</option><option value="attendance">Attendance</option>
                <option value="booking">Booking</option><option value="filesystem">File system</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="service-method">Method</label>
              <select id="service-method" className="form-select" value={methodName} onChange={event => setMethodName(event.target.value)}>
                {(serviceName === 'cluster' ? ['status', 'health']
                  : serviceName === 'attendance' ? ['query', 'mark']
                    : serviceName === 'booking' ? ['query', 'create', 'decide']
                      : ['list', 'stats', 'upload']).map(method => <option key={method} value={method}>{method}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="service-args">Arguments (JSON)</label>
            <textarea id="service-args" className="form-input" rows="2" value={args} onChange={event => setArgs(event.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>{loading ? 'Invoking...' : 'Invoke Remote Method'}</button>
        </form>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {result && <JsonResult value={result} />}
      </div>
    </details>
  );
}

function ServerlessFunctions() {
  const [functions, setFunctions] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingId, setLoadingId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [availableFunctions, executionLog] = await Promise.all([
        request('/api/faas/functions'),
        request('/api/faas/executions')
      ]);
      setFunctions(Array.isArray(availableFunctions) ? availableFunctions : []);
      setExecutions(Array.isArray(executionLog) ? executionLog : []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const invoke = async id => {
    setLoadingId(id);
    setError('');
    try {
      setResult(await request(`/api/faas/invoke/${encodeURIComponent(id)}`, { method: 'POST' }));
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingId('');
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>On-demand Serverless Reports</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <div className="grid-3">
          {functions.map(fn => (
            <div className="stat-card" key={fn.id}>
              <div className="stat-label">{fn.name}</div>
              <div className="stat-sub mb-2">{fn.builtin ? 'Built-in function' : `Owner: ${fn.owner}`}</div>
              <button className="btn btn-primary btn-sm" onClick={() => invoke(fn.id)} disabled={!!loadingId}>
                {loadingId === fn.id ? 'Running...' : 'Run'}
              </button>
            </div>
          ))}
        </div>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {result && <JsonResult value={result.success ? result.result : { error: result.error }} />}
        {executions.length > 0 && <p className="text-muted mt-3">Most recent execution: {executions[0].functionName} on {executions[0].nodeId} ({executions[0].executionTime} ms).</p>}
      </div>
    </details>
  );
}

function GatewayOperations() {
  const [metrics, setMetrics] = useState(null);
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/cluster-status');
  const [routeResult, setRouteResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshMetrics = async () => {
    try {
      setMetrics(await request('/api/gateway/metrics'));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => { refreshMetrics(); }, []);

  const route = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      setRouteResult(await request('/api/gateway/route', {
        method: 'POST',
        body: JSON.stringify({ method, path })
      }));
      await refreshMetrics();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>Gateway Routing for Cluster Operations</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <p className="text-muted mb-3">Route a read through the cluster gateway and inspect routing/cache metrics.</p>
        <form onSubmit={route}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="gateway-method">Method</label>
              <select id="gateway-method" className="form-select" value={method} onChange={event => setMethod(event.target.value)}>
                <option value="GET">GET</option><option value="POST">POST</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gateway-path">Internal API path</label>
              <input id="gateway-path" className="form-input" value={path} onChange={event => setPath(event.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>{loading ? 'Routing...' : 'Route Request'}</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={refreshMetrics}>Refresh Metrics</button>
        </form>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {routeResult && <JsonResult value={routeResult} />}
        {metrics && <JsonResult value={metrics} />}
      </div>
    </details>
  );
}

function CAPControls() {
  const [status, setStatus] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState(null);
  const [command, setCommand] = useState(JSON.stringify({
    type: 'MARK_ATTENDANCE',
    studentId: 'CAP-DEMO',
    date: new Date().toISOString().slice(0, 10),
    present: true,
    markedBy: 'ADMIN001'
  }, null, 2));

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [currentStatus, modeComparison] = await Promise.all([
        request('/api/cap/status'),
        request('/api/cap/comparison')
      ]);
      setStatus(currentStatus);
      setComparison(modeComparison);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const changeMode = async mode => {
    setError('');
    try {
      await request('/api/cap/mode', { method: 'POST', body: JSON.stringify({ mode }) });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const partition = async nodeId => {
    setError('');
    try {
      await request('/api/cap/partition', { method: 'POST', body: JSON.stringify({ nodeId }) });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const heal = async () => {
    setError('');
    try {
      await request('/api/cap/heal', { method: 'POST', body: JSON.stringify({}) });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const testWrite = async () => {
    setError('');
    try {
      setWriteResult(await request('/api/cap/test-write', {
        method: 'POST',
        body: JSON.stringify({ command: JSON.parse(command) })
      }));
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <details className="card mb-3">
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>Partition Resilience and CAP Behavior</summary>
      <div style={{ padding: '0 1.1rem 1.1rem' }}>
        <p className="text-muted">This simulator changes CAP demo state; it does not disconnect the live Raft nodes.</p>
        {status && (
          <div className="channel-row">
            <div><div className="channel-name">{status.mode} mode</div><div className="text-muted">{status.explanation}</div></div>
            <span className="badge badge-info">{status.reachableNodes}/{status.totalNodes} reachable</span>
          </div>
        )}
        <div className="gap-2 mb-3" style={{ display: 'flex', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeMode('CP')}>CP mode</button>
          <button className="btn btn-ghost btn-sm" onClick={() => changeMode('AP')}>AP mode</button>
          <button className="btn btn-success btn-sm" onClick={heal}>Heal simulated partitions</button>
        </div>
        <div className="gap-2 mb-3" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {['node-a', 'node-b', 'node-c'].map(nodeId => (
            <button className="btn btn-ghost btn-sm" key={nodeId} onClick={() => partition(nodeId)} disabled={status?.partitionedNodes?.includes(nodeId)}>
              Simulate {nodeId} partition
            </button>
          ))}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cap-test-command">Test command (JSON)</label>
          <textarea id="cap-test-command" className="form-input" rows="4" value={command} onChange={event => setCommand(event.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={testWrite}>Test CAP write</button>
        {error && <div className="alert alert-error mt-3">{error}</div>}
        {writeResult && <JsonResult value={writeResult} />}
        {comparison && <JsonResult value={comparison} />}
      </div>
    </details>
  );
}

export function AdminSystems() {
  return (
    <section className="mt-4">
      <div className="card-header">
        <div>
          <div className="card-title">CampusWatch System Operations</div>
          <div className="card-subtitle">Tools for inspecting the ledger, services, reports, routing, and partition behavior behind campus workflows.</div>
        </div>
      </div>
      <LedgerPanel />
      <AdminMapReduce />
      <ServiceDirectory />
      <ServerlessFunctions />
      <GatewayOperations />
      <CAPControls />
    </section>
  );
}
