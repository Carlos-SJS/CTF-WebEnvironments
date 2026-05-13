# CTF-WebEnvironments

This is the Orchestrator API for generating on-the-fly, temporary Web Exploitation environments for **CTF-Arena**. 

Claude (via the CTF-Arena main app) communicates with this API to dynamically spin up vulnerable web applications with injected flags.

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Orchestrator:**
   ```bash
   node index.js
   ```
   *The server runs on port `3001` by default.*

3. **Environment Variables (.env):**
   - `PORT`: Override the default 3001 port.
   - `BASE_URL`: The public base URL returned to Claude (e.g., `https://yourdomain.com`).

## Templates

- **Dashboard:** An employee portal vulnerable to SQLi (Auth Bypass) and IDOR.
- **Ecommerce:** An online store vulnerable to SQLi (Search) and Path Traversal.
- **Blog:** A static blog vulnerable to Information Exposure.

## API Documentation

See [API_DOCS.md](./API_DOCS.md) for details on how Claude interacts with the Orchestrator to provision these environments.
