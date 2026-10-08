const express = require('express');

function createSnapshotRoutes(globalSnapshot) {
  const router = express.Router();

  router.get('/api/snapshots/local', (req, res) => {
    res.json(globalSnapshot.getLocalSnapshot());
  });

  router.post('/api/snapshots/capture', async (req, res) => {
    try {
      res.json(await globalSnapshot.capture());
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createSnapshotRoutes };
