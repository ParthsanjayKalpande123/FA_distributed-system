const express = require('express');

function createServiceRegistryRoutes(serviceRegistry) {
  const router = express.Router();

  // GET /api/services/local — list services on this node
  router.get('/api/services/local', (req, res) => {
    res.json(serviceRegistry.getLocalServices());
  });

  // GET /api/services/discover — discover all services across cluster
  router.get('/api/services/discover', async (req, res) => {
    try {
      const allServices = await serviceRegistry.discoverAll();
      res.json(allServices);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/services/invoke-local — invoke a method on a local service (used by remote nodes)
  router.post('/api/services/invoke-local', async (req, res) => {
    try {
      const { serviceName, methodName, args } = req.body;
      const result = await serviceRegistry.invokeLocal(serviceName, methodName, args);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/services/invoke-remote — invoke a method on any node's service (RMI)
  router.post('/api/services/invoke-remote', async (req, res) => {
    try {
      const { targetNodeId, serviceName, methodName, args } = req.body;
      const result = await serviceRegistry.invokeRemote(targetNodeId, serviceName, methodName, args);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
module.exports = { createServiceRegistryRoutes };
