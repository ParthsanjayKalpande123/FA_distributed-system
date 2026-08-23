// Express routes for bookings
const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createBookingRoutes(raftNode, stateMachine, redisPubSub) {
  const router = express.Router();

  router.post('/api/booking', async (req, res) => {
    try {
      const bookingId = uuidv4();
      const result = await raftNode.propose({ type: 'CREATE_BOOKING', bookingId, ...req.body });
      res.status(201).json(result);
    } catch (error) {
      if (error.message && error.message !== 'TIMEOUT' && error.message !== 'NO_LEADER') {
        res.status(307).json({ leaderId: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.patch('/api/booking/:id', async (req, res) => {
    try {
      const result = await raftNode.propose({ 
        type: 'DECIDE_BOOKING', 
        bookingId: req.params.id, 
        decision: req.body.decision, 
        decidedBy: req.body.decidedBy 
      });
      if (result) {
        redisPubSub.publishBookingNotification({ 
          bookingId: result.id, 
          status: result.status, 
          resource: result.resource 
        });
        res.json(result);
      } else {
        res.status(404).json({ error: 'Booking not found' });
      }
    } catch (error) {
      if (error.message && error.message !== 'TIMEOUT' && error.message !== 'NO_LEADER') {
        res.status(307).json({ leaderId: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.get('/api/booking', (req, res) => {
    const { status, requestedBy } = req.query;
    const result = stateMachine.booking.query({ status, requestedBy });
    res.json(result);
  });

  router.get('/api/booking/:id', (req, res) => {
    const result = stateMachine.booking.getById(req.params.id);
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Booking not found' });
    }
  });

  return router;
}

module.exports = { createBookingRoutes };
