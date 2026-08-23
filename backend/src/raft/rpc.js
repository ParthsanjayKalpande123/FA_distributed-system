// HTTP-based RPC calls to other Raft nodes using axios
const axios = require('axios');
const logger = require('../utils/logger');

const rpcClient = axios.create({
  timeout: 1000
});

async function sendRequestVote(peer, data) {
  try {
    logger.debug(`Sending RequestVote to ${peer.id}`, data);
    const response = await rpcClient.post(`http://${peer.host}:${peer.port}/raft/request-vote`, data);
    return response.data;
  } catch (error) {
    logger.debug(`RequestVote to ${peer.id} failed`, error.message);
    return { term: -1, voteGranted: false };
  }
}

async function sendAppendEntries(peer, data) {
  try {
    logger.debug(`Sending AppendEntries to ${peer.id}`);
    const response = await rpcClient.post(`http://${peer.host}:${peer.port}/raft/append-entries`, data);
    return response.data;
  } catch (error) {
    logger.debug(`AppendEntries to ${peer.id} failed`, error.message);
    return { term: -1, success: false };
  }
}

async function sendGossipPing(peer, data) {
  try {
    const response = await rpcClient.post(`http://${peer.host}:${peer.port}/gossip/ping`, data);
    return response.data;
  } catch (error) {
    return null;
  }
}

module.exports = {
  sendRequestVote,
  sendAppendEntries,
  sendGossipPing
};
