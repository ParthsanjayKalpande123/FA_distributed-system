// Express routes for hardcoded auth
const express = require('express');

// Hardcoded users with passwords for demo login
const USERS = [
  { userId: 'T001',    name: 'Dr. Sharma',   role: 'teacher', password: 'sharma123' },
  { userId: 'T002',    name: 'Dr. Patel',    role: 'teacher', password: 'patel123'  },
  { userId: 'S001',    name: 'Rahul Kumar',  role: 'student', password: 'rahul123'  },
  { userId: 'S002',    name: 'Priya Singh',  role: 'student', password: 'priya123'  },
  { userId: 'S003',    name: 'Amit Verma',   role: 'student', password: 'amit123'   },
  { userId: 'S004',    name: 'Sneha Gupta',  role: 'student', password: 'sneha123'  },
  { userId: 'S005',    name: 'Vikram Reddy', role: 'student', password: 'vikram123' },
  { userId: 'HOD001',  name: 'Prof. Iyer',   role: 'hod',     password: 'iyer123'   },
  { userId: 'ADMIN001',name: 'System Admin', role: 'admin',   password: 'admin123'  },
];

function createAuthRoutes() {
  const router = express.Router();

  // POST /api/login — validate userId + password
  router.post('/api/login', (req, res) => {
    const { userId, password } = req.body;
    const user = USERS.find(u => u.userId === userId && u.password === password);
    if (user) {
      // Never return the password to the client
      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } else {
      res.status(401).json({ error: 'Invalid User ID or password.' });
    }
  });

  // GET /api/users — return list without passwords
  router.get('/api/users', (req, res) => {
    res.json(USERS.map(({ password: _pw, ...u }) => u));
  });

  // GET /api/users/:role
  router.get('/api/users/:role', (req, res) => {
    const filtered = USERS
      .filter(u => u.role === req.params.role)
      .map(({ password: _pw, ...u }) => u);
    res.json(filtered);
  });

  return router;
}

module.exports = { createAuthRoutes };
