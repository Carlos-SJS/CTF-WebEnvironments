const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const ejs = require('ejs');

function hashPassword(password, algorithm = 'md5') {
  return crypto.createHash(algorithm).update(password).digest('hex');
}

// Create a router
const router = express.Router();

// Helper to get DB connection per request
function getDb(req) {
  const dbPath = path.join(req.instanceInfo.path, 'database.sqlite');
  return new sqlite3.Database(dbPath);
}

// Render helper for EJS
function renderView(res, req, viewName, data = {}) {
  const viewPath = path.join(__dirname, 'views', `${viewName}.ejs`);
  const theme = req.instanceInfo.config.theme_color || '#3498db';
  
  ejs.renderFile(viewPath, { ...data, theme, req }, {}, (err, str) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Template rendering error');
    }
    res.send(str);
  });
}

// Routes
router.get('/', (req, res) => {
  if (req.query.logout) {
    // Basic stateless logout simulation
    return res.redirect('?');
  }
  renderView(res, req, 'login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb(req);
  const config = req.instanceInfo.config;
  const vulns = config.vulnerabilities || [];

  if (vulns.includes('sqli_auth')) {
    // Vulnerable SQL Injection!
    // Using string concatenation directly
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    db.get(query, (err, row) => {
      db.close();
      if (err) {
        return renderView(res, req, 'login', { error: 'Database error: ' + err.message });
      }
      if (row) {
        return res.redirect(`dashboard?user_id=${row.id}`);
      } else {
        return renderView(res, req, 'login', { error: 'Invalid credentials (vulnerable query)' });
      }
    });
  } else {
    // Secure Login
    const isHashed = config.db_settings?.hash_passwords;
    const query = `SELECT * FROM users WHERE username = ? AND password = ?`;
    
    const checkPassword = isHashed ? hashPassword(password) : password;

    db.get(query, [username, checkPassword], (err, row) => {
      db.close();
      if (err) return res.status(500).send('Database error');
      if (row) {
        return res.redirect(`dashboard?user_id=${row.id}`); // Simple stateless auth for CTF purposes
      } else {
        return renderView(res, req, 'login', { error: 'Invalid credentials' });
      }
    });
  }
});

router.get('/dashboard', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.redirect('.');
  }

  const db = getDb(req);
  const config = req.instanceInfo.config;
  const vulns = config.vulnerabilities || [];

  // In a real app, user_id from query params without session checking is IDOR.
  // We'll simulate IDOR by whether it allows fetching ANY user or just a hardcoded one,
  // but since it's a CTF, if IDOR is enabled, they can view any ID. 
  // If disabled, we might restrict it to only ID 1 or reject if no valid session token exists.
  // For simplicity:
  // If IDOR is enabled: any ?user_id works.
  // If IDOR is disabled: we simulate a check (e.g. only allows id=1 or requires a complex token we don't implement here, basically enforcing id=1 if not vulnerable to idor).
  
  if (!vulns.includes('idor') && userId !== '1') {
    db.close();
    return res.status(403).send("Access Denied: You can only view your own profile (User 1). IDOR is disabled.");
  }

  db.get(`SELECT id, username, role, department FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      db.close();
      return res.status(500).send('Database error');
    }
    if (!user) {
      db.close();
      return res.status(404).send('User not found');
    }

    // Fetch messages for this user
    db.all(`SELECT * FROM messages WHERE receiver_id = ?`, [userId], (err, messages) => {
      db.close();
      renderView(res, req, 'dashboard', { user, messages: messages || [] });
    });
  });
});

module.exports = router;
