// Express routes for admin operations
const express = require('express');
const logger = require('../utils/logger');

function createAdminRoutes(raftNode, gossipModule) {
  const router = express.Router();

  router.get('/api/cluster-status', (req, res) => {
    res.json({
      raft: raftNode.getStatus(),
      gossip: gossipModule.getPeerHealth()
    });
  });

  router.post('/api/simulate-crash', (req, res) => {
    logger.warn('SIMULATING NODE CRASH!');
    res.json({ success: true, message: 'Node is crashing...' });
    setTimeout(() => {
      process.exit(1);
    }, 500);
  });

  return router;
}

module.exports = { createAdminRoutes };
