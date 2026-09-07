import * as z from 'zod';

// Read a .env file if there is one. This is Node's built-in loader (no dotenv package).
// Values already present in the real environment win over the file. Tests skip it so a
// developer's local .env can never leak into the test database.
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file. Every setting has a default, so that is fine.
  }
}

// The environment is untrusted input like any other, so it gets a Zod schema. A typo in
// MONGO_URI fails here, at startup, with a readable message, instead of ten seconds later as
// a Mongoose "buffering timed out" error in the middle of a demo.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGO_URI: z.string().min(1).optional(),
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
