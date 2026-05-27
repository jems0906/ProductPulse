import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const pool = hasDatabase
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : null;

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("Database is not configured");
  }

  return pool.query(text, params);
}
