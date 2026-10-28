import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { applyCanvaMigrations } from "../scripts/canva-release.mjs";

it("adds only Canva tables, records migrations, and safely repeats", async () => {
  const pg = new PGlite();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    for (const migration of migrations.slice(0, 5))
      for (const sql of migration.sql) await pg.exec(sql);
    await pg.exec(
      "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)",
    );
    for (const migration of migrations.slice(0, 5))
      await pg.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)",
        [migration.hash, migration.folderMillis],
      );
    const client = {
      begin: (fn) =>
        pg.transaction((tx) =>
          fn({
            unsafe: async (sql, params) => (await tx.query(sql, params)).rows,
          }),
        ),
    };
    await applyCanvaMigrations(client);
    await pg.exec("INSERT INTO canva_queue_lock (id) VALUES (1)");
    await applyCanvaMigrations(client);
    expect(
      (
        await pg.query(
          "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
        )
      ).rows[0].count,
    ).toBe(7);
    expect((await pg.query("SELECT id FROM canva_queue_lock")).rows[0].id).toBe(
      1,
    );
  } finally {
    await pg.close();
  }
});
