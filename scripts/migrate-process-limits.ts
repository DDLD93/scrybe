import pg from "pg";

const SQL = `
ALTER TABLE transcribe_jobs ADD COLUMN IF NOT EXISTS process_limit_pages integer;
ALTER TABLE transcribe_jobs ADD COLUMN IF NOT EXISTS process_limit_sec numeric(12, 4);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("Process limits migration applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
