import * as z from 'zod';

// Node's built-in .env loader (real env vars win). Skipped under test so a local .env can never
// reach the test database.
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file; every setting has a default.
  }
}

// Validate the environment once at startup so a bad value fails with a readable message.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Empty counts as unset.
  MONGO_URI: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  EVENT_START: z.iso.datetime({ offset: true }).default('2027-02-26T17:00:00-06:00'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const config: Config = loadConfig();
