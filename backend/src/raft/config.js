// Raft configuration built from environment variables
const nodeId = process.env.NODE_ID || 'node-a';
const port = parseInt(process.env.PORT || '3001', 10);

const peersStr = process.env.PEERS || '';
// "node-b:3002" (same Docker network) or "node-b@10.0.1.5:3002" (node on another machine)
const peers = peersStr ? peersStr.split(',').map(peer => {
  const [idHost, portStr] = peer.split(':');
  const [id, host = id] = idHost.split('@');
  return { id, host, port: parseInt(portStr, 10) };
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
