// Attendance State Machine
class AttendanceStateMachine {
  constructor() {
    // key: "date|subject" -> Map<studentId, { present, markedBy, subject, timestamp }>
    this.records = new Map();
  }

  _key(date, subject) {
    return `${date}|${subject || 'General'}`;
  }

  apply(command) {
    if (command.type === 'MARK_ATTENDANCE') {
      const { date, studentId, present, markedBy, subject } = command;
      const key = this._key(date, subject);
      if (!this.records.has(key)) {
        this.records.set(key, new Map());
      }
      const record = { present, markedBy, subject: subject || 'General', timestamp: Date.now() };
      this.records.get(key).set(studentId, record);
      return { date, studentId, ...record };
    }
    return null;
  }

  // query by date + optional subject
  query(date, subject) {
    if (subject) {
      const key = this._key(date, subject);
      if (!this.records.has(key)) return [];
      const result = [];
      for (const [studentId, record] of this.records.get(key).entries()) {
        result.push({ studentId, ...record });
      }
      return result;
    }
    // No subject filter — return all records for the date across all subjects
    const result = [];
    for (const [key, dateMap] of this.records.entries()) {
      if (key.startsWith(`${date}|`)) {
        for (const [studentId, record] of dateMap.entries()) {
          result.push({ studentId, ...record });
        }
      }
    }
    return result;
  }

  getAll() {
    const result = [];
    for (const [key, dateMap] of this.records.entries()) {
      const [date, subject] = key.split('|');
      for (const [studentId, record] of dateMap.entries()) {
        result.push({ date, subject, studentId, ...record });
      }
    }
    return result;
  }
}

module.exports = { AttendanceStateMachine };
