// WebSocket communication for real-time updates
const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');
const { publishRtcSignal } = require('./redisPubSub');

let wss = null;

function broadcastEvent(type, data) {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(message);
      } catch (err) {
        logger.warn('Failed to send WS message', err);
      }
    }
  });
}

function setupWebSocket(server, raftNode, gossipModule) {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'RTC_SIGNAL') publishRtcSignal(msg.data);
      } catch { /* ignore malformed client messages */ }
    });

    ws.send(JSON.stringify({
      type: 'SNAPSHOT',
      data: {
        raft: raftNode.getStatus(),
        gossip: gossipModule.getPeerHealth()
      }
    }));
  });

  raftNode.on('stateChange', () => {
    broadcastEvent('STATE_CHANGE', raftNode.getStatus());
  });

  raftNode.on('leaderChange', ({ leaderId, term }) => {
    broadcastEvent('LEADER_CHANGE', { leaderId, term });
  });

  raftNode.on('commitAdvance', ({ commitIndex, logLength }) => {
    broadcastEvent('COMMIT_ADVANCE', { commitIndex, logLength });
  });

  gossipModule.on('peerStatusChange', () => {
    broadcastEvent('PEER_HEALTH', gossipModule.getPeerHealth());
  });

  setInterval(() => {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.ping();
      }
    });
  }, 30000);
}

module.exports = {
  setupWebSocket,
  broadcastEvent
};
