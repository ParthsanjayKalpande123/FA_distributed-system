// Express routes for Raft RPC
const express = require('express');

function createRaftRoutes(raftNode, gossipModule) {
  const router = express.Router();

  router.post('/raft/request-vote', (req, res) => {
    const result = raftNode.handleRequestVote(req.body);
    res.json(result);
  });

  router.post('/raft/append-entries', (req, res) => {
    const result = raftNode.handleAppendEntries(req.body);
    res.json(result);
  });

  router.post('/gossip/ping', (req, res) => {
    const result = gossipModule.handlePing(req.body);
    res.json(result);
  });

  return router;
}

module.exports = { createRaftRoutes };
