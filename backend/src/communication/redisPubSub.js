// Redis Pub/Sub for cross-node events
const Redis = require('ioredis');
const logger = require('../utils/logger');

let pubClient = null;
let subClient = null;

const REDIS_OPTIONS = {
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 500, 5000), // keep retrying: Redis may start after the nodes
};

function setupRedisPubSub(config, raftNode, wsBroadcast) {
  try {
    pubClient = new Redis(config.redisUrl, REDIS_OPTIONS);
    subClient = new Redis(config.redisUrl, REDIS_OPTIONS);
  } catch (e) {
    logger.warn('Redis unavailable — Pub/Sub disabled');
    return;
  }

  let redisAvailable = false;

  pubClient.on('connect', () => { redisAvailable = true; });
  pubClient.on('error', () => {}); // silent — Redis is optional
  subClient.on('error', () => {}); // silent — Redis is optional

  // Subscribe only once the connection is ready (lazyConnect: true, no offline queue)
  subClient.on('ready', () => { // 'connect' fires before commands are accepted
    subClient.subscribe('campuswatch:leader-change', 'campuswatch:booking-notifications', 'campuswatch:rtc', (err) => {
      if (err) logger.warn('Redis subscribe error', err.message);
    });
  });

  pubClient.connect().catch(() => {}); // silent if Redis is unavailable
  subClient.connect().catch(() => {}); // silent if Redis is unavailable

  subClient.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === 'campuswatch:booking-notifications') {
        wsBroadcast('BOOKING_NOTIFICATION', data);
      } else if (channel === 'campuswatch:rtc') {
        wsBroadcast('RTC_SIGNAL', data);
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

// WebRTC signaling (offer/answer/ICE) relayed to browsers connected to any node
function publishRtcSignal(data) {
  if (pubClient) {
    pubClient.publish('campuswatch:rtc', JSON.stringify(data))
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
  publishRtcSignal,
  shutdown
};
