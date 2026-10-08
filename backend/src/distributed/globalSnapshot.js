const axios = require('axios');
const { StateMachine } = require('../state-machine');

class GlobalSnapshot {
  constructor(config, raftNode, stateMachine) {
    this.config = config;
    this.raftNode = raftNode;
    this.stateMachine = stateMachine;
  }

  getLocalSnapshot() {
    const status = this.raftNode.getStatus();
    const appliedIndex = Math.min(status.commitIndex, status.lastApplied);
    return {
      nodeId: this.config.nodeId,
      state: status.state,
      currentTerm: status.currentTerm,
      commitIndex: status.commitIndex,
      lastApplied: status.lastApplied,
      appliedIndex,
      entries: this.raftNode.log.getEntriesFrom(1)
        .slice(0, appliedIndex)
        .map(entry => ({ index: entry.index, command: entry.command }))
    };
  }

  async capture() {
    const local = this.getLocalSnapshot();
    const peerResults = await Promise.all(this.config.peers.map(async peer => {
      try {
        const response = await axios.get(`http://${peer.host}:${peer.port}/api/snapshots/local`, { timeout: 3000 });
        return { snapshot: response.data };
      } catch (error) {
        return { nodeId: peer.id, error: error.message };
      }
    }));

    const snapshots = [local, ...peerResults.filter(result => result.snapshot).map(result => result.snapshot)];
    const unavailableNodes = peerResults
      .filter(result => result.error)
      .map(result => ({ nodeId: result.nodeId, reason: result.error }));
    const cutIndex = Math.min(...snapshots.map(snapshot => snapshot.appliedIndex));
    const referenceEntries = snapshots[0].entries;

    for (const snapshot of snapshots.slice(1)) {
      for (let index = 0; index < cutIndex; index++) {
        if (JSON.stringify(snapshot.entries[index]?.command) !== JSON.stringify(referenceEntries[index]?.command)) {
          throw new Error(`Committed log mismatch at index ${index + 1} on node ${snapshot.nodeId}; a consistent snapshot cannot be produced.`);
        }
      }
    }

    const reconstructedState = new StateMachine();
    for (let index = 0; index < cutIndex; index++) {
      reconstructedState.apply(referenceEntries[index].command);
    }

    const bookings = reconstructedState.booking.getAll();
    const files = reconstructedState.fileSystem.getStats();
    return {
      algorithm: 'Raft committed-prefix consistent snapshot',
      capturedAt: new Date().toISOString(),
      cutIndex,
      participatingNodes: snapshots.map(snapshot => ({
        nodeId: snapshot.nodeId,
        state: snapshot.state,
        currentTerm: snapshot.currentTerm,
        commitIndex: snapshot.commitIndex,
        lastApplied: snapshot.lastApplied
      })),
      unavailableNodes,
      globalState: {
        attendanceRecords: reconstructedState.attendance.getAll().length,
        bookings: {
          total: bookings.length,
          pending: bookings.filter(booking => booking.status === 'pending').length,
          approved: bookings.filter(booking => booking.status === 'approved').length,
          rejected: bookings.filter(booking => booking.status === 'rejected').length
        },
        files
      },
      explanation: `State was reconstructed from the common applied Raft log prefix through index ${cutIndex}. This is a consistent cut because state-changing commands are serialized by Raft; unavailable nodes are listed separately.`
    };
  }
}

module.exports = { GlobalSnapshot };
