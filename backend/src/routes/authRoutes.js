// Express routes for hardcoded auth
const express = require('express');

const USERS = [
  { userId: 'T001', name: 'Dr. Sharma', role: 'teacher' },
  { userId: 'T002', name: 'Dr. Patel', role: 'teacher' },
  { userId: 'S001', name: 'Rahul Kumar', role: 'student' },
  { userId: 'S002', name: 'Priya Singh', role: 'student' },
  { userId: 'S003', name: 'Amit Verma', role: 'student' },
  { userId: 'S004', name: 'Sneha Gupta', role: 'student' },
  { userId: 'S005', name: 'Vikram Reddy', role: 'student' },
  { userId: 'HOD001', name: 'Prof. Iyer', role: 'hod' },
  { userId: 'ADMIN001', name: 'System Admin', role: 'admin' },
];

function createAuthRoutes() {
  const router = express.Router();

  router.post('/api/login', (req, res) => {
    const user = USERS.find(u => u.userId === req.body.userId);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid user' });
    }
  });

  router.get('/api/users', (req, res) => {
    res.json(USERS);
  });

  router.get('/api/users/:role', (req, res) => {
    const filtered = USERS.filter(u => u.role === req.params.role);
    res.json(filtered);
  });

  return router;
}

module.exports = { createAuthRoutes };
