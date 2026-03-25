import "dotenv/config";
import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.DATABASE_URL });

const KEEP_USERNAMES = ["admin", "judy"];

async function tableExists(name) {
  const rs = await client.execute({
    sql: `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    args: [name],
  });
  return rs.rows.length > 0;
}

async function main() {
  const placeholders = KEEP_USERNAMES.map(() => "?").join(", ");
  const usersToKeepRs = await client.execute({
    sql: `SELECT id, username FROM "User" WHERE username IN (${placeholders})`,
    args: KEEP_USERNAMES,
  });
  const usersToKeep = usersToKeepRs.rows.map((r) => ({
    id: String(r.id),
    username: String(r.username),
  }));

  const keepIds = usersToKeep.map((u) => u.id);

  if (keepIds.length === 0) {
    throw new Error("No users matched keep list. Aborting to prevent destructive wipe.");
  }

  console.log("Keeping users:", usersToKeep.map((u) => u.username).join(", "));

  const idPlaceholders = keepIds.map(() => "?").join(", ");

  const statements = [];

  if (await tableExists("WeightStandard")) {
    statements.push({
      sql: `UPDATE "WeightStandard" SET updatedBy = NULL WHERE updatedBy IS NOT NULL AND updatedBy NOT IN (${idPlaceholders})`,
      args: keepIds,
    });
  }

  const deleteByUserTables = [
    "SessionToken",
    "PasswordResetToken",
    "CheckIn",
    "CheckInNote",
    "UserSettings",
    "UserProgressionLevel",
    "ProgressionExercise",
  ];

  for (const table of deleteByUserTables) {
    if (await tableExists(table)) {
      statements.push({
        sql: `DELETE FROM "${table}" WHERE userId NOT IN (${idPlaceholders})`,
        args: keepIds,
      });
    }
  }

  statements.push({
    sql: `DELETE FROM "User" WHERE id NOT IN (${idPlaceholders})`,
    args: keepIds,
  });

  await client.batch(statements);

  console.log("Data prune complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    client.close();
  });
