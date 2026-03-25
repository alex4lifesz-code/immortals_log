import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.DATABASE_URL });

try {
  const rs = await db.execute(
    'SELECT id, username, role, isActive, email, displayName FROM "User" ORDER BY username ASC'
  );
  console.table(rs.rows);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  db.close();
}
