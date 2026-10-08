const axios = require('axios');
const logger = require('../utils/logger');

class APIGateway {
  constructor(config) {
    this.config = config;
    
    // Distributed Cache (Cloudflare CDN-inspired)
    this.cache = new Map(); // key -> { value, timestamp, ttl, hits }
    this.cacheMaxSize = 100;
    this.defaultTTL = 10000; // 10 seconds
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    
    // Circuit Breaker (per node)
    this.circuitBreakers = {}; // nodeId -> { failures, lastFailure, state: 'closed'|'open'|'half-open' }
    this.failureThreshold = 3;
    this.recoveryTimeout = 10000; // 10 seconds
    
    // Initialize circuit breakers for all nodes
    [config.nodeId, ...config.peers.map(p => p.id)].forEach(nodeId => {
      this.circuitBreakers[nodeId] = { failures: 0, lastFailure: 0, state: 'closed' };
    });
    
    // Request Metrics
    this.metrics = {
      totalRequests: 0,
      routedRequests: {},  // nodeId -> count
      avgLatency: {},      // nodeId -> avg ms
      latencyHistory: {}   // nodeId -> [last 20 latencies]
    };
    
    // Initialize metrics for all nodes
    [config.nodeId, ...config.peers.map(p => p.id)].forEach(nodeId => {
      this.metrics.routedRequests[nodeId] = 0;
      this.metrics.avgLatency[nodeId] = 0;
      this.metrics.latencyHistory[nodeId] = [];
    });
  }

  // ── CACHE METHODS (Cloudflare CDN) ───────────────────────

  /**
   * Get from cache. Returns { hit: true, value } or { hit: false }.
   */
  cacheGet(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return { hit: false };
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheStats.misses++;
      return { hit: false };
    }
    entry.hits++;
    this.cacheStats.hits++;
    return { hit: true, value: entry.value, age: Date.now() - entry.timestamp };
  }

  /**
   * Set cache entry.
   */
  cacheSet(key, value, ttl) {
    // Evict oldest if at max size
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
    this.cache.set(key, { value, timestamp: Date.now(), ttl: ttl || this.defaultTTL, hits: 0 });
  }

  /**
   * Invalidate cache entries matching a pattern (called on writes).
   */
  cacheInvalidate(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.info(`Cache invalidated ${count} entries matching '${pattern}'`);
    return count;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? Math.round(this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100)
      : 0;
    return {
      ...this.cacheStats,
      hitRate: hitRate + '%',
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        hits: entry.hits,
        expired: Date.now() - entry.timestamp > entry.ttl
      }))
    };
  }

  /**
   * Clear all cache entries.
   */
  cacheClear() {
    const count = this.cache.size;
    this.cache.clear();
    return { cleared: count };
  }

  // ── CIRCUIT BREAKER METHODS ──────────────────────────────

  /**
   * Check if circuit is open (node should not be called).
   */
  isCircuitOpen(nodeId) {
    const cb = this.circuitBreakers[nodeId];
    if (!cb) return false;
    if (cb.state === 'open') {
      // Check if recovery timeout has passed -> half-open
      if (Date.now() - cb.lastFailure > this.recoveryTimeout) {
        cb.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful call to a node.
   */
  recordSuccess(nodeId) {
    const cb = this.circuitBreakers[nodeId];
    if (cb) {
      cb.failures = 0;
      cb.state = 'closed';
    }
  }

  /**
   * Record a failed call to a node.
   */
  recordFailure(nodeId) {
    const cb = this.circuitBreakers[nodeId];
    if (cb) {
      cb.failures++;
      cb.lastFailure = Date.now();
      if (cb.failures >= this.failureThreshold) {
        cb.state = 'open';
        logger.warn(`Circuit breaker OPEN for ${nodeId} after ${cb.failures} failures`);
      }
    }
  }

  /**
   * Get circuit breaker status for all nodes.
   */
  getCircuitBreakerStatus() {
    return { ...this.circuitBreakers };
  }

  // ── SMART ROUTING (Megaport-inspired) ────────────────────

  /**
   * Select the best node to route a request to based on:
   * 1. Circuit breaker state (skip open circuits)
   * 2. Lowest average latency
   * 3. Least loaded (fewest routed requests)
   */
  selectBestNode() {
    const allNodes = [
      { id: this.config.nodeId, host: this.config.nodeId, port: this.config.port },
      ...this.config.peers
    ];

    const available = allNodes.filter(n => !this.isCircuitOpen(n.id));
    if (available.length === 0) {
      // All circuits open - try the one with oldest failure (most likely recovered)
      logger.warn('All circuit breakers open, selecting least recently failed node');
      let best = allNodes[0];
      let oldestFailure = Infinity;
      allNodes.forEach(n => {
        const cb = this.circuitBreakers[n.id];
        if (cb && cb.lastFailure < oldestFailure) {
          oldestFailure = cb.lastFailure;
          best = n;
        }
      });
      return best;
    }

    // Sort by: lowest avg latency, then fewest requests
    available.sort((a, b) => {
      const latA = this.metrics.avgLatency[a.id] || 0;
      const latB = this.metrics.avgLatency[b.id] || 0;
      if (latA !== latB) return latA - latB;
      return (this.metrics.routedRequests[a.id] || 0) - (this.metrics.routedRequests[b.id] || 0);
    });

    return available[0];
  }

  /**
   * Route a request to the best available node.
   * Returns { nodeId, response, latency, cached }.
   */
  async routeRequest(method, path, body) {
    this.metrics.totalRequests++;

    // Check cache for GET requests
    if (method === 'GET') {
      const cached = this.cacheGet(path);
      if (cached.hit) {
        return { nodeId: 'cache', response: cached.value, latency: 0, cached: true, cacheAge: cached.age };
      }
    }

    const node = this.selectBestNode();
    const startTime = Date.now();

    try {
      const url = `http://${node.host}:${node.port}${path}`;
      const response = method === 'GET'
        ? await axios.get(url, { timeout: 5000 })
        : await axios.post(url, body, { timeout: 5000 });

      const latency = Date.now() - startTime;
      this.recordSuccess(node.id);
      this._recordLatency(node.id, latency);

      // Cache GET responses
      if (method === 'GET') {
        this.cacheSet(path, response.data);
      } else {
        // Invalidate related cache on writes
        this.cacheInvalidate(path.split('/').slice(0, 3).join('/'));
      }

      return { nodeId: node.id, response: response.data, latency, cached: false };
    } catch (err) {
      const latency = Date.now() - startTime;
      this.recordFailure(node.id);
      this._recordLatency(node.id, latency);
      throw new Error(`Gateway routing to ${node.id} failed: ${err.message}`);
    }
  }

  _recordLatency(nodeId, latency) {
    this.metrics.routedRequests[nodeId] = (this.metrics.routedRequests[nodeId] || 0) + 1;
    if (!this.metrics.latencyHistory[nodeId]) this.metrics.latencyHistory[nodeId] = [];
    this.metrics.latencyHistory[nodeId].push(latency);
    if (this.metrics.latencyHistory[nodeId].length > 20) {
      this.metrics.latencyHistory[nodeId].shift();
    }
    const history = this.metrics.latencyHistory[nodeId];
    this.metrics.avgLatency[nodeId] = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  }

  /**
   * Get gateway metrics.
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      routing: Object.entries(this.metrics.routedRequests).map(([nodeId, count]) => ({
        nodeId,
        requestCount: count,
        avgLatencyMs: this.metrics.avgLatency[nodeId] || 0,
        circuitState: this.circuitBreakers[nodeId]?.state || 'unknown'
      })),
      cache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: (this.cacheStats.hits + this.cacheStats.misses > 0)
          ? Math.round(this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100) + '%'
          : '0%',
        size: this.cache.size
      }
    };
  }
}

module.exports = { APIGateway };
