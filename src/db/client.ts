import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// Single db instance. Only src/db and src/repositories may import this.
export const sqlite = openDatabaseSync('erp.db', { enableChangeListener: true });

export const db = drizzle(sqlite, { schema });
export { schema };
