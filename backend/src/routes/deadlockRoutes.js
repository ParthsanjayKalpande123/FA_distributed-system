const express = require('express');
const axios = require('axios');

function createDeadlockRoutes(detector) {
  const router = express.Router();
  const nodes = () => [
    { id: detector.config.nodeId, host: detector.config.nodeId, port: detector.config.port },
    ...detector.config.peers
  ];

  // Local WFG of this node (read by the coordinator)
  router.get('/api/deadlock/local', (req, res) => {
    res.json({ nodeId: detector.config.nodeId, edges: detector.edges });
  });

  // Add "from waits for to" to this node's local WFG
  router.post('/api/deadlock/edge', (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    res.json({ nodeId: detector.config.nodeId, edges: detector.addEdge(from, to) });
  });

  router.post('/api/deadlock/clear', (req, res) => {
    detector.clear();
    res.json({ nodeId: detector.config.nodeId, edges: [] });
  });

  // Seed a cycle spread across nodes (P1→P2 on one node, P2→P3 on the next, P3→P1 on the last):
  // no single node sees a cycle locally, only the global WFG does. withCycle=false leaves out P3→P1.
  router.post('/api/deadlock/demo', async (req, res) => {
    const withCycle = req.body.withCycle !== false;
    const edges = [['P1', 'P2'], ['P2', 'P3'], ['P3', 'P1']].slice(0, withCycle ? 3 : 2);
    const all = nodes();
    try {
      await Promise.all(all.map(n => axios.post(`http://${n.host}:${n.port}/api/deadlock/clear`, {}, { timeout: 2000 })));
      await Promise.all(edges.map(([from, to], i) => {
        const n = all[i % all.length];
        return axios.post(`http://${n.host}:${n.port}/api/deadlock/edge`, { from, to }, { timeout: 2000 });
      }));
      res.json(await detector.detect());
    } catch (error) {
      res.status(502).json({ error: `Seeding failed (is every node up?): ${error.message}` });
    }
  });

  router.post('/api/deadlock/detect', async (req, res) => {
    res.json(await detector.detect());
  });

  return router;
}

module.exports = { createDeadlockRoutes };
