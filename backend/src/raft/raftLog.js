// In-memory Raft log implementation

class RaftLog {
  constructor() {
    this.entries = []; // 1-indexed (effectively, 0th item is index 1)
    this.commitIndex = 0;
    this.lastApplied = 0;
  }

  append(term, command) {
    const entry = { term, index: this.entries.length + 1, command };
    this.entries.push(entry);
    return entry;
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
