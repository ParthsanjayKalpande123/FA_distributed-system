// Unit 3 — Clock synchronization, piggybacked on gossip heartbeats.
//   Lamport logical clock, vector clock, and Cristian's algorithm (physical offset).
class Clocks {
  constructor(config) {
    this.nodeId = config.nodeId;
    this.lamport = 0;
    this.vector = { [config.nodeId]: 0 };
    config.peers.forEach(p => { this.vector[p.id] = 0; });
    this.offsets = {}; // peerId -> { offsetMs, rttMs } estimated with Cristian's algorithm
    this.events = [];  // recent send/receive events, newest last
  }

  _log(kind, peer) {
    this.events.push({ kind, peer, lamport: this.lamport, vector: { ...this.vector }, at: Date.now() });
    if (this.events.length > 20) this.events.shift();
  }

  // Send event: tick both clocks and return the timestamps to attach to the message.
  send(peer) {
    this.lamport++;
    this.vector[this.nodeId]++;
    this._log('send', peer);
    return { lamport: this.lamport, vector: { ...this.vector } };
  }

  // Receive event: Lamport = max(local, msg) + 1; vector = element-wise max, then tick own entry.
  receive(peer, { lamport = 0, vector = {} } = {}) {
    this.lamport = Math.max(this.lamport, lamport) + 1;
    for (const [id, t] of Object.entries(vector)) {
      this.vector[id] = Math.max(this.vector[id] || 0, t);
    }
    this.vector[this.nodeId]++;
    this._log('receive', peer);
  }

  // Cristian's algorithm: server time is assumed to be serverTime + RTT/2 when the reply arrives.
  cristian(peer, sentAt, serverTime, receivedAt) {
    const rttMs = receivedAt - sentAt;
    this.offsets[peer] = { offsetMs: serverTime + rttMs / 2 - receivedAt, rttMs };
  }

  // a happened-before b  <=>  a <= b element-wise and a != b
  static happenedBefore(a, b) {
    const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
    let strictly = false;
    for (const id of ids) {
      if ((a[id] || 0) > (b[id] || 0)) return false;
      if ((a[id] || 0) < (b[id] || 0)) strictly = true;
    }
    return strictly;
  }

  getStatus() {
    return {
      nodeId: this.nodeId,
      lamport: this.lamport,
      vector: this.vector,
      cristianOffsets: this.offsets,
      recentEvents: this.events
    };
  }
}

module.exports = { Clocks };

if (require.main === module) {
  const assert = require('assert');
  const a = new Clocks({ nodeId: 'a', peers: [{ id: 'b' }] });
  const b = new Clocks({ nodeId: 'b', peers: [{ id: 'a' }] });
  const m1 = a.send('b');
  b.receive('a', m1);
  assert.strictEqual(b.lamport, 2);
  assert.deepStrictEqual(b.vector, { a: 1, b: 1 });
  assert(Clocks.happenedBefore(m1.vector, b.vector));
  assert(!Clocks.happenedBefore(b.vector, m1.vector));
  assert(!Clocks.happenedBefore({ a: 1, b: 0 }, { a: 0, b: 1 })); // concurrent
  a.cristian('b', 1000, 5050, 1100);
  assert.strictEqual(a.offsets.b.offsetMs, 4000);
  console.log('clocks ok');
}
