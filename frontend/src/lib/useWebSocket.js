'use client';
import { useState, useEffect, useRef } from 'react';

export function useWebSocket(port = 3001) {
  const [clusterState, setClusterState] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  
  useEffect(() => {
    let reconnectTimeout = null;

    const connect = () => {
      console.log(`Connecting to WS on port ${port}...`);
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('WS connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          const timestamp = new Date().toLocaleTimeString();
          const logEntry = `[${timestamp}] ${data.type || 'UNKNOWN'}: ${JSON.stringify(data)}`;
          setEvents(prev => [...prev.slice(-49), logEntry]);

          if (data.type === 'SNAPSHOT') {
            setClusterState(data.state);
          } else if (data.type === 'STATE_CHANGE' || data.type === 'LEADER_CHANGE' || data.type === 'COMMIT_ADVANCE') {
             // In a real app we'd merge smartly, here we might just wait for next snapshot or update partials
             setClusterState(prev => ({ ...prev, ...data.state }));
          } else if (data.type === 'PEER_HEALTH') {
             setClusterState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    peers: {
                       ...prev.peers,
                       [data.peerId]: data.health
                    }
                };
             });
          }
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('WS disconnected, reconnecting in 2s...');
        reconnectTimeout = setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        // handled by onclose
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [port]);
  
  return { clusterState, events, connected };
}
