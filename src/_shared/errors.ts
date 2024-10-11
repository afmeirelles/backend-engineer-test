import type { FastifyReply } from "fastify";

/**
 * @dev DomainErrors
 * Converts domain-specific errors into HTTP errors
 */

export class DomainError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function createCustomError(name: string) {
  return class extends DomainError {
    constructor(message: string) {
      super(message, name);
    }
  };
}

export const NotFoundError = createCustomError('NotFoundError');
export const InvalidParameter = createCustomError('InvalidParameter');
export const ResourceLocked = createCustomError('Locked');

const domainErrorToHttpErrorMap = {
  NotFoundError: 404,
  InvalidParameter: 400,
  Locked: 409
}

export const toHttpError = (error: DomainError, reply: FastifyReply) => {
  const errorName = error.name as keyof typeof domainErrorToHttpErrorMap;
  const statusCode = domainErrorToHttpErrorMap[errorName] ?? 500;

  reply.status(statusCode).send({
    message: error.message,
  })
}
