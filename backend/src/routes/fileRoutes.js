const express = require('express');

function createFileRoutes(raftNode, stateMachine) {
  const router = express.Router();

  // POST /api/files — upload a file (base64 content in body)
  router.post('/api/files', async (req, res) => {
    try {
      const { name, content, owner, mimeType } = req.body;
      const fileId = require('uuid').v4();
      const size = Buffer.byteLength(content || '', 'base64');
      const result = await raftNode.propose({
        type: 'UPLOAD_FILE', fileId, name, content, owner, mimeType, size
      });
      res.status(201).json(result);
    } catch (error) {
      // Handle not-leader redirect same as other routes
      if (error.message && error.message !== 'TIMEOUT' && error.message !== 'NO_LEADER') {
        res.status(307).json({ leaderId: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // GET /api/files — list all files (metadata only)
  router.get('/api/files', (req, res) => {
    const { owner } = req.query;
    const result = stateMachine.fileSystem.query({ owner });
    res.json(result);
  });

  // GET /api/files/stats — file system stats
  router.get('/api/files/stats', (req, res) => {
    res.json(stateMachine.fileSystem.getStats());
  });

  // GET /api/files/:id — get file (with content)
  router.get('/api/files/:id', (req, res) => {
    const file = stateMachine.fileSystem.getById(req.params.id);
    if (file) {
      res.json(file);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // DELETE /api/files/:id — delete file
  router.delete('/api/files/:id', async (req, res) => {
    try {
      const result = await raftNode.propose({
        type: 'DELETE_FILE', fileId: req.params.id, deletedBy: req.body.deletedBy || 'unknown'
      });
      res.json(result);
    } catch (error) {
      if (error.message && error.message !== 'TIMEOUT' && error.message !== 'NO_LEADER') {
        res.status(307).json({ leaderId: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  return router;
}
module.exports = { createFileRoutes };
