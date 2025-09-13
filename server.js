require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Database initialization
const db = new sqlite3.Database('./citycompass.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if they don't exist
db.serialize(() => {
  // Issues table
  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Departments table
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department_id TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Issue updates table
  db.run(`CREATE TABLE IF NOT EXISTS issue_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER,
    department_id INTEGER,
    status TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues (id),
    FOREIGN KEY (department_id) REFERENCES departments (id)
  )`);

  // Create admin user if not exists
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO departments (name, email, password, department_id, category, address, phone, is_verified) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['Admin Department', 'admin@citycompass.gov', adminPassword, 'ADMIN001', 'Administration', 'City Hall', '555-1234', 1]);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.department_id) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Report an issue
app.post('/api/issues', upload.single('image'), (req, res) => {
  try {
    const { category, title, description, location, priority } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    console.log('Received issue data:', { category, title, description, location, priority, imageUrl });

    if (!category || !title || !description || !location) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    db.run(
      `INSERT INTO issues (category, title, description, location, image_url, priority) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [category, title, description, location, imageUrl, priority || 'normal'],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create issue' });
        }

        // Get the newly created issue
        db.get(
          `SELECT * FROM issues WHERE id = ?`,
          [this.lastID],
          (err, issue) => {
            if (err) {
              console.error('Error fetching created issue:', err);
              return res.status(500).json({ error: 'Failed to fetch created issue' });
            }
            
            res.status(201).json({
              message: 'Issue reported successfully',
              issue: issue
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in issue submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all issues (with optional filters)
app.get('/api/issues', (req, res) => {
  const { category, status, limit = 20, offset = 0 } = req.query;
  let query = `SELECT * FROM issues`;
  let conditions = [];
  let params = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, issues) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(issues);
  });
});

// Get a specific issue
app.get('/api/issues/:id', (req, res) => {
  const issueId = req.params.id;

  db.get(
    `SELECT * FROM issues WHERE id = ?`,
    [issueId],
    (err, issue) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!issue) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      res.json(issue);
    }
  );
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { department_id, password } = req.body;

  if (!department_id || !password) {
    return res.status(400).json({ error: 'Department ID and password are required' });
  }

  db.get(
    'SELECT * FROM departments WHERE department_id = ? AND is_verified = 1',
    [department_id],
    async (err, department) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!department) {
        return res.status(401).json({ error: 'Invalid credentials or department not verified' });
      }

      try {
        const validPassword = await bcrypt.compare(password, department.password);
        
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { 
            id: department.id, 
            department_id: department.department_id, 
            name: department.name,
            category: department.category
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          message: 'Login successful',
          token,
          department: { 
            id: department.id, 
            name: department.name, 
            department_id: department.department_id,
            category: department.category
          }
        });
      } catch (error) {
        console.error('Error comparing passwords:', error);
        res.status(500).json({ error: 'Server error' });
      }
    }
  );
});

// Get statistics for dashboard
app.get('/api/stats', (req, res) => {
  const stats = {};

  // Get total issues count
  db.get('SELECT COUNT(*) as total FROM issues', (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    stats.totalIssues = row.total;

    // Get issues by status
    db.all('SELECT status, COUNT(*) as count FROM issues GROUP BY status', (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      stats.byStatus = rows;

      // Get issues by category
      db.all('SELECT category, COUNT(*) as count FROM issues GROUP BY category', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        stats.byCategory = rows;

        // Get recent issues
        db.all('SELECT * FROM issues ORDER BY created_at DESC LIMIT 5', (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          stats.recentIssues = rows;

          res.json(stats);
        });
      });
    });
  });
});

// Admin routes - get all issues for admin
app.get('/api/admin/issues', authenticateToken, requireAdmin, (req, res) => {
  const { status, category, limit = 50, offset = 0 } = req.query;
  let query = `SELECT * FROM issues`;
  let conditions = [];
  let params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, issues) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(issues);
  });
});

// Admin routes - update issue status
app.put('/api/admin/issues/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const issueId = req.params.id;
  const { status, comment } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  // Update the issue
  db.run(
    'UPDATE issues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, issueId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update issue' });
      }

      // Add an update record
      db.run(
        'INSERT INTO issue_updates (issue_id, department_id, status, comment) VALUES (?, ?, ?, ?)',
        [issueId, req.user.id, status, comment || ''],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create update record' });
          }

          res.json({ message: 'Issue status updated successfully' });
        }
      );
    }
  );
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});