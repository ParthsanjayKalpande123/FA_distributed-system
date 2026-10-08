const express = require('express');

function createGatewayRoutes(gateway) {
  const router = express.Router();

  // POST /api/gateway/route - route a request through the gateway
  router.post('/api/gateway/route', async (req, res) => {
    try {
      const { method, path, body } = req.body;
      if (!method || !path) {
        return res.status(400).json({ error: 'method and path are required' });
      }
      const result = await gateway.routeRequest(method, path, body);
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });

  // GET /api/gateway/metrics - get gateway metrics
  router.get('/api/gateway/metrics', (req, res) => {
    res.json(gateway.getMetrics());
  });

  // GET /api/gateway/cache - get cache details
  router.get('/api/gateway/cache', (req, res) => {
    res.json(gateway.getCacheStats());
  });

  // POST /api/gateway/cache/clear - clear cache
  router.post('/api/gateway/cache/clear', (req, res) => {
    const result = gateway.cacheClear();
    res.json(result);
  });

  // GET /api/gateway/circuit-breakers - get circuit breaker status
  router.get('/api/gateway/circuit-breakers', (req, res) => {
    res.json(gateway.getCircuitBreakerStatus());
  });

  // POST /api/gateway/circuit-breakers/reset - reset all circuit breakers
  router.post('/api/gateway/circuit-breakers/reset', (req, res) => {
    const allNodes = [gateway.config.nodeId, ...gateway.config.peers.map(p => p.id)];
    allNodes.forEach(nodeId => {
      gateway.circuitBreakers[nodeId] = { failures: 0, lastFailure: 0, state: 'closed' };
    });
    res.json({ reset: true });
  });

  return router;
}

module.exports = { createGatewayRoutes };
