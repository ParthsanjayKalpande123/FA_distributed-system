// Main entry point for the backend
const express = require('express');
const cors = require('cors');
const http = require('http');

const config = require('./raft/config');
const logger = require('./utils/logger');
const { RaftNode } = require('./raft/raftNode');
const { StateMachine } = require('./state-machine');
const { GossipModule } = require('./communication/gossip');
const { setupWebSocket, broadcastEvent } = require('./communication/websocket');
const redisPubSub = require('./communication/redisPubSub');

const { createRaftRoutes } = require('./routes/raftRoutes');
const { createAttendanceRoutes } = require('./routes/attendanceRoutes');
const { createBookingRoutes } = require('./routes/bookingRoutes');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');

const { MapReduceEngine } = require('./distributed/mapReduce');
const { ServiceRegistry } = require('./distributed/serviceRegistry');
const { createBlockchainRoutes } = require('./routes/blockchainRoutes');
const { createFileRoutes } = require('./routes/fileRoutes');
const { createMapReduceRoutes } = require('./routes/mapreduceRoutes');
const { createServiceRegistryRoutes } = require('./routes/serviceRegistryRoutes');
const { FaaSEngine } = require('./distributed/faas');
const { APIGateway } = require('./distributed/gateway');
const { CAPDemonstrator } = require('./distributed/capDemo');
const { createFaaSRoutes } = require('./routes/faasRoutes');
const { createGatewayRoutes } = require('./routes/gatewayRoutes');
const { createCAPRoutes } = require('./routes/capRoutes');
const { ElectionComparison } = require('./distributed/electionComparison');
const { createElectionRoutes } = require('./routes/electionRoutes');
const { GlobalSnapshot } = require('./distributed/globalSnapshot');
const { createSnapshotRoutes } = require('./routes/snapshotRoutes');
const { Clocks } = require('./distributed/clocks');
const { DeadlockDetector } = require('./distributed/deadlock');
const { createDeadlockRoutes } = require('./routes/deadlockRoutes');

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  const stateMachine = new StateMachine();
  const raftNode = new RaftNode(config, stateMachine);
  const clocks = new Clocks(config);
  const gossipModule = new GossipModule(config, clocks);
  const mapReduceEngine = new MapReduceEngine(config, stateMachine);
  const serviceRegistry = new ServiceRegistry(config);
  const faasEngine = new FaaSEngine(config, stateMachine);
  const apiGateway = new APIGateway(config);
  const capDemo = new CAPDemonstrator(config, raftNode, stateMachine);
  const electionComparison = new ElectionComparison(config);
  const globalSnapshot = new GlobalSnapshot(config, raftNode, stateMachine);

  setupWebSocket(server, raftNode, gossipModule);
  redisPubSub.setupRedisPubSub(config, raftNode, broadcastEvent);

  app.use(createRaftRoutes(raftNode, gossipModule));
  app.use(createAttendanceRoutes(raftNode, stateMachine));
  app.use(createBookingRoutes(raftNode, stateMachine, redisPubSub));
  app.use(createAuthRoutes());
  app.use(createAdminRoutes(raftNode, gossipModule));
  app.use(createBlockchainRoutes(raftNode));
  app.use(createFileRoutes(raftNode, stateMachine));
  app.use(createMapReduceRoutes(mapReduceEngine));
  app.use(createServiceRegistryRoutes(serviceRegistry));
  app.use(createFaaSRoutes(faasEngine));
  app.use(createGatewayRoutes(apiGateway));
  app.use(createCAPRoutes(capDemo));
  app.use(createElectionRoutes(electionComparison));
  app.use(createSnapshotRoutes(globalSnapshot));
  app.use(createDeadlockRoutes(new DeadlockDetector(config)));

  app.get('/api/clocks', (req, res) => res.json(clocks.getStatus()));

  app.get('/health', (req, res) => {
    res.json({
      nodeId: config.nodeId,
      status: 'ok',
      ...raftNode.getStatus()
    });
  });

  server.listen(config.port, () => {
    logger.info(`CampusWatch node ${config.nodeId} listening on port ${config.port}`);
    logger.info(`Peers: ${config.peers.map(p => p.id).join(', ')}`);
    
    // Start raft node with slight delay to let peers boot
    setTimeout(() => {
      raftNode.start();
      gossipModule.start();

      // Register services for Distributed Object-Based Systems
      serviceRegistry.registerService('attendance', ['mark', 'query'], 'Attendance management service', async (method, args) => {
        switch (method) {
          case 'mark':
            return await raftNode.propose({ type: 'MARK_ATTENDANCE', ...args });
          case 'query':
            return stateMachine.attendance.query(args.date);
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      });

      serviceRegistry.registerService('booking', ['create', 'decide', 'query'], 'Resource booking service', async (method, args) => {
        switch (method) {
          case 'create':
            const bookingId = require('uuid').v4();
            return await raftNode.propose({ type: 'CREATE_BOOKING', bookingId, ...args });
          case 'decide':
            return await raftNode.propose({ type: 'DECIDE_BOOKING', ...args });
          case 'query':
            return stateMachine.booking.query(args);
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      });

      serviceRegistry.registerService('filesystem', ['upload', 'list', 'stats'], 'Distributed file system service', async (method, args) => {
        switch (method) {
          case 'upload':
            const fileId = require('uuid').v4();
            return await raftNode.propose({ type: 'UPLOAD_FILE', fileId, ...args });
          case 'list':
            return stateMachine.fileSystem.query(args);
          case 'stats':
            return stateMachine.fileSystem.getStats();
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      });

      serviceRegistry.registerService('cluster', ['status', 'health'], 'Cluster management service', async (method, args) => {
        switch (method) {
          case 'status':
            return raftNode.getStatus();
          case 'health':
            return { nodeId: config.nodeId, uptime: process.uptime(), memoryUsage: process.memoryUsage() };
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      });
    }, 2000);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    redisPubSub.shutdown();
    gossipModule.stop();
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    redisPubSub.shutdown();
    gossipModule.stop();
    server.close(() => {
      process.exit(0);
    });
  });
}

main().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
