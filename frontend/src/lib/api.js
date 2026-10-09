/**
 * CampusWatch — cluster-aware API client
 *
 * Bypasses the Next.js proxy (which is hard-wired to node-a:3001) and
 * talks directly to each node's port. On every request it:
 *   1. Tries nodes in order [3001, 3002, 3003] until one responds.
 *   2. If a node returns HTTP 307 + { leaderId } it redirects to the leader
 *      and remembers it for future calls.
 *   3. Falls back to the next node if the current one is unreachable.
 */

const NODE_PORTS = [3001, 3002, 3003];
const PORT_MAP = { 'node-a': 3001, 'node-b': 3002, 'node-c': 3003 };

/**
 * Base URL of the node listening on `port`. Nodes may run on different machines:
 * /cluster-config.js (loaded in the layout) sets window.CW_NODE_HOSTS = { 3001: host, ... };
 * without it every node is assumed to be on the same host as the page.
 */
export function nodeBase(port) {
  return `http://${window.CW_NODE_HOSTS?.[port] || location.hostname}:${port}`;
}

/** Remember which port was last known to work (or be leader). */
function getPreferredPort() {
  if (typeof window === 'undefined') return NODE_PORTS[0];
  const stored = localStorage.getItem('campuswatch_leader');
  return stored ? Number(stored) : NODE_PORTS[0];
}

function setPreferredPort(port) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('campuswatch_leader', port);
  }
}

/**
 * Get current user from local storage
 */
export function getUser() {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('campuswatch_user');
    if (userStr) {
      try { return JSON.parse(userStr); } catch { return null; }
    }
  }
  return null;
}

/**
 * Cluster-aware fetch: tries the preferred node first, then all others.
 * Handles leader redirects (307 + leaderId) automatically.
 */
export async function apiRequest(path, options = {}) {
  const preferred = getPreferredPort();
  // Build an ordered list: preferred port first, then the rest
  const orderedPorts = [
    preferred,
    ...NODE_PORTS.filter(p => p !== preferred)
  ];

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const fetchOptions = { ...options, headers };
  delete fetchOptions._retried; // internal flag, not needed for fetch

  for (const port of orderedPorts) {
    try {
      const url = `${nodeBase(port)}${path}`;
      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(3000),
      });

      let data;
      try { data = await response.json(); } catch { data = {}; }

      // Leader redirect — the non-leader told us who the real leader is
      if (response.status === 307 && data.leaderId) {
        const leaderPort = PORT_MAP[data.leaderId];
        if (leaderPort) {
          setPreferredPort(leaderPort);
          // Retry directly on the leader
          try {
            const leaderUrl = `${nodeBase(leaderPort)}${path}`;
            const leaderRes = await fetch(leaderUrl, {
              ...fetchOptions,
              signal: AbortSignal.timeout(3000),
            });
            try { return await leaderRes.json(); } catch { return {}; }
          } catch {
            // leader also unreachable, fall through to next port
          }
        }
        continue;
      }

      // Success — remember this port as preferred for next call
      setPreferredPort(port);
      return data;

    } catch {
      // Node unreachable — try next
    }
  }

  // All nodes failed
  return { error: 'All nodes unreachable' };
}

/** @deprecated use apiRequest directly */
export function getApiBase() {
  return nodeBase(getPreferredPort());
}
