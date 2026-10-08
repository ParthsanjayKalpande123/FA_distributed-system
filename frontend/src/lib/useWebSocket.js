'use client';
import { useState, useEffect, useRef } from 'react';

// Accept an array of ports; defaults to all three Raft nodes.
// On disconnect the hook cycles through every port until it finds
// a live WebSocket endpoint — so it survives any single-node crash.
export function useWebSocket(ports = [3001, 3002, 3003]) {
  const portList = Array.isArray(ports) ? ports : [ports];
  const [clusterState, setClusterState] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const attemptIndexRef = useRef(0);

  useEffect(() => {
    let reconnectTimeout = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;

      const port = portList[attemptIndexRef.current % portList.length];
      console.log(`[WS] Attempting connection to port ${port}...`);
      const ws = new WebSocket(`ws://${location.hostname}:${port}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        setConnected(true);
        // Reset to this port so next reconnect tries the working one first
        attemptIndexRef.current = portList.indexOf(port);
        console.log(`[WS] Connected to port ${port}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          const timestamp = new Date().toLocaleTimeString();
          const logEntry = `[${timestamp}] ${data.type || 'UNKNOWN'}: ${JSON.stringify(data)}`;
          setEvents(prev => [...prev.slice(-49), logEntry]);

          if (data.type === 'SNAPSHOT') {
            setClusterState(data.data);
          } else if (data.type === 'STATE_CHANGE' || data.type === 'LEADER_CHANGE' || data.type === 'COMMIT_ADVANCE') {
            setClusterState(prev => ({ ...prev, ...data.data }));
          } else if (data.type === 'PEER_HEALTH') {
            setClusterState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                peers: { ...prev.peers, [data.peerId]: data.health }
              };
            });
          }
        } catch (err) {
          console.error('[WS] Error parsing message', err);
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        // Advance to the next node in the list for next attempt
        attemptIndexRef.current = (attemptIndexRef.current + 1) % portList.length;
        console.log(`[WS] Disconnected from port ${port}, trying next node in 2s...`);
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        // onclose will handle retry
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { clusterState, events, connected };
}
