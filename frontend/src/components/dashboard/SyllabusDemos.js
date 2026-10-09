'use client';
// Syllabus demos for the Admin dashboard (restored from the former Explorer page):
// Unit 3 clocks, Unit 3 (self study) distributed deadlock detection, Unit 2 WebRTC.
import { useEffect, useRef, useState } from 'react';
import { apiRequest, nodeBase } from '../../lib/api';

// Collapsible panel matching the other admin panels; content mounts only while open,
// so the clock polling and the WebRTC signaling socket run only when in use.
function Panel({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="card mb-3" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="card-title" style={{ cursor: 'pointer', padding: '1.1rem' }}>{title}</summary>
      {open && <div style={{ padding: '0 1.1rem 1.1rem' }}>{children}</div>}
    </details>
  );
}

/* ── Lamport / vector clocks + Cristian sync (piggybacked on gossip) ── */
function ClocksDemo() {
  const [nodes, setNodes] = useState([]);
  const load = async () => setNodes(await Promise.all([3001, 3002, 3003].map(port =>
    fetch(`${nodeBase(port)}/api/clocks`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.json()).catch(() => ({ nodeId: `port ${port}`, down: true })))));
  useEffect(() => { load(); const iv = setInterval(load, 2000); return () => clearInterval(iv); }, []);
  return (
    <div className="fade-in">
      <div className="alert alert-info">
        Every gossip heartbeat (beacon) is a send/receive event. <strong>Lamport</strong>: L = max(local, msg) + 1.
        <strong> Vector</strong>: element-wise max, then increment own entry — compares events causally (happened-before vs concurrent).
        <strong> Cristian</strong>: offset = serverTime + RTT/2 − localTime. Refreshes every 2 s.
      </div>
      <div className="grid-3">
        {nodes.map(n => (
          <div className="card" key={n.nodeId}>
            <div className="card-header"><div className="card-title">{n.nodeId}</div>{n.down && <span className="badge badge-danger">down</span>}</div>
            {!n.down && (
              <>
                <div className="mb-2"><strong>Lamport:</strong> {n.lamport}</div>
                <div className="mb-2"><strong>Vector:</strong> [{Object.entries(n.vector).map(([k, v]) => `${k}:${v}`).join(', ')}]</div>
                <div className="mb-2"><strong>Cristian offsets:</strong>
                  {Object.entries(n.cristianOffsets).map(([peer, o]) => <div key={peer} className="text-muted">{peer}: {o.offsetMs.toFixed(1)} ms (RTT {o.rttMs} ms)</div>)}
                </div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Last events: {n.recentEvents.slice(-3).map(e => `${e.kind}(${e.peer}) L=${e.lamport}`).join(' · ')}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Distributed deadlock detection (wait-for graph) ── */
function DeadlockDemo() {
  const [result, setResult] = useState(null);
  const run = async (path, body) => setResult(await apiRequest(path, { method: 'POST', body: JSON.stringify(body || {}) }));
  return (
    <div className="fade-in">
      <div className="alert alert-info">
        Each node keeps only its <strong>local wait-for graph</strong>. The seeded scenario spreads P1→P2, P2→P3, P3→P1 across three nodes, so no node sees a cycle on its own.
        A coordinator merges all local graphs into the <strong>global WFG</strong> and searches for a cycle (Knapp's <em>centralized</em> class; others are path-pushing, edge-chasing and diffusion).
      </div>
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-danger" onClick={() => run('/api/deadlock/demo', { withCycle: true })}>Seed deadlock (cycle) &amp; detect</button>
          <button className="btn btn-success" onClick={() => run('/api/deadlock/demo', { withCycle: false })}>Seed without cycle &amp; detect</button>
          <button className="btn btn-ghost" onClick={() => run('/api/deadlock/detect')}>Detect again</button>
        </div>
      </div>
      {result && (
        <div className="card fade-in">
          <div className="card-header">
            <div className="card-title">{result.error ? 'Error' : result.deadlocked ? 'Deadlock detected' : 'No deadlock'}</div>
            {!result.error && <span className={`badge ${result.deadlocked ? 'badge-danger' : 'badge-success'}`}>{result.deadlocked ? result.cycle.join(' → ') : 'acyclic'}</span>}
          </div>
          {result.error ? <div className="text-danger">{result.error}</div> : (
            <>
              <table className="table">
                <thead><tr><th>Node</th><th>Local WFG edges</th><th>Cycle visible locally?</th></tr></thead>
                <tbody>
                  {Object.entries(result.localGraphs).map(([node, edges]) => (
                    <tr key={node}>
                      <td>{node}</td>
                      <td>{edges ? (edges.map(e => `${e.from}→${e.to}`).join(', ') || '—') : 'unreachable'}</td>
                      <td>{result.localCycleSeen[node] ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3"><strong>Coordinator:</strong> {result.coordinator} · <strong>Algorithm:</strong> {result.algorithm}</div>
              {result.resolution && <div className="mt-2"><strong>Resolution:</strong> {result.resolution}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── WebRTC peer-to-peer data channel ─────────────── */
// Signaling (offer / answer / ICE) goes browser → WebSocket → Redis Pub/Sub → every node → other browser.
// After that, chat messages flow directly browser-to-browser over an RTCDataChannel.
function WebRTCDemo() {
  const [status, setStatus] = useState('Connecting to signaling server...');
  const [log, setLog] = useState([]);
  const [text, setText] = useState('');
  const r = useRef({ id: Math.random().toString(36).slice(2, 8) });
  const add = (line) => setLog(l => [...l.slice(-40), line]);

  const signal = (data) => r.current.ws?.send(JSON.stringify({ type: 'RTC_SIGNAL', data: { from: r.current.id, ...data } }));

  const newPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = e => e.candidate && signal({ kind: 'ice', to: r.current.peer, candidate: e.candidate });
    pc.onconnectionstatechange = () => setStatus(`Peer connection: ${pc.connectionState}`);
    pc.ondatachannel = e => bindChannel(e.channel);
    r.current.pc = pc;
    return pc;
  };

  const bindChannel = (ch) => {
    r.current.ch = ch;
    ch.onopen = () => { setStatus(`Connected directly to peer ${r.current.peer} (P2P data channel)`); add('— data channel open —'); };
    ch.onmessage = e => add(`peer ${r.current.peer}: ${e.data}`);
  };

  useEffect(() => {
    const port = localStorage.getItem('campuswatch_leader') || 3001;
    const ws = new WebSocket(`${nodeBase(port).replace(/^http/, 'ws')}/ws`);
    r.current.ws = ws;
    ws.onopen = () => setStatus(`Signaling via node on port ${port}. You are ${r.current.id}. Open this tab in a second browser window and press Connect in one of them.`);
    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'RTC_SIGNAL') return;
      const d = msg.data;
      if (d.from === r.current.id || (d.to && d.to !== r.current.id)) return;
      if (d.kind === 'offer' && !r.current.pc) {
        r.current.peer = d.from;
        const pc = newPeer();
        await pc.setRemoteDescription(d.sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        signal({ kind: 'answer', to: d.from, sdp: pc.localDescription });
        add(`offer from ${d.from} → answered`);
      } else if (d.kind === 'answer' && r.current.pc?.signalingState === 'have-local-offer') {
        r.current.peer = d.from;
        await r.current.pc.setRemoteDescription(d.sdp);
        add(`answer from ${d.from}`);
      } else if (d.kind === 'ice' && r.current.pc && d.from === r.current.peer) {
        await r.current.pc.addIceCandidate(d.candidate).catch(() => {});
      }
    };
    ws.onclose = () => setStatus('Signaling connection closed — reload the tab.');
    return () => { ws.close(); r.current.pc?.close(); };
  }, []);

  const connect = async () => {
    const pc = newPeer();
    bindChannel(pc.createDataChannel('chat'));
    await pc.setLocalDescription(await pc.createOffer());
    signal({ kind: 'offer', sdp: pc.localDescription });
    add('offer sent — waiting for a peer to answer');
  };

  const send = (e) => {
    e.preventDefault();
    if (r.current.ch?.readyState !== 'open' || !text) return;
    r.current.ch.send(text);
    add(`me: ${text}`);
    setText('');
  };

  return (
    <div className="fade-in">
      <div className="alert alert-info">
        WebRTC: the cluster only relays the <strong>signaling</strong> (SDP offer/answer + ICE candidates) over WebSocket and Redis Pub/Sub.
        Once connected, messages travel <strong>peer-to-peer</strong> between the two browsers and never touch the servers.
      </div>
      <div className="card mb-4">
        <div className="mb-3">{status}</div>
        <button className="btn btn-primary" onClick={connect} disabled={!!r.current.pc}>Connect</button>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">P2P Chat</div></div>
        <div style={{ background: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '120px', maxHeight: '260px', overflowY: 'auto' }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input className="form-input" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message" />
          <button className="btn btn-success" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export function SyllabusDemos() {
  return (
    <section className="mt-4">
      <div className="card-header">
        <div>
          <div className="card-title">Synchronization &amp; Communication Demos</div>
          <div className="card-subtitle">Logical and physical clocks, distributed deadlock detection, and peer-to-peer WebRTC.</div>
        </div>
      </div>
      <Panel title="Clock Synchronization (Lamport, Vector, Cristian)"><ClocksDemo /></Panel>
      <Panel title="Distributed Deadlock Detection (Wait-For Graph)"><DeadlockDemo /></Panel>
      <Panel title="WebRTC Peer-to-Peer Chat"><WebRTCDemo /></Panel>
    </section>
  );
}
