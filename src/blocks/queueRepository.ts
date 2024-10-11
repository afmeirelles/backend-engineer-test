import { blockQueue } from '../_shared/queueClient';
import type { Block } from './types';

export const addToQueue = async (block: Block) => {
  await blockQueue.createJob(block)
    .retries(3)
    .backoff('exponential', 3000)
    .save();
}