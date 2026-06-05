import pg from "pg";

const SQL = `
ALTER TABLE transcribe_settings ADD COLUMN IF NOT EXISTS pdf_model text;
ALTER TABLE transcribe_settings ADD COLUMN IF NOT EXISTS default_view text;
ALTER TABLE transcribe_settings ADD COLUMN IF NOT EXISTS last_pdf_system_prompt_id uuid REFERENCES system_prompts(id) ON DELETE SET NULL;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("System settings migration applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
