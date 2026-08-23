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

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  const stateMachine = new StateMachine();
  const raftNode = new RaftNode(config, stateMachine);
  const gossipModule = new GossipModule(config);

  setupWebSocket(server, raftNode, gossipModule);
  redisPubSub.setupRedisPubSub(config, raftNode, broadcastEvent);

  app.use(createRaftRoutes(raftNode, gossipModule));
  app.use(createAttendanceRoutes(raftNode, stateMachine));
  app.use(createBookingRoutes(raftNode, stateMachine, redisPubSub));
  app.use(createAuthRoutes());
  app.use(createAdminRoutes(raftNode, gossipModule));

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
