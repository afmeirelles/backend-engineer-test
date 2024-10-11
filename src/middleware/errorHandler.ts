import { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';
import { DomainError, toHttpError } from "../_shared/errors";

export const customErrorHandler = (
  error: DomainError | FastifyError,
  // @ts-ignore: mandatory for Fastify error handler
  request: FastifyRequest,
  reply: FastifyReply
) => {
  reply.log.error(error)

  if (error instanceof DomainError) return toHttpError(error, reply)

  reply.status(error.statusCode ?? 500).send({
    message: error.message,
  })

}