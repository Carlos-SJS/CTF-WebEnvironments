// src/schemas.js

const schemas = {
  ecommerce: {
    tables: {
      users: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password_raw TEXT,
          password_hash TEXT,
          role TEXT DEFAULT 'user',
          bio TEXT
        `,
        columns: ['id', 'username', 'password_raw', 'password_hash', 'role', 'bio']
      },
      products: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          price REAL,
          description TEXT,
          image_url TEXT
        `,
        columns: ['id', 'name', 'price', 'description', 'image_url']
      }
    },
    defaultData: {
      users: [
        { username: 'john_doe', password_raw: 'password123', role: 'user', bio: 'Just a regular user' }
      ],
      products: [
        { name: 'Basic T-Shirt', price: 9.99, description: 'A comfortable cotton t-shirt.', image_url: 'tshirt.jpg' },
        { name: 'Coffee Mug', price: 12.50, description: 'Keeps your coffee hot.', image_url: 'mug.jpg' },
        { name: 'Mechanical Keyboard', price: 89.99, description: 'Click clack.', image_url: 'keyboard.jpg' }
      ]
    }
  },
  dashboard: {
    tables: {
      users: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password_raw TEXT,
          password_hash TEXT,
          role TEXT DEFAULT 'employee',
          department TEXT
        `,
        columns: ['id', 'username', 'password_raw', 'password_hash', 'role', 'department']
      },
      messages: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER,
          receiver_id INTEGER,
          content TEXT,
          is_read INTEGER DEFAULT 0
        `,
        columns: ['id', 'sender_id', 'receiver_id', 'content', 'is_read']
      }
    },
    defaultData: {
      users: [
        { username: 'alice.smith', password_raw: 'qwerty', role: 'employee', department: 'HR' },
        { username: 'bob.jones', password_raw: '123456', role: 'employee', department: 'Sales' }
      ],
      messages: [
        { sender_id: 1, receiver_id: 2, content: 'Did you finish that report?', is_read: 0 }
      ]
    }
  },
  blog: {
    tables: {
      posts: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
          author TEXT,
          is_published INTEGER DEFAULT 1
        `,
        columns: ['id', 'title', 'content', 'author', 'is_published']
      },
      comments: {
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER,
          author TEXT,
          content TEXT
        `,
        columns: ['id', 'post_id', 'author', 'content']
      }
    },
    defaultData: {
      posts: [
        { title: 'Welcome to my blog', content: 'This is my first post!', author: 'Admin', is_published: 1 },
        { title: 'Thoughts on Cybersecurity', content: 'Always sanitize your inputs.', author: 'Admin', is_published: 1 }
      ],
      comments: [
        { post_id: 1, author: 'Guest', content: 'Great post!' }
      ]
    }
  }
};

module.exports = schemas;
