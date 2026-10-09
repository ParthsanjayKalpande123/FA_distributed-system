// Express routes for attendance
const express = require('express');

function createAttendanceRoutes(raftNode, stateMachine) {
  const router = express.Router();

  router.post('/api/attendance', async (req, res) => {
    try {
      const { date, studentId, present } = req.body;
      if (typeof date !== 'string' || !date.trim() || date === 'undefined' || date === 'null') {
        return res.status(400).json({ error: 'A valid attendance date is required' });
      }
      if (typeof studentId !== 'string' || !studentId.trim()) {
        return res.status(400).json({ error: 'A student ID is required' });
      }
      if (typeof present !== 'boolean') {
        return res.status(400).json({ error: 'Attendance status must be present or absent' });
      }
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
    const { date, subject } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    const result = stateMachine.attendance.query(date, subject);
    res.json(result);
  });

  return router;
}

module.exports = { createAttendanceRoutes };
