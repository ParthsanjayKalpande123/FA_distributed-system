const logger = require('../utils/logger');

class CAPDemonstrator {
  constructor(config, raftNode, stateMachine) {
    this.config = config;
    this.raftNode = raftNode;
    this.stateMachine = stateMachine;
    
    // Partition simulation state
    this.partitionedNodes = new Set(); // nodes we pretend we can't reach
    this.mode = 'CP'; // 'CP' (default Raft) or 'AP' (allow stale reads even without leader)
    
    // Demo log
    this.demoLog = [];
  }

  _log(event, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      mode: this.mode,
      partitionedNodes: [...this.partitionedNodes]
    };
    this.demoLog.push(entry);
    if (this.demoLog.length > 100) this.demoLog.shift();
    logger.info(`CAP Demo: ${event}`, details);
    return entry;
  }

  /**
   * Get current CAP status.
   */
  getStatus() {
    const raftStatus = this.raftNode.getStatus();
    const isLeader = raftStatus.state === 'leader';
    const hasQuorum = this._countReachableNodes() >= Math.floor((this.config.peers.length + 1) / 2) + 1;

    return {
      mode: this.mode,
      currentBehavior: this.mode === 'CP'
        ? 'Consistency + Partition Tolerance (writes rejected without majority quorum)'
        : 'Availability + Partition Tolerance (stale reads allowed, writes may diverge)',
      sacrifice: this.mode === 'CP' ? 'Availability' : 'Consistency',
      raftState: raftStatus.state,
      isLeader,
      hasQuorum,
      partitionedNodes: [...this.partitionedNodes],
      reachableNodes: this._countReachableNodes(),
      totalNodes: this.config.peers.length + 1,
      canAcceptWrites: this.mode === 'CP' ? (isLeader && hasQuorum) : true,
      explanation: this._getExplanation(isLeader, hasQuorum)
    };
  }

  _countReachableNodes() {
    // Self is always reachable + peers not in partition set
    return 1 + this.config.peers.filter(p => !this.partitionedNodes.has(p.id)).length;
  }

  _getExplanation(isLeader, hasQuorum) {
    if (this.partitionedNodes.size === 0) {
      return 'No partition — all three guarantees (C, A, P) hold in normal operation. The CAP theorem only forces a trade-off during a network partition.';
    }
    if (this.mode === 'CP') {
      if (hasQuorum) {
        return `CP Mode: Despite the partition, this side has quorum (${this._countReachableNodes()}/${this.config.peers.length + 1} nodes reachable). Writes are accepted and consistent. Partitioned nodes cannot serve writes (availability sacrificed on their side).`;
      } else {
        return `CP Mode: This node has lost quorum (only ${this._countReachableNodes()}/${this.config.peers.length + 1} nodes reachable). Writes are REJECTED to maintain consistency. The system sacrifices AVAILABILITY to guarantee CONSISTENCY.`;
      }
    } else {
      return `AP Mode: Despite the partition, this node continues to serve reads and accept writes. Data may become INCONSISTENT across partitioned nodes (split-brain risk). The system sacrifices CONSISTENCY to guarantee AVAILABILITY.`;
    }
  }

  /**
   * Simulate partitioning a node (pretend it's unreachable).
   */
  simulatePartition(nodeId) {
    this.partitionedNodes.add(nodeId);
    return this._log('PARTITION_CREATED', { partitionedNode: nodeId, reachable: this._countReachableNodes() });
  }

  /**
   * Heal a partition (node becomes reachable again).
   */
  healPartition(nodeId) {
    this.partitionedNodes.delete(nodeId);
    return this._log('PARTITION_HEALED', { healedNode: nodeId, reachable: this._countReachableNodes() });
  }

  /**
   * Heal all partitions.
   */
  healAll() {
    this.partitionedNodes.clear();
    return this._log('ALL_PARTITIONS_HEALED', { reachable: this._countReachableNodes() });
  }

  /**
   * Switch between CP and AP mode.
   */
  setMode(mode) {
    if (mode !== 'CP' && mode !== 'AP') {
      throw new Error('Mode must be CP or AP');
    }
    const oldMode = this.mode;
    this.mode = mode;
    return this._log('MODE_CHANGED', { from: oldMode, to: mode });
  }

  /**
   * Attempt a write and show CAP behavior.
   * In CP mode: fails if no quorum.
   * In AP mode: always succeeds locally (but may be inconsistent).
   */
  async testWrite(command) {
    const status = this.getStatus();

    if (this.mode === 'CP') {
      // Standard Raft behavior — needs leader with quorum
      try {
        const result = await this.raftNode.propose(command);
        return {
          success: true,
          mode: 'CP',
          result,
          explanation: 'Write succeeded — leader has quorum, consistency guaranteed.',
          ...this._log('WRITE_SUCCESS_CP', { command: command.type })
        };
      } catch (err) {
        return {
          success: false,
          mode: 'CP',
          error: err.message,
          explanation: 'Write REJECTED — no leader or no quorum. Consistency preserved at the cost of availability.',
          ...this._log('WRITE_REJECTED_CP', { command: command.type, error: err.message })
        };
      }
    } else {
      // AP mode — apply locally even without consensus
      const result = this.stateMachine.apply(command);
      return {
        success: true,
        mode: 'AP',
        result,
        warning: 'Write applied locally WITHOUT Raft consensus. Other nodes may have different data (inconsistency risk).',
        explanation: 'Write succeeded locally — availability preserved, but consistency is NOT guaranteed across the cluster.',
        ...this._log('WRITE_SUCCESS_AP', { command: command.type, warning: 'Applied without consensus' })
      };
    }
  }

  /**
   * Attempt a read and show CAP behavior.
   */
  testRead(queryType, params) {
    let data;
    switch (queryType) {
      case 'attendance':
        data = this.stateMachine.attendance.query(params.date || '');
        break;
      case 'booking':
        data = this.stateMachine.booking.query(params || {});
        break;
      default:
        data = null;
    }

    const status = this.getStatus();
    return {
      data,
      mode: this.mode,
      isConsistent: this.mode === 'CP' && status.hasQuorum,
      warning: this.mode === 'AP' && this.partitionedNodes.size > 0
        ? 'Data may be stale — reading from a partitioned node in AP mode'
        : null,
      explanation: this.mode === 'CP'
        ? 'Read from committed state — guaranteed consistent with Raft leader.'
        : 'Read served immediately for availability — may not reflect latest writes from other partition.',
      ...this._log('READ', { queryType, mode: this.mode, consistent: this.mode === 'CP' && status.hasQuorum })
    };
  }

  /**
   * Get the demo log.
   */
  getDemoLog() {
    return [...this.demoLog].reverse();
  }

  /**
   * Get a comparison table of CP vs AP.
   */
  getComparison() {
    return {
      CP: {
        guarantees: ['Consistency', 'Partition Tolerance'],
        sacrifices: 'Availability',
        behavior: 'Rejects writes when quorum is lost',
        example: 'Raft, Paxos, ZooKeeper, etcd, Google Spanner',
        currentProject: 'CampusWatch default (Raft-based)'
      },
      AP: {
        guarantees: ['Availability', 'Partition Tolerance'],
        sacrifices: 'Consistency',
        behavior: 'Always serves reads/writes, even with stale data',
        example: 'DynamoDB, Cassandra, CouchDB, Riak',
        currentProject: 'CampusWatch AP demo mode'
      },
      CA: {
        guarantees: ['Consistency', 'Availability'],
        sacrifices: 'Partition Tolerance',
        behavior: 'Works only when all nodes are connected (no real distributed system)',
        example: 'Traditional RDBMS (single-node PostgreSQL, MySQL)',
        currentProject: 'Not applicable — network partitions always possible in distributed systems'
      }
    };
  }
}

module.exports = { CAPDemonstrator };
