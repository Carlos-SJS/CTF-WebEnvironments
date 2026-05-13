const testCases = [
  {
    name: "Vulnerable Dashboard",
    config: {
      template: "dashboard",
      theme_color: "#e74c3c", // Red theme
      vulnerabilities: ["sqli_auth", "idor"],
      db_settings: { hash_passwords: true },
      mock_data: {
        users: [
          {
            username: "admin",
            password_raw: "admin_super_secret_pw_123",
            role: "admin",
            department: "IT Security"
          }
        ],
        messages: [
          {
            sender_id: 1, // The admin
            receiver_id: 1,
            content: "CTF{idor_dashboard_master_flag}",
            is_read: 0
          }
        ]
      }
    }
  },
  {
    name: "Vulnerable Ecommerce",
    config: {
      template: "ecommerce",
      theme_color: "#9b59b6", // Purple theme
      vulnerabilities: ["sqli_search", "path_traversal"],
      db_settings: { hash_passwords: true },
      mock_data: {
        products: [
          {
            name: "Top Secret Blueprint",
            price: 9999.99,
            description: "A mysterious blueprint. Only admins can see the internal details.",
            internal_description: "You shouldn't be seeing this unless you dumped the DB. CTF{sqli_dump_success}",
            image_url: "secret.jpg"
          }
        ]
      },
      custom_files: [
        {
          path: "flag.txt",
          content: "CTF{path_traversal_ecommerce_flag}"
        }
      ]
    }
  },
  {
    name: "Vulnerable Blog",
    config: {
      template: "blog",
      theme_color: "#27ae60", // Green theme
      vulnerabilities: ["info_exposure"],
      mock_data: {
        posts: [
          {
            title: "Why security through obscurity fails",
            content: "We left some backups on the server. Try to find them!",
            author: "System Admin",
            is_published: 1
          }
        ]
      },
      custom_files: [
        {
          path: ".env",
          content: "DB_USER=admin\nDB_PASS=CTF{exposed_env_vars_flag}\n"
        },
        {
          path: "config.bak",
          content: "OLD_SITE_CONFIG=true\nADMIN_TOKEN=CTF{found_the_backup_config}\n"
        }
      ]
    }
  }
];

async function runTests() {
  console.log("Starting API Tests...\n");

  for (const test of testCases) {
    console.log(`--- Testing: ${test.name} ---`);
    try {
      const response = await fetch("http://localhost:3001/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test.config)
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Success!`);
        console.log(`Instance ID: ${data.instance_id}`);
        console.log(`URL: ${data.url}\n`);
      } else {
        console.log(`❌ Failed:`, data);
      }
    } catch (error) {
      console.error("❌ Connection error. Is the server running on port 3001?");
      console.error(error.message + "\n");
    }
  }
  
  console.log("All tests completed. You can visit the URLs above in your browser to test the challenges!");
}

runTests();
