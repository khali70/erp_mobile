import type { Config } from 'drizzle-kit';

// Schema is the source of truth; generated SQL feeds src/db/migrate.ts.
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
