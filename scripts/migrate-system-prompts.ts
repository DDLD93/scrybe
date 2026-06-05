import pg from "pg";

const SQL = `
CREATE TABLE IF NOT EXISTS system_prompts (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  file_types jsonb NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transcribe_jobs ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'audio';
ALTER TABLE transcribe_jobs ADD COLUMN IF NOT EXISTS system_prompt_id uuid REFERENCES system_prompts(id) ON DELETE SET NULL;

ALTER TABLE transcribe_settings ADD COLUMN IF NOT EXISTS last_system_prompt_id uuid REFERENCES system_prompts(id) ON DELETE SET NULL;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("Migration applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
