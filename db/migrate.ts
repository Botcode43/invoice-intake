import fs from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function runMigration(databaseUrl: string, dbName: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf-8");
    console.log(`Applying schema to ${dbName}...`);
    await pool.query(sql);
    console.log(`Schema applied successfully to ${dbName}.`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    console.error("DATABASE_URL is not set in environment");
    process.exit(1);
  }

  await runMigration(devUrl, "dev database (DATABASE_URL)");

  const testUrl = process.env.TEST_DATABASE_URL;
  if (testUrl && testUrl !== devUrl) {
    await runMigration(testUrl, "test database (TEST_DATABASE_URL)");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
