import crypto from 'crypto';
import { describe, it, expect, mock, spyOn, beforeAll, afterAll } from 'bun:test';
import type { Block, OutputRecord, TransactionRecord } from '../../../src/blocks/types';

import { saveNewBlock } from '../../../src/blocks/interactor';
import * as repository from '../../../src/blocks/dbRepository';
import { TransactionRecordStatus } from '../../../src/blocks/entity';

describe('Block creation business logic integration tests', () => {

  let newBlock: Block;
  let utxos1stTransaction: TransactionRecord[];
  let utxos2ndTransaction: TransactionRecord[];

  beforeAll(() => {
    const blockId = crypto.createHash('sha256').update('101' + 'tx10' + 'tx11').digest('hex');

    newBlock = {
      id: blockId,
      height: 101,
      transactions: [
        {
          id: 'tx10',
          inputs: [
            {
              txId: 'tx1',
              index: 0
            }
          ],
          outputs: [
            {
              address: '0x111111',
              value: 99
            }
          ]
        },
        {
          id: 'tx11',
          inputs: [
            {
              txId: 'tx1',
              index: 1
            },
            {
              txId: 'tx2',
              index: 0
            }
          ],
          outputs: [
            {
              address: '0x2222',
              value: 47
            },
            {
              address: '0x333',
              value: 130
            }
          ]
        }
      ]
    };

    utxos1stTransaction = [
      {
        id: 0,
        txId: 'tx1',
        index: 0,
        created: new Date(),
        updated: null,
        blockHeight: 2,
        spentOnBlock: null,
        address: '0x111111',
        value: 99,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    utxos2ndTransaction = [
      {
        id: 1,
        txId: 'tx1',
        index: 1,
        created: new Date(),
        updated: null,
        blockHeight: 2,
        spentOnBlock: null,
        address: '0x111111',
        value: 101,
        status: TransactionRecordStatus.UNSPENT
      },
      {
        id: 1,
        txId: 'tx2',
        index: 0,
        created: new Date(),
        updated: null,
        blockHeight: 2,
        spentOnBlock: null,
        address: '0x111111',
        value: 76,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    spyOn(repository, 'getLastBlock').mockResolvedValue(100);
    spyOn(repository, 'getUnspentTransactionsFromList')
      .mockResolvedValueOnce(utxos1stTransaction)
      .mockResolvedValueOnce(utxos2ndTransaction)
      .mockResolvedValueOnce([...utxos1stTransaction, ...utxos2ndTransaction]);
    spyOn(repository, 'getTxsByIdList').mockResolvedValue([]);
    spyOn(repository, 'saveAll').mockResolvedValue();
  })

  afterAll(() => {
    mock.restore();
  })

  it('should correctly process a block', async () => {
    await saveNewBlock(newBlock)

    const { transactions } = newBlock;

    const expectedOutputs: OutputRecord[] = [
      {
        txId: transactions[0].id,
        address: '0x111111',
        value: 99,
        index: 0,
        blockHeight: 101,
        spentOnBlock: null,
        status: TransactionRecordStatus.UNSPENT,
      },
      {
        txId: transactions[1].id,
        address: '0x2222',
        value: 47,
        index: 0,
        blockHeight: 101,
        spentOnBlock: null,
        status: TransactionRecordStatus.UNSPENT,
      },
      {
        txId: transactions[1].id,
        address: '0x333',
        value: 130,
        index: 1,
        blockHeight: 101,
        spentOnBlock: null,
        status: TransactionRecordStatus.UNSPENT,
      }
    ];

    expect(repository.saveAll).toHaveBeenCalledTimes(2);

    expect(repository.saveAll).toHaveBeenCalledWith(utxos1stTransaction, expectedOutputs.slice(0, 1));
    expect(repository.saveAll).toHaveBeenCalledWith(utxos2ndTransaction, expectedOutputs.slice(1));
  })


})