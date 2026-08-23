// Raft configuration built from environment variables
const nodeId = process.env.NODE_ID || 'node-a';
const port = parseInt(process.env.PORT || '3001', 10);

const peersStr = process.env.PEERS || '';
const peers = peersStr ? peersStr.split(',').map(peer => {
  const [id, portStr] = peer.split(':');
  return { id, host: id, port: parseInt(portStr, 10) };
}) : [];

module.exports = {
  nodeId,
  port,
  peers,
  electionTimeoutMin: 1500,
  electionTimeoutMax: 3000,
  heartbeatInterval: 500,
  gossipInterval: 1000,
  gossipDeadThreshold: 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
};
