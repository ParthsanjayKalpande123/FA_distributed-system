// Combined State Machine
const { AttendanceStateMachine } = require('./attendance');
const { BookingStateMachine } = require('./booking');
const logger = require('../utils/logger');

class StateMachine {
  constructor() {
    this.attendance = new AttendanceStateMachine();
    this.booking = new BookingStateMachine();
  }

  apply(command) {
    if (command.type === 'MARK_ATTENDANCE') {
      return this.attendance.apply(command);
    } else if (command.type === 'CREATE_BOOKING' || command.type === 'DECIDE_BOOKING') {
      return this.booking.apply(command);
    } else {
      logger.warn(`Unknown command type: ${command.type}`);
      return null;
    }
  }
}

module.exports = { StateMachine };
