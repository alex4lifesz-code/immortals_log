#!/bin/sh
set -e

echo "=== Wuxia Cultivation Tracker - Starting ==="
echo "DATABASE_URL: ${DATABASE_URL}"

# Extract file path from DATABASE_URL (e.g. "file:/app/data/cultivation.db" -> "/app/data/cultivation.db")
DB_PATH=$(echo "$DATABASE_URL" | sed 's|^file:||')
SEED_DB_PATH="${SEED_DB_PATH:-/app/seed/cultivation.db}"
JWT_SECRET_FILE="${JWT_SECRET_FILE:-/app/data/jwt-secret}"

# Ensure JWT secret exists in container runtime. If missing, generate once and persist.
if [ -z "${JWT_SECRET:-}" ]; then
  if [ -f "$JWT_SECRET_FILE" ]; then
    JWT_SECRET=$(cat "$JWT_SECRET_FILE")
    echo "Loaded JWT_SECRET from $JWT_SECRET_FILE"
  else
    echo "JWT_SECRET not provided. Generating persistent secret at $JWT_SECRET_FILE"
    JWT_SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')
    printf "%s" "$JWT_SECRET" > "$JWT_SECRET_FILE"
    chmod 600 "$JWT_SECRET_FILE" || true
  fi
  export JWT_SECRET
fi

# â”€â”€ Full database reset (set RESET_DB=true in environment to trigger) â”€â”€
if [ "${RESET_DB:-false}" = "true" ]; then
  echo "!!! RESET_DB=true â€” Deleting database for clean rebuild !!!"
  rm -f "$DB_PATH" "${DB_PATH}-journal" "${DB_PATH}-wal" "${DB_PATH}-shm"
  echo "Database files removed. Migrations will recreate from scratch."
fi

# If database is missing on first deployment, initialize from bundled snapshot.
if [ ! -f "$DB_PATH" ] && [ -f "$SEED_DB_PATH" ]; then
  echo "No database found at $DB_PATH. Initializing from snapshot $SEED_DB_PATH ..."
  cp "$SEED_DB_PATH" "$DB_PATH"
  echo "Snapshot database restored."
fi

# Resolve any previously failed migrations by querying the database directly
echo "Checking for failed migrations..."
FAILED=$(node -e '
const { createClient } = require("@libsql/client");
async function check() {
  const client = createClient({ url: process.env.DATABASE_URL });
  try {
    const r = await client.execute("SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL AND logs IS NOT NULL AND logs != ''");
    process.stdout.write(r.rows.map(r => r.migration_name).join("\n"));
  } catch(e) { /* _prisma_migrations table may not exist yet */ }
  client.close();
}
check();
' 2>/dev/null)
if [ -n "$FAILED" ]; then
  echo "$FAILED" | while IFS= read -r mig; do
    [ -z "$mig" ] && continue
    echo "Found failed migration: $mig â€” marking as rolled back..."
    npx prisma migrate resolve --rolled-back "$mig" --schema=./prisma/schema.prisma 2>&1
    echo "Resolved: $mig"
  done
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
      sql: "INSERT INTO User (id, username, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [id, "admin", hash, "Administrator", "admin", now, now]
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
