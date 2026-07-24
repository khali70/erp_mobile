import type { SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { db, sqlite } from './client';
import { initAttachmentsDb } from './attachments-client';
import { applyErpSchema } from './migrate-core';
import type { SentinelDb } from './sentinels';

// Forward-only bootstrap migration, run once at app boot.
// Additive only. Never destructive without an explicit backup step.
// Reuses the single shared connection from ./client (a second
// openDatabaseSync handle raced the change-listener handle and could NPE in
// prepareSync on a cold first boot). WAL is expo-sqlite's default — no PRAGMA.
//
// The statements themselves live in ./migrate-core, which is free of
// `expo-sqlite` so the suite can run the REAL migration against better-sqlite3.
// This file only binds it to the app's live handles.
export function runMigrations(): void {
  migrateErpDatabase(sqlite, db as unknown as SentinelDb);

  // Attachment bytes live in a separate DB file — bootstrap it here too.
  initAttachmentsDb();
}

/**
 * The migration pass against an ARBITRARY expo-sqlite handle.
 *
 * `runMigrations()` above points it at the live singletons. RESTORE points it at
 * the file it has just copied over the live path (through a fresh connection,
 * because the singleton is closed for the swap) — a backup taken by an older
 * build is missing later columns, and this is the ONLY code that adds them.
 */
export function migrateErpDatabase(handle: SQLiteDatabase, sentinels: SentinelDb): void {
  applyErpSchema(handle, sentinels);
}

/** Wrap a raw handle in the Drizzle surface `seedSentinels` needs. */
export function drizzleFor(handle: SQLiteDatabase): SentinelDb {
  return drizzle(handle, { schema }) as unknown as SentinelDb;
}
