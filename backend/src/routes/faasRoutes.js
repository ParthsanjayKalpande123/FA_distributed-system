const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createFaaSRoutes(faasEngine) {
  const router = express.Router();

  // GET /api/faas/functions - list all functions
  router.get('/api/faas/functions', (req, res) => {
    res.json(faasEngine.listFunctions());
  });

  // GET /api/faas/functions/:id - get function details (with code)
  router.get('/api/faas/functions/:id', (req, res) => {
    const func = faasEngine.getFunction(req.params.id);
    if (func) {
      res.json(func);
    } else {
      res.status(404).json({ error: 'Function not found' });
    }
  });

  // POST /api/faas/functions - register a new function
  router.post('/api/faas/functions', (req, res) => {
    try {
      if (process.env.ALLOW_CUSTOM_FAAS !== 'true') {
        return res.status(403).json({ error: 'Custom functions are disabled on this deployment (set ALLOW_CUSTOM_FAAS=true to enable locally). Node vm is not a security sandbox.' });
      }
      const { name, code, owner } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'name and code are required' });
      }
      const id = 'fn-' + uuidv4().substring(0, 8);
      const func = faasEngine.registerFunction(id, name, code, owner || 'anonymous');
      res.status(201).json(func);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/faas/invoke/:id - execute a function
  router.post('/api/faas/invoke/:id', async (req, res) => {
    try {
      const result = await faasEngine.execute(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/faas/functions/:id - delete a user function
  router.delete('/api/faas/functions/:id', (req, res) => {
    try {
      const result = faasEngine.deleteFunction(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/faas/executions - get execution log
  router.get('/api/faas/executions', (req, res) => {
    res.json(faasEngine.getExecutionLog());
  });

  return router;
}

module.exports = { createFaaSRoutes };
