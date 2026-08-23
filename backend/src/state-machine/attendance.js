// Attendance State Machine
class AttendanceStateMachine {
  constructor() {
    this.records = new Map(); // date_string -> Map<studentId, { present, markedBy, timestamp }>
  }

  apply(command) {
    if (command.type === 'MARK_ATTENDANCE') {
      const { date, studentId, present, markedBy } = command;
      if (!this.records.has(date)) {
        this.records.set(date, new Map());
      }
      const record = { present, markedBy, timestamp: Date.now() };
      this.records.get(date).set(studentId, record);
      return { date, studentId, ...record };
    }
    return null;
  }

  query(date) {
    if (!this.records.has(date)) return [];
    const dateRecords = this.records.get(date);
    const result = [];
    for (const [studentId, record] of dateRecords.entries()) {
      result.push({ studentId, ...record });
    }
    return result;
  }

  getAll() {
    const result = [];
    for (const [date, dateMap] of this.records.entries()) {
      for (const [studentId, record] of dateMap.entries()) {
        result.push({ date, studentId, ...record });
      }
    }
    return result;
  }
}

module.exports = { AttendanceStateMachine };
