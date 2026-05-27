import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.log("DATABASE_URL not set, skipping database wait.");
  process.exit(0);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const client = new Client({ connectionString });

    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("Database is ready");
      return;
    } catch (error) {
      console.log(`Waiting for database (attempt ${attempt})`);
      try {
        await client.end();
      } catch {
        // ignore cleanup errors while retrying
      }
      await delay(2000);
      if (attempt === 30) {
        throw error;
      }
    }
  }
}

waitForDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
