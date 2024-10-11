import type { FromSchema } from "json-schema-to-ts";
import type { TransactionRecordStatus } from "./entity";
import type { balanceRequestSchema, newBlockRequestSchema, rollbackRequestSchema } from "./schemas";

export type Output = {
  address: string;
  value: number;
}

export type Input = {
  txId: string;
  index: number;
}

export type Transaction = {
  id: string;
  inputs: Array<Input>
  outputs: Array<Output>
}

export type Block = {
  id: string;
  height: number;
  transactions: Array<Transaction>;
}

export type TransactionRecord = {
  id: number,
  txId: string
  index: number,
  created: Date,
  updated: Date | null,
  blockHeight: number,
  spentOnBlock: number | null,
  address: string,
  value: number,
  status: TransactionRecordStatus
}

export type OutputRecord = Pick<
  TransactionRecord,
  'txId' | 'index' | 'blockHeight' | 'spentOnBlock' | 'address' | 'value' | 'status'
>

export type BalanceRequest = FromSchema<typeof balanceRequestSchema.params>
export type NewBlockRequest = FromSchema<typeof newBlockRequestSchema.body>
export type RollbackRequest = FromSchema<typeof rollbackRequestSchema.querystring>