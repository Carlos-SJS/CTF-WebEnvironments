require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { buildDatabase } = require('./src/dbBuilder');
const dashboardHandler = require('./templates/dashboard');
const ecommerceHandler = require('./templates/ecommerce');
const blogHandler = require('./templates/blog');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const INSTANCES_DIR = path.join(__dirname, 'instances');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Ensure directories exist
if (!fs.existsSync(INSTANCES_DIR)) fs.mkdirSync(INSTANCES_DIR);
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR);
  // Create template subdirectories
  fs.mkdirSync(path.join(TEMPLATES_DIR, 'blog'));
  fs.mkdirSync(path.join(TEMPLATES_DIR, 'dashboard'));
  fs.mkdirSync(path.join(TEMPLATES_DIR, 'ecommerce'));
}

// ---------------------------------------------------------
// Orchestrator Endpoints
// ---------------------------------------------------------

app.post('/ctf-api/generate', async (req, res) => {
  const config = req.body;

  if (!config || !config.template) {
    return res.status(400).json({ error: 'Missing template configuration' });
  }

  const instanceId = `env-${uuidv4().split('-')[0]}`;
  const instancePath = path.join(INSTANCES_DIR, instanceId);

  try {
    fs.mkdirSync(instancePath);

    // Save config for the instance handler to read
    fs.writeFileSync(
      path.join(instancePath, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // If custom_files exist, write them
    if (config.custom_files && Array.isArray(config.custom_files)) {
      config.custom_files.forEach(file => {
        // Safely extract the path components to support subdirectories
        // while stripping out any malicious `../` or absolute path attempts.
        const safeParts = file.path.split(/[/\\]/).filter(p => p && p !== '..');
        if (safeParts.length === 0) return; // Skip if invalid path
        
        const targetFilePath = path.join(instancePath, ...safeParts);
        const targetDir = path.dirname(targetFilePath);
        
        // Ensure the target directory exists before writing the file
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        fs.writeFileSync(targetFilePath, file.content);
      });
    }

    // Initialize database from template and mock data
    await buildDatabase(instancePath, config.template, config);

    // Feature: File Metadata Exploit (Automatic Injection)
    if ((config.vulnerabilities || []).includes('file_metadata') && config.file_metadata_payload) {
      if (config.template === 'blog') {
        const imagesDir = path.join(TEMPLATES_DIR, 'blog', 'assets', 'images');
        if (fs.existsSync(imagesDir)) {
          const rawFiles = fs.readdirSync(imagesDir);
          const files = rawFiles.filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
          if (files.length > 0) {
            const randomFile = files[Math.floor(Math.random() * files.length)];
            let imgBuf = fs.readFileSync(path.join(imagesDir, randomFile));

            // Inject user provided payload
            const flagBuf = Buffer.from(`\\n${config.file_metadata_payload}\\n`, 'utf8');
            imgBuf = Buffer.concat([imgBuf, flagBuf]);

            const targetImageName = `post_image_${uuidv4().split('-')[0]}.png`;
            const outPath = path.join(instancePath, targetImageName);
            fs.writeFileSync(outPath, imgBuf);

            // Update database to inject the image into the FIRST post
            await new Promise((resolve, reject) => {
              const dbPath = path.join(instancePath, 'database.sqlite');
              const sqlite3 = require('sqlite3').verbose();
              const db = new sqlite3.Database(dbPath);
              db.run(
                `UPDATE posts SET content = content || '<br><br><img src="images/' || ? || '" alt="Post Image" style="max-width: 100%; border-radius: 8px;">' WHERE id = (SELECT id FROM posts ORDER BY id ASC LIMIT 1)`,
                [targetImageName],
                (err) => {
                  db.close();
                  if (err) { console.error("Error updating post with image:", err); reject(err); }
                  else resolve();
                }
              );
            });
          }
        }
      } else if (config.template === 'ecommerce') {
        // We will pass the payload to the handler by saving it in the config
        // Actually, it's already in the config.json, so the handler can just read it from req.instanceInfo.config.file_metadata_payload
      }
    }

    // Return the URL for Claude
    const baseUrl = process.env.BASE_URL || `https://omiags.online`;
    const url = `${baseUrl}/ctf-env/${instanceId}/`;

    res.json({
      success: true,
      instance_id: instanceId,
      url: url,
      expires_in: '3 hours'
    });

  } catch (error) {
    console.error('Error generating instance:', error);
    res.status(500).json({ error: 'Failed to generate environment' });
  }
});

// ---------------------------------------------------------
// Dynamic Routing for Instances
// ---------------------------------------------------------

app.use('/ctf-env/:instanceId', (req, res, next) => {
  const { instanceId } = req.params;
  const instancePath = path.join(INSTANCES_DIR, instanceId);

  if (!fs.existsSync(instancePath)) {
    return res.status(404).send('Environment not found or has expired.');
  }

  // Read the config to know which template to serve
  const configPath = path.join(instancePath, 'config.json');
  if (!fs.existsSync(configPath)) {
    return res.status(500).send('Environment configuration missing.');
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return res.status(500).send('Invalid environment configuration.');
  }

  // Attach instance info to the request for the template handler to use
  req.instanceInfo = {
    id: instanceId,
    path: instancePath,
    config: config
  };

  // Dispatch to the correct template handler
  switch (config.template) {
    case 'ecommerce':
      return ecommerceHandler(req, res, next);
    case 'dashboard':
      return dashboardHandler(req, res, next);
    case 'blog':
      return blogHandler(req, res, next);
    default:
      return res.status(500).send('Unknown template specified in config.');
  }
});

// ---------------------------------------------------------
// Cleanup Cron
// ---------------------------------------------------------
setInterval(() => {
  console.log('Running cleanup checks...');
  const EXPIRATION_TIME_MS = 3 * 60 * 60 * 1000; // 3 hours

  fs.readdir(INSTANCES_DIR, (err, files) => {
    if (err) return console.error('Cleanup read dir error:', err);

    files.forEach(file => {
      const instancePath = path.join(INSTANCES_DIR, file);
      fs.stat(instancePath, (err, stats) => {
        if (err) return console.error('Cleanup stat error:', err);

        const now = new Date().getTime();
        const created = new Date(stats.birthtime).getTime();

        if (now - created > EXPIRATION_TIME_MS) {
          console.log(`Deleting expired instance: ${file}`);
          fs.rm(instancePath, { recursive: true, force: true }, (err) => {
            if (err) console.error(`Failed to delete instance ${file}:`, err);
          });
        }
      });
    });
  });
}, 60 * 60 * 1000); // Check every hour

app.listen(PORT, () => {
  console.log(`Orchestrator running on port ${PORT}`);
});
