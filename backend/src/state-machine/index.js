// Combined State Machine
const { AttendanceStateMachine } = require('./attendance');
const { BookingStateMachine } = require('./booking');
const { FileSystemStateMachine } = require('./fileSystem');
const logger = require('../utils/logger');

class StateMachine {
  constructor() {
    this.attendance = new AttendanceStateMachine();
    this.booking = new BookingStateMachine();
    this.fileSystem = new FileSystemStateMachine();
  }

  apply(command) {
    if (command.type === 'MARK_ATTENDANCE') {
      return this.attendance.apply(command);
    } else if (command.type === 'CREATE_BOOKING' || command.type === 'DECIDE_BOOKING') {
      return this.booking.apply(command);
    } else if (command.type === 'UPLOAD_FILE' || command.type === 'DELETE_FILE' || command.type === 'RENAME_FILE') {
      return this.fileSystem.apply(command);
    } else {
      logger.warn(`Unknown command type: ${command.type}`);
      return null;
    }
  }
}

module.exports = { StateMachine };
