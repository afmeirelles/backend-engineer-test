import Queue from 'bee-queue';
import type { Block } from '../blocks/types';
import configs from '../../configs'

export let blockQueue: Queue<Block>;

export const setupQueue = () => {
  blockQueue = new Queue('blocks', {
    redis: {
      url: configs.redisUrl
    }
  });
}