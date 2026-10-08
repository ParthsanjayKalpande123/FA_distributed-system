// In-memory Raft log implementation

const crypto = require('crypto');

class RaftLog {
  constructor() {
    this.entries = []; // 1-indexed (effectively, 0th item is index 1)
    this.commitIndex = 0;
    this.lastApplied = 0;
  }

  append(term, command) {
    const index = this.entries.length + 1;
    const prevHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : '0'.repeat(64);
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256').update(`${prevHash}${term}${index}${JSON.stringify(command)}${timestamp}`).digest('hex');
    const entry = { term, index, command, timestamp, prevHash, hash };
    this.entries.push(entry);
    return entry;
  }

  verifyChain() {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const expectedPrevHash = i > 0 ? this.entries[i - 1].hash : '0'.repeat(64);
      if (entry.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: entry.index, totalEntries: this.entries.length };
      }
      const recomputedHash = crypto.createHash('sha256').update(`${entry.prevHash}${entry.term}${entry.index}${JSON.stringify(entry.command)}${entry.timestamp}`).digest('hex');
      if (entry.hash !== recomputedHash) {
        return { valid: false, brokenAt: entry.index, totalEntries: this.entries.length };
      }
    }
    return { valid: true, brokenAt: null, totalEntries: this.entries.length };
  }

  getChain() {
    return this.entries;
  }

  getEntry(index) {
    if (index < 1 || index > this.entries.length) return null;
    return this.entries[index - 1];
  }

  getLastIndex() {
    return this.entries.length;
  }

  getLastTerm() {
    if (this.entries.length === 0) return 0;
    return this.entries[this.entries.length - 1].term;
  }

  getEntriesFrom(startIndex) {
    if (startIndex < 1) startIndex = 1;
    return this.entries.slice(startIndex - 1);
  }

  truncateFrom(index) {
    if (index >= 1 && index <= this.entries.length) {
      this.entries = this.entries.slice(0, index - 1);
    }
  }

  getLength() {
    return this.entries.length;
  }
}

module.exports = { RaftLog };
