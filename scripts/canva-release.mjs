import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import { pathToFileURL } from "node:url";

// Additive Canva tables only. Existing API tables are never altered here.
// Production build failure keeps the previous Vercel deployment serving traffic.
export async function applyCanvaMigrations(client) {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  const baseline = migrations[4];
  const additions = migrations.slice(5, 7);
  if (!baseline || additions.length !== 2)
    throw new Error("Canva migration files missing.");
  await client.begin(async (tx) => {
    await tx.unsafe("SET LOCAL lock_timeout = '5s'");
    await tx.unsafe("SET LOCAL statement_timeout = '20s'");
    await tx.unsafe(
      "LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE",
    );
    const [latest] = await tx.unsafe(
      "SELECT max(created_at) AS version FROM drizzle.__drizzle_migrations",
    );
    if (Number(latest.version) < baseline.folderMillis)
      throw new Error(
        "Existing database migrations must be applied before the Canva release.",
      );
    for (const migration of additions) {
      if (Number(latest.version) >= migration.folderMillis) continue;
      for (const statement of migration.sql) await tx.unsafe(statement);
      await tx.unsafe(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [migration.hash, migration.folderMillis],
      );
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.env.VERCEL_ENV !== "production") {
    console.log("Canva release migration skipped outside Vercel production.");
  } else {
    if (!process.env.DATABASE_URL)
      throw new Error("Production DATABASE_URL is required.");
    const client = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
    });
    try {
      await applyCanvaMigrations(client);
      console.log(
        "Canva database tables ready; customer redemption remains disabled by default.",
      );
    } catch {
      console.error(
        "Canva migration failed. Production deployment stopped; inspect database migration history and permissions.",
      );
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}
