// P2P gossip heartbeat for failure detection
const { EventEmitter } = require('events');
const { sendGossipPing } = require('../raft/rpc');
const logger = require('../utils/logger');

class GossipModule extends EventEmitter {
  constructor(config, clocks) {
    super();
    this.clocks = clocks;
    this.peers = config.peers;
    this.nodeId = config.nodeId;
    this.gossipInterval = config.gossipInterval;
    this.gossipDeadThreshold = config.gossipDeadThreshold;
    
    this.lastSeen = {};
    this.peerStatus = {};
    this.interval = null;
    
    this.peers.forEach(peer => {
      this.peerStatus[peer.id] = 'dead';
    });
  }

  start() {
    this.interval = setInterval(() => {
      this.pingAllPeers();
    }, this.gossipInterval);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async pingAllPeers() {
    let statusChanged = false;
    
    await Promise.all(this.peers.map(async (peer) => {
      const sentAt = Date.now();
      const response = await sendGossipPing(peer, {
        senderId: this.nodeId,
        timestamp: sentAt,
        clock: this.clocks.send(peer.id)
      });
      
      if (response && response.status === 'pong') {
        this.lastSeen[peer.id] = Date.now();
        this.clocks.receive(peer.id, response.clock);
        this.clocks.cristian(peer.id, sentAt, response.timestamp, Date.now());
        if (this.peerStatus[peer.id] !== 'alive') {
          this.peerStatus[peer.id] = 'alive';
          statusChanged = true;
        }
      }
    }));
    
    const now = Date.now();
    this.peers.forEach(peer => {
      if (this.peerStatus[peer.id] === 'alive') {
        const last = this.lastSeen[peer.id] || 0;
        if (now - last > this.gossipDeadThreshold) {
          this.peerStatus[peer.id] = 'dead';
          statusChanged = true;
        }
      }
    });
    
    if (statusChanged) {
      this.emit('peerStatusChange');
    }
  }

  handlePing({ senderId, clock }) {
    this.lastSeen[senderId] = Date.now();
    this.clocks.receive(senderId, clock);
    return { status: 'pong', nodeId: this.nodeId, timestamp: Date.now(), clock: this.clocks.send(senderId) };
  }

  getPeerHealth() {
    const health = {};
    this.peers.forEach(peer => {
      health[peer.id] = {
        status: this.peerStatus[peer.id],
        lastSeen: this.lastSeen[peer.id] || null
      };
    });
    return health;
  }
}

module.exports = { GossipModule };
