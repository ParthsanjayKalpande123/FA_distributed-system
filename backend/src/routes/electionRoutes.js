const express = require('express');

function createElectionRoutes(electionComparison) {
  const router = express.Router();

  router.post('/api/elections/compare', async (req, res) => {
    try {
      const result = await electionComparison.compare({
        failedNode: req.body.failedNode || null,
        candidateId: req.body.candidateId || null
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createElectionRoutes };
