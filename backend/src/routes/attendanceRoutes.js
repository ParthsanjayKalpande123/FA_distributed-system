// Express routes for attendance
const express = require('express');

function createAttendanceRoutes(raftNode, stateMachine) {
  const router = express.Router();

  router.post('/api/attendance', async (req, res) => {
    try {
      const result = await raftNode.propose({ type: 'MARK_ATTENDANCE', ...req.body });
      res.status(201).json(result);
    } catch (error) {
      if (error.message && error.message !== 'TIMEOUT' && error.message !== 'NO_LEADER') {
        res.status(307).json({ leaderId: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.get('/api/attendance', (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    const result = stateMachine.attendance.query(date);
    res.json(result);
  });

  return router;
}

module.exports = { createAttendanceRoutes };
