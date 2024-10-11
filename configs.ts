declare module 'bun' {
  interface Env {
    DATABASE_URL: string;
    SERVICE_PORT: string;
    SERVICE_HOST: string;
    ENABLE_LOGGING: string;
    REDIS_URL: string;
  }
}

const configs = {
  databaseUrl: Bun.env.DATABASE_URL ?? 'postgres://localhost:5432',
  redisUrl: Bun.env.REDIS_URL ?? 'redis://localhost:6379',
  port: Number(Bun.env.SERVICE_PORT ?? 3000),
  host: Bun.env.SERVICE_HOST ?? '0.0.0.0',
  logger: Bun.env.ENABLE_LOGGING === 'true'
}

export type ServerConfigs = typeof configs

export default configs