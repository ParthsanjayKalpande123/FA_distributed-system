// Booking State Machine
class BookingStateMachine {
  constructor() {
    this.bookings = new Map();
  }

  apply(command) {
    if (command.type === 'CREATE_BOOKING') {
      const { bookingId, resource, date, timeSlot, requestedBy } = command;
      const booking = {
        id: bookingId,
        resource,
        date,
        timeSlot,
        requestedBy,
        status: 'pending',
        createdAt: Date.now()
      };
      this.bookings.set(bookingId, booking);
      return booking;
    }
    
    if (command.type === 'DECIDE_BOOKING') {
      const { bookingId, decision, decidedBy } = command;
      const booking = this.bookings.get(bookingId);
      if (!booking) return null;
      
      if (decision === 'approved') {
        // Check conflicts
        for (const [id, b] of this.bookings.entries()) {
          if (b.status === 'approved' && b.resource === booking.resource && b.date === booking.date && b.timeSlot === booking.timeSlot) {
            booking.status = 'rejected';
            booking.decidedBy = decidedBy;
            booking.reason = 'Conflict';
            return booking;
          }
        }
      }
      
      booking.status = decision;
      booking.decidedBy = decidedBy;
      return booking;
    }
    return null;
  }

  query({ status, requestedBy } = {}) {
    let result = Array.from(this.bookings.values());
    if (status) {
      result = result.filter(b => b.status === status);
    }
    if (requestedBy) {
      result = result.filter(b => b.requestedBy === requestedBy);
    }
    return result;
  }

  getById(id) {
    return this.bookings.get(id) || null;
  }

  getAll() {
    return Array.from(this.bookings.values());
  }
}

module.exports = { BookingStateMachine };
