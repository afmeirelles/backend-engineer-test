
import _ from 'lodash';
import {
  buildOutputRecords,
  extractOutputIds,
  requireAllInputsFound,
  requireBlockExists,
  requireUniqueInputId,
  requireValidAmounts,
  requireValidBlockHeight,
  requireValidBlockId
} from './entity';
import {
  balanceOf,
  deleteFromHeight,
  getLastBlock,
  getUnspentTransactionsFromList,
  saveAll
} from './dbRepository';
import type { Block, OutputRecord, TransactionRecord } from './types';
import { ResourceLocked } from '../_shared/errors';
import { addToQueue } from './queueRepository';

/**
 * @dev Interactor
 * Business logic for the blocks domain
 */

let locked = false;

const lock = () => locked = true;
const unlock = () => locked = false;

/**
 * Processes a new block
 * @dev blocks are meant to be consecutive, so new incoming blocks
 * will be rejecting while there's a block being processed
 * @param {Block} block the block to be processes
 * @returns
 */
export const saveNewBlock = async (block: Block): Promise<OutputRecord[]> => {
  if (locked) throw new ResourceLocked('A block is already being processed');

  try {
    lock()
    // validate received block height against the last saved bock
    const currentBlockHeight = await getLastBlock();
    requireValidBlockHeight(currentBlockHeight, block.height);

    // validate block hash
    requireValidBlockId(block.id, block.height, block.transactions.map(tx => tx.id));

    const outputs = await processBlock(currentBlockHeight, block);

    unlock()

    return outputs;
  } catch (e) {
    unlock()

    throw e;
  }
}

/**
 * Process all transactions in a block
 * @param currentBlockHeight last block number from db
 * @param block the block to be processed
 * @returns {TransactionRecord[]} the new UTXOs
 */
const processBlock = async (currentBlockHeight: number | null, block: Block): Promise<OutputRecord[]> => {
  for await (const tx of block.transactions) {
    requireUniqueInputId(tx.inputs);

    const outputs = buildOutputRecords(block.height, tx);

    let utxos: TransactionRecord[] = [];

    // if it's not the genesis block, validate inputs and outputs
    if (currentBlockHeight !== null) {

      // get input transactions by their ids
      utxos = await getUnspentTransactionsFromList(tx.inputs);

      // validate if all inputs are indeed UTXOs
      requireAllInputsFound(tx.inputs, utxos);

      // validate block inputs and outputs sum
      requireValidAmounts(utxos, tx);
    }

    // update spent transactions and insert new outputs
    await saveAll(utxos, outputs);
  }

  // as we can have dependent transactions in the same block,
  // we need to get the UTXOs again
  return getUnspentTransactionsFromList(
    extractOutputIds(block.transactions)
  );
}

/**
 * Fetch the balance of an address
 * @param address the address to be checked
 * @returns {number} the balance
 */
export const getBalance = async (address: string): Promise<number> => {
  return balanceOf(address)
}

/**
 * Rollback blocks to a given height
 * @dev will delete all transactions created and restore
 * all transactions spent from that height up
 * @param blockHeight the target block number to rollback to
 */
export const rollbackBlocks = async (blockHeight: number): Promise<void> => {
  // validate block height exists
  const currentBlockHeight = await getLastBlock();

  requireBlockExists(currentBlockHeight, blockHeight);

  await deleteFromHeight(blockHeight);
}

/**
 * Enqueue a block to be processed
 * @dev block hash can be eagerly validated here
 * @param block
 */
export const enqueueBlock = async (block: Block): Promise<void> => {
  // validate block hash
  requireValidBlockId(block.id, block.height, block.transactions.map(tx => tx.id));

  await addToQueue(block)
}