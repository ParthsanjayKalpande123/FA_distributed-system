// Unit 3 (self study) — Distributed deadlock detection with a wait-for graph (WFG).
// Each node only knows its local WFG edges ("P1 waits for P2"). Detection is the
// *centralized* class in Knapp's classification: a coordinator collects every local
// WFG, builds the global WFG, and searches it for a cycle (cycle = deadlock).
// Other classes: path-pushing, edge-chasing (Chandy–Misra–Haas probes), diffusion computation.
const axios = require('axios');

class DeadlockDetector {
  constructor(config) {
    this.config = config;
    this.edges = []; // local WFG: [{ from, to }]
  }

  addEdge(from, to) {
    if (!this.edges.some(e => e.from === from && e.to === to)) this.edges.push({ from, to });
    return this.edges;
  }

  clear() {
    this.edges = [];
  }

  // DFS on the global WFG; returns the first cycle found as [P1, P2, ..., P1], or null.
  static findCycle(edges) {
    const graph = {};
    edges.forEach(({ from, to }) => (graph[from] = graph[from] || []).push(to));
    const state = {}; // undefined = unvisited, 1 = on stack, 2 = done
    const stack = [];
    const dfs = (node) => {
      state[node] = 1;
      stack.push(node);
      for (const next of graph[node] || []) {
        if (state[next] === 1) return [...stack.slice(stack.indexOf(next)), next];
        if (!state[next]) {
          const cycle = dfs(next);
          if (cycle) return cycle;
        }
      }
      stack.pop();
      state[node] = 2;
      return null;
    };
    for (const node of Object.keys(graph)) {
      if (!state[node]) {
        const cycle = dfs(node);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  // Coordinator: gather local WFGs from all nodes, merge, and detect.
  async detect() {
    const localGraphs = { [this.config.nodeId]: this.edges };
    await Promise.all(this.config.peers.map(async peer => {
      try {
        const { data } = await axios.get(`http://${peer.host}:${peer.port}/api/deadlock/local`, { timeout: 2000 });
        localGraphs[peer.id] = data.edges;
      } catch (err) {
        localGraphs[peer.id] = null; // unreachable node: its edges are missing from the global view
      }
    }));
    const globalEdges = Object.values(localGraphs).filter(Boolean).flat();
    const cycle = DeadlockDetector.findCycle(globalEdges);
    const localCycles = Object.fromEntries(Object.entries(localGraphs).map(([id, e]) => [id, !!(e && DeadlockDetector.findCycle(e))]));
    return {
      algorithm: 'Centralized global wait-for graph (Knapp: centralized class)',
      coordinator: this.config.nodeId,
      localGraphs,
      localCycleSeen: localCycles,
      globalEdges,
      deadlocked: !!cycle,
      cycle,
      resolution: cycle ? `Abort one process in the cycle (e.g. ${cycle[0]}) to break the deadlock.` : null
    };
  }
}

module.exports = { DeadlockDetector };

if (require.main === module) {
  const assert = require('assert');
  assert.deepStrictEqual(DeadlockDetector.findCycle([{ from: 'P1', to: 'P2' }, { from: 'P2', to: 'P3' }, { from: 'P3', to: 'P1' }]), ['P1', 'P2', 'P3', 'P1']);
  assert.strictEqual(DeadlockDetector.findCycle([{ from: 'P1', to: 'P2' }, { from: 'P2', to: 'P3' }]), null);
  assert.strictEqual(DeadlockDetector.findCycle([]), null);
  console.log('deadlock ok');
}
