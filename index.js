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

app.post('/api/generate', async (req, res) => {
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
        // Prevent path traversal on custom file creation
        const safeFileName = path.basename(file.path);
        fs.writeFileSync(path.join(instancePath, safeFileName), file.content);
      });
    }

    // Initialize database from template and mock data
    await buildDatabase(instancePath, config.template, config);
    
    // Return the URL for Claude
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
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
