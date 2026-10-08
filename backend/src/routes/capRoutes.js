const express = require('express');

function createCAPRoutes(capDemo) {
  const router = express.Router();

  // GET /api/cap/status - current CAP status
  router.get('/api/cap/status', (req, res) => {
    res.json(capDemo.getStatus());
  });

  // GET /api/cap/comparison - CP vs AP vs CA comparison table
  router.get('/api/cap/comparison', (req, res) => {
    res.json(capDemo.getComparison());
  });

  // POST /api/cap/partition - simulate a partition
  router.post('/api/cap/partition', (req, res) => {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });
    const result = capDemo.simulatePartition(nodeId);
    res.json({ ...result, status: capDemo.getStatus() });
  });

  // POST /api/cap/heal - heal a partition
  router.post('/api/cap/heal', (req, res) => {
    const { nodeId } = req.body;
    if (nodeId) {
      const result = capDemo.healPartition(nodeId);
      res.json({ ...result, status: capDemo.getStatus() });
    } else {
      const result = capDemo.healAll();
      res.json({ ...result, status: capDemo.getStatus() });
    }
  });

  // POST /api/cap/mode - switch CP/AP mode
  router.post('/api/cap/mode', (req, res) => {
    try {
      const { mode } = req.body;
      const result = capDemo.setMode(mode);
      res.json({ ...result, status: capDemo.getStatus() });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/cap/test-write - test a write under current CAP conditions
  router.post('/api/cap/test-write', async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command is required' });
    const result = await capDemo.testWrite(command);
    res.json(result);
  });

  // POST /api/cap/test-read - test a read under current CAP conditions
  router.post('/api/cap/test-read', (req, res) => {
    const { queryType, params } = req.body;
    if (!queryType) return res.status(400).json({ error: 'queryType is required' });
    const result = capDemo.testRead(queryType, params || {});
    res.json(result);
  });

  // GET /api/cap/log - get CAP demo event log
  router.get('/api/cap/log', (req, res) => {
    res.json(capDemo.getDemoLog());
  });

  return router;
}

module.exports = { createCAPRoutes };
