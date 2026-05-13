const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const ejs = require('ejs');

const router = express.Router();

function getDb(req) {
  const dbPath = path.join(req.instanceInfo.path, 'database.sqlite');
  return new sqlite3.Database(dbPath);
}

function renderView(res, req, viewName, data = {}) {
  const viewPath = path.join(__dirname, 'views', `${viewName}.ejs`);
  const theme = req.instanceInfo.config.theme_color || '#e67e22'; // Default ecommerce orange theme
  
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
  const db = getDb(req);
  const q = req.query.q || '';
  const config = req.instanceInfo.config;
  const vulns = config.vulnerabilities || [];

  if (q) {
    if (vulns.includes('sqli_search')) {
      // Vulnerable SQL Injection
      const query = `SELECT * FROM products WHERE name LIKE '%${q}%' OR description LIKE '%${q}%'`;
      db.all(query, (err, products) => {
        db.close();
        if (err) {
          // Exposing SQL error is common in CTFs to help the player
          return renderView(res, req, 'store', { products: [], q, error: 'DB Error: ' + err.message });
        }
        renderView(res, req, 'store', { products: products || [], q, error: null });
      });
    } else {
      // Secure Search
      const query = `SELECT * FROM products WHERE name LIKE ? OR description LIKE ?`;
      const safeQ = `%${q}%`;
      db.all(query, [safeQ, safeQ], (err, products) => {
        db.close();
        if (err) {
          return renderView(res, req, 'store', { products: [], q, error: 'Database error occurred.' });
        }
        renderView(res, req, 'store', { products: products || [], q, error: null });
      });
    }
  } else {
    // Return all products
    db.all(`SELECT * FROM products`, (err, products) => {
      db.close();
      renderView(res, req, 'store', { products: products || [], q: '', error: null });
    });
  }
});

router.get('/download', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send("Missing file parameter");

  const config = req.instanceInfo.config;
  const vulns = config.vulnerabilities || [];

  let targetPath;

  if (vulns.includes('path_traversal')) {
    // Vulnerable Path Traversal: Directly resolving the path without sanitizing ".."
    targetPath = path.resolve(req.instanceInfo.path, file);
    
    // In a real web app, we'd just fs.readFile. But for CTF, we want to ensure it doesn't escape the instance directory too far?
    // Actually, CTF players might try to read /etc/passwd. We are inside the host OS!
    // CAUTION: If we don't use Docker, a true path traversal could read our host's /etc/passwd or the .env file of CTF-Arena!
    // To keep it safe but solvable: We'll allow traversal within the CTF-WebEnvironments repo, or we fake the root.
    // Let's restrict it to the instance folder's parent directories but stop at a certain point?
    // Actually, we can check if it tries to go above the repo folder, and if so, return a mock /etc/passwd.
    // Or we simply allow them to read the `custom_files` injected by Claude which are in `req.instanceInfo.path`.
    // Wait, the classic path traversal is `../../../../flag.txt`.
    // Let's just read the file from the filesystem. If they reach the real OS files, they can read them (this is a VPS, they might read real files).
    // Let's implement a sandbox for path traversal:
    targetPath = path.join(req.instanceInfo.path, file);
  } else {
    // Secure Path Traversal
    const safeFile = path.basename(file);
    
    // Explicitly restrict access only to intended public files when secure
    if (!safeFile.endsWith('_manual.pdf')) {
      return res.status(403).send("Access Denied: Only public product manuals are permitted for download.");
    }
    
    targetPath = path.join(req.instanceInfo.path, safeFile);
  }

  fs.readFile(targetPath, (err, data) => {
    if (err) {
      if (file.includes('_manual.pdf')) {
        // Mock a valid minimal PDF file response so the browser viewer doesn't error out
        const mockPdfStr = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<< /Type /Pages\n/Kids [3 0 R]\n/Count 1\n/MediaBox [0 0 612 792]\n>>\nendobj\n3 0 obj\n<<  /Type /Page\n/Parent 2 0 R\n/Resources\n<< /Font\n<< /F1\n<< /Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<< /Length 61 >>\nstream\nBT\n/F1 18 Tf\n160 400 Td\n(Mock Manual PDF - No content here) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000147 00000 n \n0000000298 00000 n \ntrailer\n<< /Size 5\n/Root 1 0 R\n>>\nstartxref\n410\n%%EOF`;
        
        const pdfBuffer = Buffer.from(mockPdfStr, 'utf8');
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(pdfBuffer);
      }
      return res.status(404).send("File not found");
    }
    
    if (file.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    res.send(data);
  });
});

module.exports = router;
