import { createHash } from 'crypto';
import _ from 'lodash';
import type { OutputRecord, Input, Transaction, TransactionRecord } from './types';
import { InvalidParameter } from '../_shared/errors';

/**
 * @dev Entity
 * Business rules for the blocks domain
 */

export enum TransactionRecordStatus {
  UNSPENT = 'UNSPENT',
  SPENT = 'SPENT'
}
/**
 * Throws if the block hash is invalid
 * @dev Block ids are calculated by sha256 hashing
 * block height and all the transaction ids
 * @param hash block hash
 * @param height block height
 * @param txIds list of transaction ids
 **/
export const requireValidBlockId = (hash: string, height: number, txIds: string[]) => {
  const input = height + txIds.join('');

  const isValidBlockId = createHash('sha256').update(input).digest('hex') === hash

  if (!isValidBlockId) throw new InvalidParameter('Invalid block hash');
}

/**
 * Throws if the sum of inputs and outputs don't match
 * @dev The sum of inputs must match the sum of outputs.
 * We use a hashmap to keep O(n) time complexity
 * @param utxos the unspent transactions
 * @param inputs the transaction inputs
 */
export const requireValidAmounts = (utxos: TransactionRecord[], { inputs, outputs }: Transaction) => {
  // build a hasmap of txId_index and amount from the utxos so we can reference it later
  const utxoMap = utxos.reduce((memo: { [key: string]: number }, utxo) => {
    const key = `${utxo.txId}_${utxo.index}`;
    memo[key] = utxo.value;
    return memo;
  }, {});

  // add the values from the utxo map to the inputs so we can sum them
  const inputsWithValues = inputs.map(
    input => ({
      ...input,
      value: utxoMap[`${input.txId}_${input.index}`]
    })
  )

  // sum all the things
  const inputTotal = _.sumBy(inputsWithValues, 'value');
  const outputTotal = _.sumBy(outputs, 'value');

  if (inputTotal !== outputTotal) throw new InvalidParameter('Invalid amounts');
}

/**
 * Throws if block height is not consecutive
 * @dev Block heigh must be consecutive. If current block height is null,
 * this is the genesis block
 * @param current current block heigh
 * @param received received block height
 */
export const requireValidBlockHeight = (current: number | null, received: number) => {
  const isGenesisBlock = current === null && received === 0
  const isConsecutive = current !== null && received === current + 1

  if (!isGenesisBlock && !isConsecutive) throw new InvalidParameter('Invalid block height');
}

/**
 * Throws if there's no block at that height
 * @dev When rollbacking, we validate if the block was mined
 * @param currentBlockHeight current block height
 * @param receivedBlockHeight the target block height to rollback to
 */
export const requireBlockExists = (currentBlockHeight: number | null, receivedBlockHeight: number) => {
  if (
    currentBlockHeight === null ||
    receivedBlockHeight >= currentBlockHeight
  ) throw new Error('Invalid block height');
}

/**
 * @dev We can't allow duplicate inputs in the same transaction.
 * Each input is unique by txId and index
 * @param inputs transaction inputs
 */
export const requireUniqueInputId = (inputs: Input[]) => {
  // boolean hash map to check for duplicates
  const found: { [key: string]: boolean } = {};

  inputs.forEach(i => {
    const key = `${i.txId}_${i.index}`;
    if (found[key]) throw new InvalidParameter('Cannot process duplicate inputs');

    found[key] = true
  })
}

// /**
//  * @dev When building the outputs
//  * @param transactions
//  */
// export const requireNoUsedTxIds = (transactions: TransactionRecord[]) => {
//   if (transactions.length !== 0) throw new InvalidParameter('Cannot process duplicate txIds');
// }

/**
 * Throws if any input was not found in the utxos
 * @param inputs transaction inputs
 * @param utxos unspent transactions
 */
export const requireAllInputsFound = (inputs: Input[], utxos: TransactionRecord[]) => {
  if (inputs.length !== utxos.length) throw new InvalidParameter('Missing inputs');
}

/**
 * Builds the output records to be saved to the database
 * @param blockHeight
 * @param tx
 * @returns a list of output records
 */
export const buildOutputRecords = (blockHeight: number, tx: Transaction): OutputRecord[] => {
  return _(tx.outputs)
    // build output records
    .map((o, index) => ({
        txId: tx.id,
        index,
        blockHeight,
        spentOnBlock: null,
        address: o.address,
        value: Number(o.value),
        status: TransactionRecordStatus.UNSPENT
      }))
    // flatten the array
    .flatten()
    // extract outputs
    .value()
}

/**
 * Extract the output ids from block transactions
 * @param transactions block transactions
 * @returns a list of all output ids in the block
 */
export const extractOutputIds = (transactions: Transaction[]): { txId: string, index: number}[] => {
  return _(transactions)
    .map(({ id, outputs }) => {
      return outputs.map(
        // @ts-ignore we only need the index here
        ((o, index) => ({
          txId: id,
          index
        }))
      )
    })
    .flatten()
    .value()
}