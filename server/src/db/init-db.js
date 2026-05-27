import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const schemaPath = path.resolve(__dirname, "../../sql/schema.sql");
  const seedPath = path.resolve(__dirname, "../../sql/seed.sql");

  const schema = await fs.readFile(schemaPath, "utf8");
  const seed = await fs.readFile(seedPath, "utf8");

  await pool.query(schema);
  await pool.query(seed);

  console.log("Database initialized");
  await pool.end();
}

run().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
