import Fastify from 'fastify';
import type { ServerConfigs } from '../configs'
import { customErrorHandler } from './middleware/errorHandler';
import addBlockRoutes from './blocks/routes'
import { processQueue } from './blocks/controller'

export default async (configs: Partial<ServerConfigs>) => {
  const { port, host, logger } = configs;

  processQueue()

  const fastify = Fastify({ logger });

  addBlockRoutes(fastify);

  fastify.setErrorHandler(customErrorHandler)


  try {
    await fastify.listen({
      port,
      host
    })

    return fastify
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  };
}
