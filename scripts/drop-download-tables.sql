-- One-off cleanup after removing the download module.
-- Run against your Postgres database, then: npm run db:push

DROP TABLE IF EXISTS download_artifacts;
DROP TABLE IF EXISTS download_jobs;
