# CTF-WebEnvironments - Claude API Integration Guide

This document outlines how Claude (acting within CTF-Arena) should interact with the `CTF-WebEnvironments` Orchestrator API to provision dynamic web challenges.

## Endpoint

**POST** `[ORCHESTRATOR_URL]/api/generate`

## Payload Schema

Send a JSON payload with the following structure to generate an environment.

```json
{
  "template": "dashboard", // "blog", "dashboard", or "ecommerce"
  "theme_color": "#2c3e50", // Hex color or CSS color name to randomize the visual theme
  "vulnerabilities": [
    "sqli_auth",     // Enables SQLi on the login screen
    "idor"           // Enables Insecure Direct Object Reference on the dashboard
  ],
  "db_settings": {
    "hash_passwords": true // If false, passwords are plain text. If true, MD5 is used.
  },
  "mock_data": {
    "users": [
      {
        // Custom data injected directly into the template's SQLite database
        // Schema is predefined. Do not invent custom columns!
        "username": "admin", 
        "password_raw": "supersecret", 
        "role": "admin",
        "department": "IT Support"
      }
    ]
  },
  "custom_files": [
    {
      "path": "secret.txt",
      "content": "CTF{this_is_a_flag}"
    }
  ]
}
```

## Available Templates & Schemas

The system provides baseline data for all templates, so you do not need to generate full databases. Only use `mock_data` to inject the *specific* records needed to solve the CTF challenge (e.g., an admin user, or a hidden message).

### 1. `dashboard` (Employee Portal)
- **Focus**: Authentication bypass, IDOR.
- **Vulnerabilities**: `sqli_auth`, `idor`
- **Schemas**:
  - `users`: `id`, `username`, `password_raw`, `password_hash`, `role`, `department`
  - `messages`: `id`, `sender_id`, `receiver_id`, `content`, `is_read`

### 2. `ecommerce` (Online Store) - *Coming Soon*
- **Focus**: Search SQLi, Path Traversal.
- **Vulnerabilities**: `sqli_search`, `path_traversal`
- **Schemas**:
  - `users`: `id`, `username`, `password_raw`, `password_hash`, `role`, `bio`
  - `products`: `id`, `name`, `price`, `description`, `image_url`

### 3. `blog` (Static Blog) - *Coming Soon*
- **Focus**: Information Exposure, XSS.
- **Vulnerabilities**: `info_exposure`
- **Schemas**:
  - `posts`: `id`, `title`, `content`, `author`, `is_published`
  - `comments`: `id`, `post_id`, `author`, `content`

## Response

The Orchestrator will respond with:

```json
{
  "success": true,
  "instance_id": "env-1a2b3c4d",
  "url": "http://domain.com/ctf-env/env-1a2b3c4d/",
  "expires_in": "3 hours"
}
```

Provide the resulting `url` to the user so they can access the challenge.
