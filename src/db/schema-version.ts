// The schema GENERATION this app build understands. Pure module — no expo
// import — so the restore validator can read it under jest (node project).
//
// `runMigrations()` stamps this into `PRAGMA user_version` on every boot, which
// is what makes RESTORE able to tell an old backup from a future one:
//
//   file version <  APP_SCHEMA_VERSION → older backup, migrate it forward.
//   file version === APP_SCHEMA_VERSION → same shape, nothing to do.
//   file version >  APP_SCHEMA_VERSION → written by a NEWER build. REFUSE it:
//        this build's forward-only migrations cannot undo a future column, so
//        opening it would silently read a schema it does not understand.
//
// A backup taken before this constant existed reports 0 — correctly the "older"
// branch, because `runMigrations()` is idempotent and additive.
//
// BUMP THIS whenever a migration changes the shape of erp.db in a way an older
// build cannot read. Do not bump for additive columns older builds ignore.
export const APP_SCHEMA_VERSION = 1;
