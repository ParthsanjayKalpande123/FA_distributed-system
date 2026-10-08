const axios = require('axios');

class ElectionComparison {
  constructor(config) {
    this.config = config;
  }

  async collectAvailableNodes() {
    const nodes = [{
      id: this.config.nodeId,
      host: this.config.nodeId,
      port: this.config.port,
      alive: true
    }];

    const peerResults = await Promise.all(this.config.peers.map(async peer => {
      try {
        const response = await axios.get(`http://${peer.host}:${peer.port}/health`, { timeout: 2000 });
        return {
          id: response.data.nodeId,
          host: peer.host,
          port: peer.port,
          alive: response.data.status === 'ok'
        };
      } catch (error) {
        return { id: peer.id, host: peer.host, port: peer.port, alive: false };
      }
    }));

    return [...nodes, ...peerResults];
  }

  async compare({ failedNode = null, candidateId = null } = {}) {
    const observedNodes = await this.collectAvailableNodes();
    const activeNodes = observedNodes
      .filter(node => node.alive && node.id !== failedNode)
      .map(node => node.id)
      .sort();

    if (activeNodes.length === 0) {
      throw new Error('At least one node must remain available for the comparison.');
    }

    const candidate = candidateId || activeNodes[0];
    if (!activeNodes.includes(candidate)) {
      throw new Error(`Candidate '${candidate}' is not an available node in this scenario.`);
    }

    const totalNodes = this.config.peers.length + 1;
    const quorum = Math.floor(totalNodes / 2) + 1;
    const raftCanElect = activeNodes.length >= quorum;
    const raftMessages = (activeNodes.length - 1) * (raftCanElect ? 4 : 2);
    const higherNodes = activeNodes.filter(id => id > candidate);
    const bullyCandidates = activeNodes.filter(id => id >= candidate);
    const bullyRequests = bullyCandidates.reduce((count, id) =>
      count + bullyCandidates.filter(other => other > id).length, 0);
    const ringMessageCount = activeNodes.length <= 1 ? 0 : activeNodes.length * 2;
    const bullyMessageCount = bullyRequests * 2 + Math.max(0, activeNodes.length - 1);

    return {
      mode: 'simulation',
      note: 'All rows model this scenario; only Raft runs as the cluster consensus protocol. Bully and Ring are not running cluster services.',
      scenario: {
        configuredNodes: totalNodes,
        observedOnlineNodes: observedNodes.filter(node => node.alive).map(node => node.id),
        failedNode,
        activeNodes,
        candidateId: candidate,
        raftQuorum: quorum
      },
      results: [
        {
          algorithm: 'Raft',
          implementedInCluster: true,
          electedLeader: activeNodes.length >= quorum ? candidate : null,
          success: raftCanElect,
          messageCount: raftMessages,
          estimatedRounds: raftCanElect ? 2 : 1,
          estimatedDurationMs: raftCanElect ? this.config.electionTimeoutMax + this.config.heartbeatInterval : this.config.electionTimeoutMax,
          details: raftCanElect
            ? `Candidate ${candidate} receives votes from a majority of the configured cluster.`
            : `Only ${activeNodes.length} of ${totalNodes} nodes are available; Raft requires ${quorum} votes, so it does not elect a leader.`
        },
        {
          algorithm: 'Bully',
          implementedInCluster: false,
          electedLeader: activeNodes[activeNodes.length - 1],
          success: true,
          messageCount: bullyMessageCount,
          estimatedRounds: activeNodes.length <= 1 ? 0 : higherNodes.length * 2 + 1,
          estimatedDurationMs: (activeNodes.length <= 1 ? 0 : higherNodes.length * 2 + 1) * 100,
          details: `Higher-priority active nodes respond to election messages; ${activeNodes[activeNodes.length - 1]} has the highest priority.`
        },
        {
          algorithm: 'Ring',
          implementedInCluster: false,
          electedLeader: activeNodes[activeNodes.length - 1],
          success: true,
          messageCount: ringMessageCount,
          estimatedRounds: ringMessageCount,
          estimatedDurationMs: ringMessageCount * 100,
          details: `Election and coordinator messages each circulate once through the active-node ring.`
        }
      ]
    };
  }
}

module.exports = { ElectionComparison };
