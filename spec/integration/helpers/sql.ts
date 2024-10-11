import { sql } from 'kysely';
import type { TransactionsDatabase } from '../../../src/_shared/postgresClient';

export const restartTable = async (db: TransactionsDatabase) => {
  await sql`truncate table transactions`.execute(db)
}