import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z
    .string()
    .default('3000')
    .regex(/\d+/, { message: 'PORT must be a number' }),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  LOG_LEVEL: z.string().default('info')
});

const parsed = envSchema.parse(process.env);

export type Env = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
};

export const env: Env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: Number(parsed.PORT),
  DATABASE_URL: parsed.DATABASE_URL,
  JWT_SECRET: parsed.JWT_SECRET,
  LOG_LEVEL: parsed.LOG_LEVEL
};

export default env;
