const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = { template: 'blog', vulnerabilities: ['file_metadata'], file_metadata_payload: 'CTF{test}' };
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const INSTANCES_DIR = path.join(__dirname, 'instances');
const instanceId = 'env-test123';
const instancePath = path.join(INSTANCES_DIR, instanceId);

if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath);

if ((config.vulnerabilities || []).includes('file_metadata') && config.file_metadata_payload) {
  if (config.template === 'blog') {
    const imagesDir = path.join(TEMPLATES_DIR, 'blog', 'assets', 'images');
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
      if (files.length > 0) {
        const randomFile = files[Math.floor(Math.random() * files.length)];
        let imgBuf = fs.readFileSync(path.join(imagesDir, randomFile));
        const flagBuf = Buffer.from('\n' + config.file_metadata_payload + '\n', 'utf8');
        imgBuf = Buffer.concat([imgBuf, flagBuf]);
        const targetImageName = 'post_image_' + uuidv4().split('-')[0] + '.png';
        const outPath = path.join(instancePath, targetImageName);
        fs.writeFileSync(outPath, imgBuf);
        console.log('File written to:', outPath);
        console.log('Exists?', fs.existsSync(outPath));
      } else { console.log('No files found'); }
    } else { console.log('imagesDir not found'); }
  }
}
