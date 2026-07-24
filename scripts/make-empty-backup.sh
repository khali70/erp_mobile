#!/usr/bin/env bash
#
# make-empty-backup.sh — produce an EMPTY merged backup file that the app's
# Restore flow accepts. Restoring it replaces the live database with a clean
# one: full schema, the two sentinel walk-in parties, zero business data and
# zero receipt photos. This is how you wipe demo/dummy data off a device.
#
#   ./scripts/make-empty-backup.sh [out.db]
#
# The schema is taken verbatim from src/db/prod-schema.sql, which is GENERATED
# from the same DDL constants runMigrations() executes — so this file cannot
# drift from what the phone actually builds on boot.
#
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="src/db/prod-schema.sql"
OUT="${1:-rafuf-backup-empty.db}"

[ -f "$SRC" ] || { echo "error: $SRC not found" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "error: sqlite3 not found" >&2; exit 1; }

# Contract values — must match the app. Sources:
#   src/features/settings/backup-format.ts  (MERGED_BACKUP_FORMAT, ..._VERSION)
#   src/db/schema-version.ts                (APP_SCHEMA_VERSION)
FORMAT='erp-merged-backup'
FORMAT_VERSION=1
APP_SCHEMA_VERSION=$(grep -oE 'APP_SCHEMA_VERSION = [0-9]+' src/db/schema-version.ts | grep -oE '[0-9]+')
CREATED_AT=$(( $(date +%s) * 1000 ))

# prod-schema.sql is two sections: erp.db, then the attachments.db table. A
# MERGED backup carries both in one file (that is what the merge step produces
# at backup time), so both are applied here.
SPLIT=$(grep -n 'attachments.db  (SEPARATE FILE' "$SRC" | cut -d: -f1)
[ -n "$SPLIT" ] || { echo "error: could not locate the attachments section in $SRC" >&2; exit 1; }

rm -f "$OUT"
{
  sed -n "1,$((SPLIT - 1))p" "$SRC"           # erp.db schema + sentinel parties
  sed -n "$((SPLIT + 1)),\$p" "$SRC"          # the attachments BLOB table
  cat <<SQL

CREATE TABLE IF NOT EXISTS backup_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR REPLACE INTO backup_meta (key, value) VALUES
  ('format', '${FORMAT}'),
  ('format_version', '${FORMAT_VERSION}'),
  ('app_schema_version', '${APP_SCHEMA_VERSION}'),
  ('created_at', '${CREATED_AT}'),
  ('attachment_count', '0');

PRAGMA user_version = ${APP_SCHEMA_VERSION};
VACUUM;
SQL
} | sqlite3 "$OUT"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
echo
echo "tables:"
sqlite3 "$OUT" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" | paste -sd' ' -
echo
echo "backup_meta:"
sqlite3 "$OUT" "SELECT '  '||key||' = '||value FROM backup_meta ORDER BY key;"
echo
echo "user_version: $(sqlite3 "$OUT" 'PRAGMA user_version;')"
echo "row counts (must be 0 except the 2 sentinel parties):"
for t in items documents document_lines stock_levels expenses attachments; do
  printf '  %-16s %s\n' "$t" "$(sqlite3 "$OUT" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 'n/a')"
done
printf '  %-16s %s\n' "customers" "$(sqlite3 "$OUT" 'SELECT COUNT(*) FROM customers;')"
printf '  %-16s %s\n' "suppliers" "$(sqlite3 "$OUT" 'SELECT COUNT(*) FROM suppliers;')"
