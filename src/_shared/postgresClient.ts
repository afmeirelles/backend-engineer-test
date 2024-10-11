import { Pool } from 'pg';
import { Kysely, PostgresDialect, type Generated } from 'kysely';
import type { TransactionRecord } from '../blocks/types';

const setupDB = async (db: TransactionsDatabase) => {
  await db.schema
    .createTable('transactions')
    .ifNotExists()
    .addColumn('id', 'serial', cb => cb.primaryKey())
    .addColumn('tx_id', 'varchar(64)', cb => cb.notNull())
    .addColumn('tx_index', 'integer', cb => cb.notNull())
    .addColumn('block_height', 'integer', cb => cb.notNull())
    .addColumn('spent_on_block', 'integer')
    .addColumn('address', 'varchar(103)', cb => cb.notNull())
    .addColumn('value', 'integer', cb => cb.notNull())
    .addColumn('status', 'varchar(10)', cb => cb.notNull())
    .addColumn('created', 'timestamptz', cb => cb.notNull().defaultTo('NOW()'))
    .addColumn('updated', 'timestamptz')
    .execute()

  // heavly used to search for unspent transactions (1x per transaction, 1x per block to fetch response)
  await db.schema.createIndex('transactions_idx_tx_id_index_status')
    .ifNotExists()
    .on('transactions')
    .columns(['tx_id', 'tx_index', 'status'])
    .execute()

  // used by balance query
  await db.schema.createIndex('transactions_idx_address_status')
    .ifNotExists()
    .on('transactions')
    .columns(['address', 'status'])
    .execute()

  // heavly used for checking last block height and also when rollbacking
  await db.schema.createIndex('transactions_idx_block_height')
    .ifNotExists()
    .on('transactions')
    .columns(['block_height'])
    .execute()
}

// working as singleton
export let db: TransactionsDatabase

/**
 * @dev probably won't want to use .setupDB() in production
 * Creates tables and indexes in the database
 * and return a Kysely singleton
 * @param databaseUrl
 * @returns
 */
export const bootstrap = async (databaseUrl: string | undefined) => {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const pool = new Pool({
    connectionString: databaseUrl
  });

  const dialect = new PostgresDialect({ pool });

  db = new Kysely({ dialect })

  await setupDB(db);

  return db;
}

export interface TransactionTable extends Omit<
  TransactionRecord,
  'id' | 'created' | 'updated' | 'txId' | 'blockHeight' | 'index' | 'spentOnBlock'
> {
  id: number | Generated<number>,
  tx_id: string;
  block_height: number;
  spent_on_block: number | null;
  tx_index: number;
  created: Date | Generated<Date>,
  updated: Date | Generated<Date> | null,
}

export interface Database {
  transactions: TransactionTable
}

export type TransactionsDatabase = Kysely<Database>
export type TransactionInsertRecord = Omit<TransactionTable, 'id' | 'created' | 'updated' | 'index' > & { tx_index: number }