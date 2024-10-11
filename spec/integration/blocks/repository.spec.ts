import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { type TransactionInsertRecord, type TransactionsDatabase } from '../../../src/_shared/postgresClient';
import {
  balanceOf,
  deleteFromHeight,
  getLastBlock,
  getTxsByIdList,
  getUnspentTransactionsFromList,
  saveAll
} from '../../../src/blocks/dbRepository';
import { TransactionRecordStatus } from '../../../src/blocks/entity';
import type { Input, OutputRecord } from '../../../src/blocks/types';
import { restartTable } from '../helpers/sql';
import testHelpers, { type Setup, type TearDown } from '../helpers/startIntegrationEnv';

const shouldSpinUpServer = process.env.NODE_ENV == 'ci'

describe('The blocks repository', () => {
  let db: TransactionsDatabase;
  let setup: Setup;
  let tearDown: TearDown;

  beforeAll(async () => {
    ({ setup, tearDown } = await testHelpers({ spinUpServer : shouldSpinUpServer }));

    ({ db } = await setup());
  });

  afterAll(async () => {
    await tearDown()
  });

  describe('when getting last block', () => {

    it('should return null if no transactions are found', async () => {
      expect(await getLastBlock()).toEqual(null)
    })

    it('should return the last block when transactions are found', async () => {
      await db.insertInto('transactions')
        .values({
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT
        })
        .execute()

      expect(await getLastBlock()).toEqual(1)

      await restartTable(db)
    })

  })

  describe('when getting UTXOs', () => {

    const inputs: Input[] = [
      {
        txId: 'tx1',
        index: 0
      },
      {
        txId: 'tx2',
        index: 0
      },
      {
        txId: 'tx3',
        index: 0
      }
    ]

    it('should return an empty array if no transactions are found', async () => {
      expect(await getUnspentTransactionsFromList(inputs)).toEqual([])
    })

    it('should get all unspent transactions by their id', async () => {
      const transactions: TransactionInsertRecord[] = [
        {
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx2',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 1, // << not the index we were looking for
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        }
      ]

      await db.insertInto('transactions')
        .values(transactions)
        .execute()

      const utxos = await getUnspentTransactionsFromList(inputs)

      expect(utxos).toHaveLength(2)

      const utxosWithoutIdAndCreated = utxos.map(({ id, created, updated, ...utxo }) => {
        expect(id).toBeDefined()
        expect(created).toBeDefined()
        expect(updated).toBe(null)
        return utxo
      })

      expect(utxosWithoutIdAndCreated).toEqual(
        transactions.slice(0, 2).map(({ tx_id, tx_index, block_height, spent_on_block, address, value, status }) => ({
          txId: tx_id,
          index: tx_index,
          blockHeight: block_height,
          spentOnBlock: spent_on_block,
          address,
          value,
          status
        }))
      )

      await restartTable(db)
    })

  })

  describe('when getting transactions by tx id', () => {

    it('should return an empty array if no transactions are found', async () => {
      expect(await getTxsByIdList(['unknown1', 'unknown'])).toEqual([])
    })

    it('should return transactions by their id', async () => {
      const transactions: TransactionInsertRecord[] = [
        {
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        },
        {
          tx_id: 'tx2',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 1, // << not the index we were looking for
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        }
      ]

      await db.insertInto('transactions')
        .values(transactions)
        .execute()

      const txs = await getTxsByIdList(['tx1', 'tx3'])

      expect(txs).toHaveLength(2)

      await restartTable(db)
    })

  })

  describe('when getting balances', () => {

    it('should return 0 if there are no transactions', async () => {
      expect(await balanceOf('0x111111')).toEqual(0)
    })

    it('should return values from UNSPENT transactions only', async () => {
      const transactions: TransactionInsertRecord[] = [
        {
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx2',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 1, // << not the index we were looking for
          block_height: 1,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        }
      ]

      await db.insertInto('transactions')
        .values(transactions)
        .execute()

      expect(await balanceOf('0x111111')).toEqual(1)

      await restartTable(db)
    })

  })

  describe('when deleting from a given block', () => {

    let transactions: TransactionInsertRecord[]

    it('should update all transactions from that block height as ORPHANED', async () => {
      transactions = [
        {
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 0,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx2',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 0,
          block_height: 2,
          spent_on_block: null,
          address: '0x111111',
          value: 1,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx3',
          tx_index: 1, // << not the index we were looking for
          block_height: 3,
          spent_on_block: null,
          address: '0x321321321',
          value: 1,
          status: TransactionRecordStatus.SPENT,
        }
      ]

      await db.insertInto('transactions')
        .values(transactions)
        .execute()

      await deleteFromHeight(1)

      const txs = await db.selectFrom('transactions')
        .selectAll()
        .execute()

      expect(txs).toHaveLength(2)
      expect(txs[0].tx_id).toEqual('tx1')
      expect(txs[1].tx_id).toEqual('tx2')

      await restartTable(db)
    })

  })

  describe('when saving inputs and outputs', () => {

    it('should atomically update inputs to SPENT and save the new outputs ', async () => {
      const transactions: TransactionInsertRecord[] = [
        {
          tx_id: 'tx1',
          tx_index: 0,
          block_height: 0,
          spent_on_block: null,
          address: '0x111111',
          value: 137,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx1',
          tx_index: 1,
          block_height: 0,
          spent_on_block: null,
          address: '0x111111',
          value: 2,
          status: TransactionRecordStatus.UNSPENT,
        },
        {
          tx_id: 'tx2',
          tx_index: 0,
          block_height: 1,
          spent_on_block: null,
          address: '0x111111',
          value: 52,
          status: TransactionRecordStatus.UNSPENT,
        }
      ]

      const ids = await db.insertInto('transactions')
        .values(transactions)
        .returning('id')
        .execute()

      const outputs: OutputRecord[] = [
        {
          txId: 'tx4',
          index: 0,
          blockHeight: 1,
          spentOnBlock: null,
          address: '0x222222',
          value: 150,
          status: TransactionRecordStatus.UNSPENT
        },
        {
          txId: 'tx4',
          index: 1,
          blockHeight: 1,
          spentOnBlock: null,
          address: '0x333333',
          value: 40,
          status: TransactionRecordStatus.UNSPENT
        }
      ]

      await saveAll(ids, outputs)

      const txs = await db.selectFrom('transactions')
        .selectAll()
        .where('status', '=', TransactionRecordStatus.UNSPENT)
        .execute()

      expect(txs).toHaveLength(2)
    })

  })

})
