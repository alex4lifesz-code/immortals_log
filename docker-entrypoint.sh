#!/bin/sh
set -e

echo "=== Wuxia Cultivation Tracker - Starting ==="
echo "DATABASE_URL: ${DATABASE_URL}"

# Extract file path from DATABASE_URL (e.g. "file:/app/data/cultivation.db" -> "/app/data/cultivation.db")
DB_PATH=$(echo "$DATABASE_URL" | sed 's|^file:||')

# Resolve any previously failed migrations before deploying
echo "Checking for failed migrations..."
FAILED=$(npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -oP '(?<=The `).*(?=` migration started .* failed)' || true)
if [ -n "$FAILED" ]; then
  echo "Found failed migration: $FAILED — resolving..."
  npx prisma migrate resolve --rolled-back "$FAILED" --schema=./prisma/schema.prisma 2>&1
  echo "Resolved failed migration."
fi

# Remove duplicates that would block unique constraints
echo "Cleaning duplicate CheckInNote rows..."
node -e '
const { createClient } = require("@libsql/client");
async function fix() {
  const client = createClient({ url: process.env.DATABASE_URL });
  try {
    await client.execute("DELETE FROM CheckInNote WHERE id NOT IN (SELECT MAX(id) FROM CheckInNote GROUP BY date, userId)");
    console.log("Duplicate cleanup done.");
  } catch(e) { console.log("Cleanup skipped:", e.message); }
  client.close();
}
fix();
'

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1
echo "Migrations complete."

# Seed admin account if no users exist (uses @libsql/client directly, not Prisma client)
echo "Checking for existing users..."
node -e '
const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

async function seed() {
  const client = createClient({ url: process.env.DATABASE_URL });
  const result = await client.execute("SELECT COUNT(*) as cnt FROM User");
  const count = result.rows[0].cnt;
  if (count === 0) {
    console.log("No users found. Creating default admin account...");
    const id = "admin_" + Date.now().toString(36);
    const hash = await bcrypt.hash("admin", 10);
    const now = new Date().toISOString();
    await client.execute({
      sql: "INSERT INTO User (id, username, password, name, role, experience, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, "admin", hash, "Administrator", "admin", 0, now, now]
    });
    console.log("Default admin account created (admin/admin).");
    console.log("WARNING: Change default password after first login.");
  } else {
    console.log("Found " + count + " existing user(s). Skipping seed.");
  }
  client.close();
}
seed().catch(e => { console.error("Seed error:", e); process.exit(1); });
'

echo "Starting application server..."
exec "$@"
