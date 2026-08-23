// Raft consensus node implementation
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { RaftLog } = require('./raftLog');
const { sendRequestVote, sendAppendEntries } = require('./rpc');

class RaftNode extends EventEmitter {
  constructor(config, stateMachine) {
    super();
    this.config = config;
    this.stateMachine = stateMachine;
    
    this.state = 'follower'; // follower | candidate | leader
    this.currentTerm = 0;
    this.votedFor = null;
    this.leaderId = null;
    
    this.log = new RaftLog();
    this.votes = new Set();
    
    this.nextIndex = {};
    this.matchIndex = {};
    
    this.electionTimer = null;
    this.heartbeatTimer = null;
    
    this.pendingProposals = new Map();
  }

  start() {
    logger.info(`Starting Raft node ${this.config.nodeId}`);
    this.resetElectionTimer();
  }

  resetElectionTimer() {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    
    const { electionTimeoutMin, electionTimeoutMax } = this.config;
    const timeout = Math.floor(Math.random() * (electionTimeoutMax - electionTimeoutMin + 1)) + electionTimeoutMin;
    
    this.electionTimer = setTimeout(() => {
      this.startElection();
    }, timeout);
  }

  startElection() {
    this.currentTerm++;
    this.state = 'candidate';
    this.votedFor = this.config.nodeId;
    this.votes.clear();
    this.votes.add(this.config.nodeId);
    this.resetElectionTimer();
    
    logger.info(`Starting election for term ${this.currentTerm}`);
    this.emit('stateChange');
    
    const majority = Math.floor((this.config.peers.length + 1) / 2) + 1;
    
    if (this.votes.size >= majority) {
      this.becomeLeader();
      return;
    }

    this.config.peers.forEach(async (peer) => {
      const response = await sendRequestVote(peer, {
        term: this.currentTerm,
        candidateId: this.config.nodeId,
        lastLogIndex: this.log.getLastIndex(),
        lastLogTerm: this.log.getLastTerm()
      });
      
      if (response.term > this.currentTerm) {
        this.stepDown(response.term);
        return;
      }
      
      if (this.state === 'candidate' && response.voteGranted) {
        this.votes.add(peer.id);
        if (this.votes.size >= majority) {
          this.becomeLeader();
        }
      }
    });
  }

  becomeLeader() {
    this.state = 'leader';
    this.leaderId = this.config.nodeId;
    
    if (this.electionTimer) clearTimeout(this.electionTimer);
    
    this.config.peers.forEach(peer => {
      this.nextIndex[peer.id] = this.log.getLastIndex() + 1;
      this.matchIndex[peer.id] = 0;
    });
    
    logger.info(`Became leader for term ${this.currentTerm}`);
    this.emit('stateChange');
    this.emit('leaderChange', { leaderId: this.leaderId, term: this.currentTerm });
    
    this.sendHeartbeats();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
  }

  stepDown(term) {
    this.state = 'follower';
    this.currentTerm = term;
    this.votedFor = null;
    
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.resetElectionTimer();
    
    this.emit('stateChange');
  }

  sendHeartbeats() {
    this.config.peers.forEach(peer => {
      this.replicateLog(peer);
    });
  }

  async replicateLog(peer) {
    const prevLogIndex = this.nextIndex[peer.id] - 1;
    const prevLogTerm = prevLogIndex > 0 ? this.log.getEntry(prevLogIndex).term : 0;
    const entries = this.log.getEntriesFrom(this.nextIndex[peer.id]);
    
    const response = await sendAppendEntries(peer, {
      term: this.currentTerm,
      leaderId: this.config.nodeId,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.log.commitIndex
    });
    
    if (response.term > this.currentTerm) {
      this.stepDown(response.term);
      return;
    }
    
    if (this.state !== 'leader') return;
    
    if (response.success) {
      this.nextIndex[peer.id] = prevLogIndex + entries.length + 1;
      this.matchIndex[peer.id] = prevLogIndex + entries.length;
      this.advanceCommitIndex();
    } else {
      if (this.nextIndex[peer.id] > 1) {
        this.nextIndex[peer.id]--;
      }
    }
  }

  advanceCommitIndex() {
    const majority = Math.floor((this.config.peers.length + 1) / 2) + 1;
    
    for (let n = this.log.getLastIndex(); n > this.log.commitIndex; n--) {
      let count = 1; // self
      this.config.peers.forEach(peer => {
        if (this.matchIndex[peer.id] >= n) count++;
      });
      
      if (count >= majority && this.log.getEntry(n).term === this.currentTerm) {
        this.log.commitIndex = n;
        this.applyCommittedEntries();
        this.emit('commitAdvance', { commitIndex: this.log.commitIndex, logLength: this.log.getLastIndex() });
        break;
      }
    }
  }

  applyCommittedEntries() {
    while (this.log.lastApplied < this.log.commitIndex) {
      this.log.lastApplied++;
      const entry = this.log.getEntry(this.log.lastApplied);
      const result = this.stateMachine.apply(entry.command);
      
      if (this.pendingProposals.has(this.log.lastApplied)) {
        this.pendingProposals.get(this.log.lastApplied).resolve(result);
        this.pendingProposals.delete(this.log.lastApplied);
      }
    }
  }

  propose(command) {
    return new Promise((resolve, reject) => {
      if (this.state !== 'leader') {
        reject(new Error(this.leaderId || 'NO_LEADER'));
        return;
      }
      
      const entry = this.log.append(this.currentTerm, command);
      this.pendingProposals.set(entry.index, { resolve, reject });
      
      this.sendHeartbeats();
      
      setTimeout(() => {
        if (this.pendingProposals.has(entry.index)) {
          this.pendingProposals.get(entry.index).reject(new Error('TIMEOUT'));
          this.pendingProposals.delete(entry.index);
        }
      }, 5000);
    });
  }

  handleRequestVote({ term, candidateId, lastLogIndex, lastLogTerm }) {
    if (term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false };
    }
    
    if (term > this.currentTerm) {
      this.stepDown(term);
    }
    
    const ownLastLogIndex = this.log.getLastIndex();
    const ownLastLogTerm = this.log.getLastTerm();
    
    const logIsUpToDate = lastLogTerm > ownLastLogTerm || (lastLogTerm === ownLastLogTerm && lastLogIndex >= ownLastLogIndex);
    
    if ((this.votedFor === null || this.votedFor === candidateId) && logIsUpToDate) {
      this.votedFor = candidateId;
      this.resetElectionTimer();
      return { term: this.currentTerm, voteGranted: true };
    }
    
    return { term: this.currentTerm, voteGranted: false };
  }

  handleAppendEntries({ term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit }) {
    if (term < this.currentTerm) {
      return { term: this.currentTerm, success: false };
    }
    
    if (term > this.currentTerm) {
      this.stepDown(term);
    }
    
    const stateChanged = this.state !== 'follower' || this.leaderId !== leaderId;
    this.state = 'follower';
    this.leaderId = leaderId;
    this.resetElectionTimer();
    
    if (stateChanged) {
      this.emit('stateChange');
    }
    
    if (prevLogIndex > 0) {
      if (prevLogIndex > this.log.getLastIndex()) {
        return { term: this.currentTerm, success: false };
      }
      if (this.log.getEntry(prevLogIndex).term !== prevLogTerm) {
        this.log.truncateFrom(prevLogIndex);
        return { term: this.currentTerm, success: false };
      }
    }
    
    if (entries && entries.length > 0) {
      let i = 0;
      while (i < entries.length) {
        const entry = entries[i];
        const existing = this.log.getEntry(prevLogIndex + 1 + i);
        if (existing && existing.term !== entry.term) {
          this.log.truncateFrom(prevLogIndex + 1 + i);
          break;
        }
        if (!existing) break;
        i++;
      }
      
      while (i < entries.length) {
        this.log.append(entries[i].term, entries[i].command);
        i++;
      }
    }
    
    if (leaderCommit > this.log.commitIndex) {
      this.log.commitIndex = Math.min(leaderCommit, this.log.getLastIndex());
      this.applyCommittedEntries();
    }
    
    return { term: this.currentTerm, success: true, matchIndex: this.log.getLastIndex() };
  }

  getStatus() {
    return {
      nodeId: this.config.nodeId,
      state: this.state,
      currentTerm: this.currentTerm,
      leaderId: this.leaderId,
      logLength: this.log.getLastIndex(),
      commitIndex: this.log.commitIndex,
      lastApplied: this.log.lastApplied
    };
  }
}

module.exports = { RaftNode };
