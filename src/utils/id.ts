import * as Crypto from 'expo-crypto';

// Client-generated sortable-ish unique IDs. UUIDv4 for now via expo-crypto;
// swap to UUIDv7/ULID when a lib is added (data-model.md convention).
export function newId(): string {
  return Crypto.randomUUID();
}

/** Epoch milliseconds — the canonical timestamp unit for all tables. */
export function now(): number {
  return Date.now();
}
