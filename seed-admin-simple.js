const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

async function seed() {
  try {
    const client = createClient({ 
      url: process.env.DATABASE_URL || "file:C:\\Users\\Admin\\Desktop\\wuxia-log-original\\cultivation.db"
    });
    
    console.log("Creating default admin account...");
    const id = "admin_" + Date.now().toString(36);
    const hash = await bcrypt.hash("admin", 10);
    const now = new Date().toISOString();
    
    await client.execute({
      sql: "INSERT INTO User (id, username, password, name, role, experience, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, "admin", hash, "Administrator", "admin", 0, now, now]
    });
    
    console.log("✓ Default admin account created successfully.");
    console.log("  Username: admin");
    console.log("  Password: admin");
    console.log("  Role: admin");
    console.log("\n⚠ SECURITY: Change the default password immediately after first login.\n");
    
    client.close();
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exit(1);
  }
}

seed();
