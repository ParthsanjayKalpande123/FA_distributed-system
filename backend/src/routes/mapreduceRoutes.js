const express = require('express');

function createMapReduceRoutes(mapReduceEngine) {
  const router = express.Router();

  // POST /api/mapreduce/run — execute a MapReduce job (leader coordinates)
  router.post('/api/mapreduce/run', async (req, res) => {
    try {
      const { jobType } = req.body;
      if (!jobType) {
        return res.status(400).json({ error: 'jobType is required' });
      }
      const result = await mapReduceEngine.execute(jobType);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/mapreduce/local-map — internal: run map phase locally (called by leader)
  router.post('/api/mapreduce/local-map', (req, res) => {
    const { jobType } = req.body;
    const result = mapReduceEngine.runLocalMap(jobType);
    res.json(result);
  });

  // GET /api/mapreduce/jobs — list available job types
  router.get('/api/mapreduce/jobs', (req, res) => {
    res.json({
      availableJobs: [
        { type: 'attendance-summary', description: 'Summarize attendance across all dates' },
        { type: 'booking-analytics', description: 'Analyze bookings by status and resource' },
        { type: 'file-stats', description: 'Aggregate file system statistics' },
        { type: 'cluster-health', description: 'Collect health metrics from all nodes' }
      ]
    });
  });

  return router;
}
module.exports = { createMapReduceRoutes };
