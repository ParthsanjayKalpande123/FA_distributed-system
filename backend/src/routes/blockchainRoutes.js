const express = require('express');

function createBlockchainRoutes(raftNode) {
  const router = express.Router();

  // GET /api/blockchain/chain — returns the full hash chain
  router.get('/api/blockchain/chain', (req, res) => {
    const chain = raftNode.log.getChain();
    res.json({
      nodeId: raftNode.config.nodeId,
      chainLength: chain.length,
      chain: chain
    });
  });

  // GET /api/blockchain/verify — verifies chain integrity
  router.get('/api/blockchain/verify', (req, res) => {
    const result = raftNode.log.verifyChain();
    res.json({
      nodeId: raftNode.config.nodeId,
      ...result
    });
  });

  // GET /api/blockchain/entry/:index — get specific entry with hash
  router.get('/api/blockchain/entry/:index', (req, res) => {
    const entry = raftNode.log.getEntry(parseInt(req.params.index));
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  });

  return router;
}
module.exports = { createBlockchainRoutes };
