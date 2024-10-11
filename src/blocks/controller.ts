import _ from 'lodash';
import type { FastifyRequest, FastifyReply } from 'fastify'
import { enqueueBlock, getBalance, rollbackBlocks, saveNewBlock } from './interactor'
import type { BalanceRequest, NewBlockRequest, RollbackRequest } from './types'
import { blockQueue } from '../_shared/queueClient';

/**
 * @dev Controller
 * Layer responsible for translating framework/http
 * messages into domain messages and back, acting as a boundary
 * between delivery mechanism and business logic
**/

export const balance = async (request: FastifyRequest, reply: FastifyReply) => {
  const { address } = request.params as BalanceRequest;
  const balance = await getBalance(address);
  reply.send({ balance });
}

export const newBlock = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as NewBlockRequest;
  const utxos = await saveNewBlock(body);
  // format response
  reply.send({ utxos: utxos.map(u => _.omit(u, 'id', 'created', 'updated', 'spentOnBlock')) })
}

export const rollback = async (request: FastifyRequest, reply: FastifyReply) => {
  const { height } = request.query as RollbackRequest;
  await rollbackBlocks(height);
  reply.send();
}

/**
 * Enqueue a new block to be processed
 * @dev Instead of blocking new incoming blocks, we can enqueue
 * and process them asynchronously
 */
export const enqueue = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as NewBlockRequest;
  await enqueueBlock(body);
  reply.status(202).send();
}

/**
 * Subscribe to the block queue to process new blocks
 */
export const processQueue = async () => {
  blockQueue.process(1, async job => {
    await saveNewBlock(job.data);
  })
};