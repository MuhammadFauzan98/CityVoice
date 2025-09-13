const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Initialize database with sample data
const db = new sqlite3.Database('./citycompass.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables
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

  // Create sample departments
  const departments = [
    {
      name: 'Public Works Department',
      email: 'publicworks@citycompass.gov',
      password: bcrypt.hashSync('publicworks123', 10),
      department_id: 'PWD001',
      category: 'Roads & Potholes',
      address: '123 Main Street, City Hall',
      phone: '555-1001',
      is_verified: 1
    },
    {
      name: 'Sanitation Department',
      email: 'sanitation@citycompass.gov',
      password: bcrypt.hashSync('sanitation123', 10),
      department_id: 'SND002',
      category: 'Waste Management',
      address: '456 Clean Street',
      phone: '555-1002',
      is_verified: 1
    },
    {
      name: 'Water Department',
      email: 'water@citycompass.gov',
      password: bcrypt.hashSync('water123', 10),
      department_id: 'WTD003',
      category: 'Water Supply',
      address: '789 Water Avenue',
      phone: '555-1003',
      is_verified: 1
    }
  ];

  const insertDept = db.prepare(`INSERT OR IGNORE INTO departments 
    (name, email, password, department_id, category, address, phone, is_verified) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  departments.forEach(dept => {
    insertDept.run([dept.name, dept.email, dept.password, dept.department_id, 
                   dept.category, dept.address, dept.phone, dept.is_verified]);
  });

  insertDept.finalize();

  // Create sample issues
  const issues = [
    {
      category: 'Roads & Potholes',
      title: 'Large pothole on Main St',
      description: 'There is a large pothole that needs immediate attention',
      location: 'Main St & 5th Ave',
      status: 'pending',
      priority: 'high'
    },
    {
      category: 'Waste Management',
      title: 'Overflowing trash bin',
      description: 'Public trash bin has been overflowing for 2 days',
      location: 'Central Park',
      status: 'in-progress',
      priority: 'medium'
    },
    {
      category: 'Street Lighting',
      title: 'Broken street light',
      description: 'Street light has been out for a week',
      location: 'Oak Street',
      status: 'resolved',
      priority: 'low'
    },
    {
      category: 'Water Supply',
      title: 'Water leak on sidewalk',
      description: 'Constant water leak from underground pipe',
      location: '3rd Ave & Elm St',
      status: 'pending',
      priority: 'high'
    }
  ];

  const insertIssue = db.prepare(`INSERT OR IGNORE INTO issues 
    (category, title, description, location, status, priority) 
    VALUES (?, ?, ?, ?, ?, ?)`);

  issues.forEach(issue => {
    insertIssue.run([issue.category, issue.title, issue.description, 
                    issue.location, issue.status, issue.priority]);
  });

  insertIssue.finalize();

  console.log('Database initialized with sample data');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Database connection closed.');
  }
});