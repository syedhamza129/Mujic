import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),

  // Cloudflare R2
  CF_ACCOUNT_ID: z.string().default(''),
  R2_BUCKET: z.string().default('mujic-storage'),
  R2_ACCESS_KEY: z.string().default(''),
  R2_SECRET_KEY: z.string().default(''),

  // Temp cache encryption
  TEMP_CACHE_KEY: z.string().default(''),

  // App
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('*'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
