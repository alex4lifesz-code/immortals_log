const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const DB_URL = process.env.DATABASE_URL || "file:./dev.db";
const DEFAULT_ADMIN_USERNAME = (process.env.DEFAULT_ADMIN_USERNAME || "admin").trim();
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || "").trim();
const DEFAULT_ADMIN_NAME = (process.env.DEFAULT_ADMIN_NAME || "Administrator").trim();

async function main() {
  const client = createClient({ url: DB_URL });

  try {
    const adminResult = await client.execute({
      sql: "SELECT id, username FROM User WHERE role = 'admin' LIMIT 1",
    });

    if (adminResult.rows.length > 0) {
      console.log(`Admin account already exists (${String(adminResult.rows[0].username)}).`);
      return;
    }

    const existingNamedAdmin = await client.execute({
      sql: "SELECT id, username FROM User WHERE lower(username) = lower(?) LIMIT 1",
      args: [DEFAULT_ADMIN_USERNAME],
    });

    if (existingNamedAdmin.rows.length > 0) {
      await client.execute({
        sql: "UPDATE User SET role = 'admin' WHERE id = ?",
        args: [String(existingNamedAdmin.rows[0].id)],
      });
      console.log(`Promoted existing user ${String(existingNamedAdmin.rows[0].username)} to admin.`);
      return;
    }

    if (!DEFAULT_ADMIN_PASSWORD) {
      console.log("No admin exists yet. The first registered real user will become admin.");
      return;
    }

    const userId = "c" + crypto.randomBytes(12).toString("hex").slice(0, 24);
    const friendCode = crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    const now = new Date().toISOString();

    await client.execute({
      sql: `INSERT INTO User (id, friendCode, username, password, name, role, onboardingCompleted, onboardingSkipped, onboardingStep, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?, ?)`,
      args: [
        userId,
        friendCode,
        DEFAULT_ADMIN_USERNAME,
        passwordHash,
        DEFAULT_ADMIN_NAME,
        1,
        1,
        0,
        now,
        now,
      ],
    });

    console.log(`Created default admin account ${DEFAULT_ADMIN_USERNAME}.`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("Failed to ensure admin account:", error);
  process.exit(1);
});
