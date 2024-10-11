import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  StartedRedisContainer
} from '@testcontainers/redis'
import type { FastifyInstance } from 'fastify';
import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { type TransactionsDatabase, bootstrap } from '../../../src/_shared/postgresClient';
import server from '../../../src/server';
import { restartTable } from './sql';
import { Wait } from 'testcontainers';
import { setupQueue } from '../../../src/_shared/queueClient';

export type Setup = (enableLogger?: boolean) => Promise<{
  postgresContainer: StartedPostgreSqlContainer;
  request: TestAgent;
  db: TransactionsDatabase;
}>

export type TearDown = () => Promise<void>


export default async ({ spinUpServer }: { spinUpServer: boolean }) => {
  let postgresContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let db: TransactionsDatabase;
  let fastify: FastifyInstance
  let request: TestAgent

  const setup = async (enableLogger = false) => {
    if (spinUpServer) {
      postgresContainer = await new PostgreSqlContainer()
        .withWaitStrategy(
          Wait.forLogMessage(/database system is ready to accept connections/)
        )
        .withReuse()
        .start();

      redisContainer = await new RedisContainer()
        .withReuse()
        .withExposedPorts(6379)
        .start()

      console.log(redisContainer.getConnectionUrl())

      db = await bootstrap(postgresContainer.getConnectionUri());

      fastify = await server({ logger: enableLogger });

      request = supertest(fastify.server);
    } else {
      setupQueue()

      request = supertest('http://localhost:3000');

      db = await bootstrap('postgres://myuser:mypassword@localhost:5432/mydatabase');
    }

    await restartTable(db);

    return {
      postgresContainer,
      request,
      db
    }
  }

  const tearDown = async () => {
    await db.destroy();

    if (spinUpServer) {
      await postgresContainer.stop();
      await fastify.close()
      await redisContainer.stop()
    }
  }

  return {
    setup,
    tearDown
  }
}

