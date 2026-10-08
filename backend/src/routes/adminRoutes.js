// Express routes for admin operations
const express = require('express');

function createAdminRoutes(raftNode, gossipModule) {
  const router = express.Router();

  router.get('/api/cluster-status', (req, res) => {
    res.json({
      raft: raftNode.getStatus(),
      gossip: gossipModule.getPeerHealth()
    });
  });

  return router;
}

module.exports = { createAdminRoutes };
