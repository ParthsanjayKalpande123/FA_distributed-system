const axios = require('axios');
const logger = require('../utils/logger');

class ServiceRegistry {
  constructor(config) {
    this.config = config;
    this.localServices = new Map();  // name -> { name, methods: [...], description }
    this.remoteRegistry = new Map(); // nodeId -> [{ name, methods, description }]
  }

  /**
   * Register a local service with its methods.
   */
  registerService(name, methods, description, handler) {
    this.localServices.set(name, { name, methods, description, handler, nodeId: this.config.nodeId });
    logger.info(`Service registered: ${name} with methods: ${methods.join(', ')}`);
  }

  /**
   * Get all locally registered services (metadata only, no handlers).
   */
  getLocalServices() {
    const services = [];
    for (const [, svc] of this.localServices) {
      services.push({ name: svc.name, methods: svc.methods, description: svc.description, nodeId: svc.nodeId });
    }
    return services;
  }

  /**
   * Discover all services across the cluster by querying each peer.
   */
  async discoverAll() {
    const allServices = {
      [this.config.nodeId]: this.getLocalServices()
    };

    await Promise.all(this.config.peers.map(async (peer) => {
      try {
        const response = await axios.get(
          `http://${peer.host}:${peer.port}/api/services/local`,
          { timeout: 2000 }
        );
        allServices[peer.id] = response.data;
        this.remoteRegistry.set(peer.id, response.data);
      } catch (err) {
        allServices[peer.id] = { error: 'Node unreachable', message: err.message };
      }
    }));

    return allServices;
  }

  /**
   * Invoke a method on a local service.
   */
  async invokeLocal(serviceName, methodName, args) {
    const service = this.localServices.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found locally`);
    }
    if (!service.methods.includes(methodName)) {
      throw new Error(`Method '${methodName}' not found in service '${serviceName}'`);
    }
    logger.info(`Invoking local service: ${serviceName}.${methodName}`);
    return await service.handler(methodName, args);
  }

  /**
   * Invoke a method on a remote node's service (RMI-style).
   */
  async invokeRemote(targetNodeId, serviceName, methodName, args) {
    // Find the target node
    const peer = this.config.peers.find(p => p.id === targetNodeId);
    if (!peer && targetNodeId !== this.config.nodeId) {
      throw new Error(`Node '${targetNodeId}' not found in cluster`);
    }

    // If target is self, invoke locally
    if (targetNodeId === this.config.nodeId) {
      return this.invokeLocal(serviceName, methodName, args);
    }

    // Remote invocation via HTTP (simulating RMI)
    logger.info(`Remote invocation: ${targetNodeId}/${serviceName}.${methodName}`);
    try {
      const response = await axios.post(
        `http://${peer.host}:${peer.port}/api/services/invoke-local`,
        { serviceName, methodName, args },
        { timeout: 5000 }
      );
      return {
        result: response.data,
        invokedOn: targetNodeId,
        invokedFrom: this.config.nodeId
      };
    } catch (err) {
      throw new Error(`Remote invocation failed on ${targetNodeId}: ${err.message}`);
    }
  }
}

module.exports = { ServiceRegistry };
