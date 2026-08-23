/**
 * Get API base URL depending on cluster leader
 */
export function getApiBase() {
  if (typeof window !== 'undefined') {
    const leaderPort = localStorage.getItem('campuswatch_leader');
    if (leaderPort) {
      return `http://localhost:${leaderPort}`;
    }
  }
  return '';
}

/**
 * Get current user from local storage
 */
export function getUser() {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('campuswatch_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Standard fetch wrapper that handles leader redirects
 */
export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBase();
  const url = `${baseUrl}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle raft leader redirection manually if 307 or specific error payload
  if (response.status === 307) {
    const newLocation = response.headers.get('location');
    if (newLocation) {
       // Just update leader port if we can extract it for future calls
       // Let the fetch follow it if it did automatically, but fetch with redirect: follow does that.
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    return { success: false, message: 'Failed to parse JSON response' };
  }
  
  // If API tells us who the leader is (e.g. from an error or redirection response)
  if (!response.ok && data.leaderId) {
    // We assume leaderId corresponds to port like node-a -> 3001
    const portMap = {
      'node-a': 3001,
      'node-b': 3002,
      'node-c': 3003
    };
    const leaderPort = portMap[data.leaderId];
    if (leaderPort && typeof window !== 'undefined') {
      localStorage.setItem('campuswatch_leader', leaderPort);
      // Retry once if requested
      if (!options._retried) {
         return apiRequest(path, { ...options, _retried: true });
      }
    }
  }

  return data;
}
