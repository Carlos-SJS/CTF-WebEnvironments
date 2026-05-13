const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ejs = require('ejs');

const router = express.Router();

function getDb(req) {
  const dbPath = path.join(req.instanceInfo.path, 'database.sqlite');
  return new sqlite3.Database(dbPath);
}

function renderView(res, req, viewName, data = {}) {
  const viewPath = path.join(__dirname, 'views', `${viewName}.ejs`);
  const theme = req.instanceInfo.config.theme_color || '#2ecc71'; // Default blog green theme
  
  ejs.renderFile(viewPath, { ...data, theme, req }, {}, (err, str) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Template rendering error');
    }
    res.send(str);
  });
}

// Info Exposure Vulnerability
// If enabled, we simulate a misconfigured static file server that exposes
// the entire instance directory (allowing players to read `.env`, `secret.txt`, etc.)
router.use('/assets', (req, res, next) => {
  const config = req.instanceInfo.config;
  const vulns = config.vulnerabilities || [];

  if (vulns.includes('info_exposure')) {
    // Expose the instance directory directly, allowing dotfiles (like .env)
    express.static(req.instanceInfo.path, { dotfiles: 'allow' })(req, res, next);
  } else {
    // Only pretend to serve safe assets
    res.status(403).send("Forbidden: Directory listing denied.");
  }
});

// Routes
router.get('/', (req, res) => {
  const db = getDb(req);
  db.all(`SELECT * FROM posts WHERE is_published = 1 ORDER BY id DESC`, (err, posts) => {
    db.close();
    renderView(res, req, 'blog', { posts: posts || [] });
  });
});

router.get('/post/:id', (req, res) => {
  const db = getDb(req);
  const id = req.params.id;

  db.get(`SELECT * FROM posts WHERE id = ?`, [id], (err, post) => {
    if (err || !post) {
      db.close();
      return res.status(404).send('Post not found');
    }

    db.all(`SELECT * FROM comments WHERE post_id = ?`, [id], (err, comments) => {
      db.close();
      renderView(res, req, 'post', { post, comments: comments || [] });
    });
  });
});

module.exports = router;
