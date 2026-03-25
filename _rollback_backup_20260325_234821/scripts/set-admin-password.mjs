import "dotenv/config";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const newPassword = process.argv[2] || "admin";
const username = process.argv[3] || "admin";

const db = createClient({ url: process.env.DATABASE_URL });

try {
  const hash = await bcrypt.hash(newPassword, 10);
  const rs = await db.execute({
    sql: 'UPDATE "User" SET password = ?, isActive = 1 WHERE username = ?',
    args: [hash, username],
  });

  if ((rs.rowsAffected ?? 0) === 0) {
    console.error(`No user found for username: ${username}`);
    process.exitCode = 1;
  } else {
    console.log(`Password updated for user: ${username}`);
    console.log(`New password: ${newPassword}`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  db.close();
}
