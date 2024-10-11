import crypto from 'crypto';
import { describe, it, expect } from 'bun:test';
import {
  buildOutputRecords,
  requireValidAmounts,
  requireValidBlockHeight,
  requireValidBlockId,
  TransactionRecordStatus,
  requireUniqueInputId,
  requireBlockExists,
  requireAllInputsFound,
  extractOutputIds
} from '../../../src/blocks/entity';
import type { OutputRecord, TransactionRecord, Transaction } from '../../../src/blocks/types';

describe('The blocks entity', () => {
  it('should throw for an INVALID block hash', () => {
    const height = 1;
    const txIds = ['txId1', 'txId2', 'tx3'];
    const hash = 'invalidHashBlock';

    expect(() => requireValidBlockId(hash, height, txIds)).toThrow('Invalid block hash');
  })

  it('should NOT throw for a VALID block hash', () => {
    const height = 1;
    const txIds = ['txId1', 'txId2', 'tx3'];
    const hash = crypto.createHash('sha256').update(height + txIds.join('')).digest('hex');

    expect(() => requireValidBlockId(hash, height, txIds)).not.toThrow()
  })

  it('should throw if input and output sums DON\'T MATCH', () => {
    const utxos: TransactionRecord[] = [
      {
        id: 1,
        txId: 'tx1',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x111111',
        value: 10,
        status: TransactionRecordStatus.UNSPENT
      },
      {
        id: 2,
        txId: 'tx2',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x222222',
        value: 20,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    const transaction: Transaction = {
      id: 'tx1',
      inputs: [],
      outputs: [
        {
          address: '0x111111',
          value: 11
        }
      ]
    }

    expect(() => requireValidAmounts(utxos, transaction)).toThrow('Invalid amounts');
  })

  it('should NOT thow if input and output sums MATCH', () => {
    const utxos: TransactionRecord[] = [
      {
        id: 1,
        txId: 'tx1',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x111111',
        value: 10,
        status: TransactionRecordStatus.UNSPENT
      },
      {
        id: 2,
        txId: 'tx2',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x222222',
        value: 20,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    const transaction: Transaction = {
      id: 'tx1',
      inputs: [
        {
          txId: 'tx1',
          index: 0
        },
        {
          txId: 'tx2',
          index: 0
        }
      ],
      outputs: [
        {
          address: '0x111111',
          value: 30
        }
      ]
    };

    expect(() => requireValidAmounts(utxos, transaction)).not.toThrow();
  })

  it('should throw if block height is NOT consecutive', () => {
    expect(() => requireValidBlockHeight(3, 5)).toThrow('Invalid block height');
  })

  it('should throw if the first block number is !== 0', () => {
    expect(() => requireValidBlockHeight(null, 1)).toThrow('Invalid block height');
  })

  it('should NOT throw if block height is consecutive', () => {
    expect(() => requireValidBlockHeight(3, 4)).not.toThrow();
  })

  it('should NOT throw if first block number is 0', () => {
    expect(() => requireValidBlockHeight(null, 0)).not.toThrow();
  })

  it('should throw if block does not exist', () => {
    expect(() => requireBlockExists(null, 3)).toThrow('Invalid block height');
    expect(() => requireBlockExists(0, 3)).toThrow('Invalid block height');
  })


  it('should throw if there are duplicate inputs in the same transaction', () => {
    const inputs = [
      { txId: 'tx4', index: 0 },
      { txId: 'tx5', index: 1 },
      { txId: 'tx4', index: 1 },
      { txId: 'tx4', index: 1 }
    ]

    expect(() => requireUniqueInputId(inputs)).toThrow();

  })

  it('should throw if there are duplicate inputs between transactions', () => {
    const inputs = [
      { txId: 'tx4', index: 0 },
      { txId: 'tx4', index: 1 },
      { txId: 'tx2', index: 0 },
      { txId: 'tx4', index: 1 },
    ];

    expect(() => requireUniqueInputId(inputs)).toThrow();
  })

  it('should NOT throw if there are only unique inputs', () => {
    const inputs = [
      { txId: 'tx4', index: 1 },
      { txId: 'tx4', index: 0 },
      { txId: 'tx2', index: 0 },
      { txId: 'tx4', index: 3 },
    ];

    expect(() => requireUniqueInputId(inputs)).not.toThrow();
  })

  it('should throw if received input list if different from the ones in the system', () => {
    const inputs = [
      { txId: 'tx4', index: 0 },
      { txId: 'tx4', index: 1 },
      { txId: 'tx2', index: 0 },
    ];

    const utxos: TransactionRecord[] = [
      {
        id: 1,
        txId: 'tx4',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x111111',
        value: 10,
        status: TransactionRecordStatus.UNSPENT
      },
      {
        id: 2,
        txId: 'tx4',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 1,
        address: '0x222222',
        value: 20,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    expect(() => requireAllInputsFound(inputs, utxos)).toThrow('Missing inputs');
  })

  it('should NOT throw if all txIds are accounted for', () => {
    const inputs = [
      { txId: 'tx4', index: 0 },
      { txId: 'tx4', index: 1 },
    ];

    const utxos: TransactionRecord[] = [
      {
        id: 1,
        txId: 'tx4',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 0,
        address: '0x111111',
        value: 10,
        status: TransactionRecordStatus.UNSPENT
      },
      {
        id: 2,
        txId: 'tx4',
        created: new Date(),
        updated: null,
        blockHeight: 1,
        spentOnBlock: null,
        index: 1,
        address: '0x222222',
        value: 20,
        status: TransactionRecordStatus.UNSPENT
      }
    ]

    expect(() => requireAllInputsFound(inputs, utxos)).not.toThrow('Missing inputs');
  })

  it('should build a valid transaction record for persitence', () => {
    const height = 1;

    const transaction: Transaction = {
      id: 'tx1',
      inputs: [],
      outputs: [
        {
          address: '0x111111',
          value: 11
        }
      ]
    }

    const expectedOutput: OutputRecord[] = [
      {
        txId: 'tx1',
        index: 0,
        blockHeight: 1,
        spentOnBlock: null,
        address: '0x111111',
        value: 11,
        status: TransactionRecordStatus.UNSPENT
      },
    ];

    expect(buildOutputRecords(height, transaction)).toEqual(expectedOutput)
  })

  it('should extract all output ids from a list of transactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        inputs: [],
        outputs: [
          {
            address: '0x111111',
            value: 11
          }
        ]
      },
      {
        id: 'tx2',
        inputs: [],
        outputs: [
          {
            address: '0x222222',
            value: 22
          },
          {
            address: '0x333333',
            value: 33
          }
        ]
      }
    ]

    expect(extractOutputIds(transactions)).toEqual([
      {
        txId: 'tx1',
        index: 0
      },
      {
        txId: 'tx2',
        index: 0
      },
      {
        txId: 'tx2',
        index: 1
      }
    ])
  })
})