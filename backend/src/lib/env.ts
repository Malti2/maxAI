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
  ADMIN_EMAIL: string; // the single account allowed into the admin area ('' = none)
  ADMIN_PASSWORD: string; // used only to seed the admin account on first boot
  ENCRYPTION_KEY: string; // optional; falls back to a key derived from JWT_SECRET
  ALLOW_REGISTRATION: boolean; // when false, self-service sign-up is disabled
}

// Parse a boolean-ish environment variable. Accepts 1/true/yes/on (any case).
function optionalBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
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
    ADMIN_EMAIL: optional('ADMIN_EMAIL', '').trim().toLowerCase(),
    ADMIN_PASSWORD: optional('ADMIN_PASSWORD', ''),
    ENCRYPTION_KEY: optional('ENCRYPTION_KEY', ''),
    ALLOW_REGISTRATION: optionalBool('ALLOW_REGISTRATION', true),
  };

  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});

// Whether the given email is the designated admin. Admin access is controlled
// purely by ADMIN_EMAIL, so it cannot be granted by tampering with the database.
export function isAdminEmail(email?: string | null): boolean {
  const admin = loadEnv().ADMIN_EMAIL;
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}
