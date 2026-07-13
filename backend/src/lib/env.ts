// Centralised, validated environment access.
//
// Instead of scattering `process.env.X!` non-null assertions across the code
// (which crash with a cryptic error deep inside a request), we validate the
// required variables once at startup and fail fast with a clear message.

interface Env {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Set it in your .env file (see .env.example).`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be at least 32 characters in production. ' +
        'Generate one with: openssl rand -hex 64'
    );
  }

  cached = {
    NODE_ENV: optional('NODE_ENV', 'development'),
    PORT: Number(optional('PORT', '3001')),
    JWT_SECRET: jwtSecret,
    FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
    ACCESS_TOKEN_TTL: optional('ACCESS_TOKEN_TTL', '15m'),
    REFRESH_TOKEN_TTL_DAYS: Number(optional('REFRESH_TOKEN_TTL_DAYS', '30')),
  };

  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});
