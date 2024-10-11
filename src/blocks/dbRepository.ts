import type { Input, OutputRecord, TransactionRecord } from './types';
import type { ExpressionBuilder } from 'kysely';
import { db, type Database, type TransactionInsertRecord, type TransactionTable } from '../_shared/postgresClient';
import { TransactionRecordStatus } from './entity';
import { sql } from 'kysely';
import _ from 'lodash';

/**
 * @dev Repository
 * Layer in charge of adapting business logic requirements
 * into database language and vice-versa, acting as another
 * boundary
 */

const TABLE_NAME = 'transactions';

export const getLastBlock = async (): Promise<number | null> => {
  const [r] = await db.selectFrom(TABLE_NAME)
    .select('block_height')
    .orderBy('block_height', 'desc')
    .limit(1)
    .execute()

  if (!r) return null

  return Number(r.block_height)
}

export const getTxsByIdList = async (txIds: string[]): Promise<TransactionRecord[]> => {
  const txs = await db.selectFrom(TABLE_NAME)
    .selectAll()
    .where('tx_id', 'in', txIds)
    .execute()

  return txs.map(toTransactionRecord)
}

const txIdAndIndexTuple = (params: Input[]) => (eb: ExpressionBuilder<Database, 'transactions'>) =>
  eb(
    eb.refTuple('tx_id', 'tx_index'),
    'in',
    params.map(({ txId, index }) => eb.tuple(txId, index))
  )

export const getUnspentTransactionsFromList = async (inputs: Input[]): Promise<TransactionRecord[]> => {
  const utxos = await db.selectFrom(TABLE_NAME)
    .selectAll()
    .where(txIdAndIndexTuple(inputs))
    .where('status', '=', TransactionRecordStatus.UNSPENT)
    .execute()

  return utxos.map(toTransactionRecord)
}

export const balanceOf = async (address: string): Promise<number> => {
  const [{ total_value }] = await db.selectFrom(TABLE_NAME)
    .select(sql<number>`SUM(value)`.as('total_value'))
    .where('address', '=', address)
    .where('status', '=', TransactionRecordStatus.UNSPENT)
    .execute()

  return total_value ? Number(total_value) : 0;
}

export const deleteFromHeight = async (blockHeight: number): Promise<void> => {
  await db.transaction().execute(async trx => {
    // delete all transactions created from that height up
    await trx.deleteFrom(TABLE_NAME)
      .where('block_height', '>', blockHeight)
      .execute()

    // restore all transactions spent from that height up
    await trx.updateTable(TABLE_NAME)
      .set('status', TransactionRecordStatus.UNSPENT)
      .where('spent_on_block', '>', blockHeight)
      .where('status', '=', TransactionRecordStatus.SPENT)
      .execute()
  })
}

export const saveAll = async (inputs: { id: number }[], outputs: OutputRecord[]) => {
  await db.transaction().execute(async trx => {
    // if genesis block, skip updating
    if (inputs.length !== 0) {
      await trx.updateTable(TABLE_NAME)
        .set('status', TransactionRecordStatus.SPENT)
        .set('updated', sql`now()`)
        .set('spent_on_block', outputs[0].blockHeight)
        .where('id', 'in', inputs.map(i => i.id))
        .execute()
    }

    await trx.insertInto(TABLE_NAME)
      .values(outputs.map(fromTransactionRecord))
      .execute()
  });
}

const toTransactionRecord = (r: TransactionTable): TransactionRecord => (
  {
    ..._.omit(r, 'tx_id', 'tx_index', 'block_height', 'spent_on_block'),
    txId: r.tx_id,
    index: r.tx_index,
    created: new Date(r.created.toString()),
    updated: r.updated ? new Date(r.updated.toString()) : null,
    id: Number(r.id),
    blockHeight: Number(r.block_height),
    spentOnBlock: r.spent_on_block ? Number(r.spent_on_block) : null,
    value: Number(r.value),
  }
)

const fromTransactionRecord = (r: OutputRecord): TransactionInsertRecord => (
  {
    ..._.omit(r, 'txId', 'index', 'blockHeight', 'spentOnBlock'),
    tx_index: r.index,
    tx_id: r.txId,
    block_height: r.blockHeight,
    spent_on_block: r.spentOnBlock,
  }
)