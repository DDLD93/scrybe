import { execSync } from "child_process";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    console.log("Dropping public schema…");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO public");
    console.log("Schema reset complete.");
  } finally {
    await pool.end();
  }

  console.log("Pushing Drizzle schema…");
  execSync("npx drizzle-kit push", { stdio: "inherit", env: process.env });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
