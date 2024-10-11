import type { FastifyInstance } from "fastify"
import { balance, enqueue, newBlock, rollback } from "./controller"
import { balanceRequestSchema, newBlockRequestSchema, rollbackRequestSchema } from "./schemas"

/**
 * Connects endpoints to each controller
 * @dev Routes
 */
export default (fastify: FastifyInstance) => {
  fastify.get('/balance/:address', { schema: balanceRequestSchema }, balance)
  fastify.post('/blocks', { schema: newBlockRequestSchema }, newBlock)
  fastify.post('/rollback', { schema: rollbackRequestSchema }, rollback)
  fastify.post('/blocks/async', { schema: newBlockRequestSchema }, enqueue)
}