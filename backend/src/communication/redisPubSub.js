// Redis Pub/Sub for cross-node events
const Redis = require('ioredis');
const logger = require('../utils/logger');

let pubClient = null;
let subClient = null;

function setupRedisPubSub(config, raftNode, wsBroadcast) {
  pubClient = new Redis(config.redisUrl);
  subClient = new Redis(config.redisUrl);
  
  pubClient.on('error', err => logger.warn('Redis Pub Error', err.message));
  subClient.on('error', err => logger.warn('Redis Sub Error', err.message));

  subClient.subscribe('campuswatch:leader-change', 'campuswatch:booking-notifications', (err, count) => {
    if (err) logger.warn('Redis subscribe error', err.message);
  });

  subClient.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === 'campuswatch:booking-notifications') {
        wsBroadcast('BOOKING_NOTIFICATION', data);
      }
    } catch (err) {
      logger.warn('Failed to parse redis message', err.message);
    }
  });

  raftNode.on('leaderChange', ({ leaderId, term }) => {
    if (pubClient) {
      pubClient.publish('campuswatch:leader-change', JSON.stringify({
        newLeader: leaderId,
        term,
        timestamp: Date.now()
      })).catch(err => logger.warn('Publish error', err.message));
    }
  });
}

function publishBookingNotification(data) {
  if (pubClient) {
    pubClient.publish('campuswatch:booking-notifications', JSON.stringify(data))
      .catch(err => logger.warn('Publish error', err.message));
  }
}

function shutdown() {
  if (pubClient) pubClient.disconnect();
  if (subClient) subClient.disconnect();
}

module.exports = {
  setupRedisPubSub,
  publishBookingNotification,
  shutdown
};
