import _ from 'lodash';
import crypto from 'crypto';
import type TestAgent from 'supertest/lib/agent';
import { describe, it, expect, beforeAll, afterAll, spyOn } from 'bun:test';
import { type TransactionsDatabase } from '../../../src/_shared/postgresClient';
import { restartTable } from '../helpers/sql';
import testHelpers, { type Setup, type TearDown } from '../helpers/startIntegrationEnv';
import * as queueRepository from '../../../src/blocks/queueRepository';
import type { Block } from '../../../src/blocks/types';

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const shouldSpinUpServer = process.env.NODE_ENV == 'ci'

// @dev: the test cases should be run in order, as each case builds on the previous one
describe('E2E integration test', () => {
  let db: TransactionsDatabase;
  let request: TestAgent
  const satoshi = '0xsatoshi'
  const alice = '0xalice'
  const bob = '0xbob'
  const charles = '0xcharles'
  let setup: Setup;
  let tearDown: TearDown;

  let balanceSnapshot: {
    block: number
    balances: {
      [key: string]: number
    }
  }

  beforeAll(async () => {
    ({ setup, tearDown } = await testHelpers({ spinUpServer: shouldSpinUpServer }));

    ({ db, request } = await setup());
  });

  afterAll(async () => {
    await tearDown();
  })


  it('should return 0 if no unspent transactions are found for a given address', async () => {
    const response = await request.get(`/balance/${alice}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ balance: 0 })
  })

  it('should correctly process a genesis block and return the new utxos', async () => {
    const response = await request
      .post('/blocks')
      .send({
        id: hash(0 + 'tx1'),
        height: 0,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [
              {
                address: satoshi,
                value: 100000000
              }
            ]
          }
        ]
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      utxos: [
        {
          txId: 'tx1',
          index: 0,
          blockHeight: 0,
          address: satoshi,
          value: 100000000,
          status: 'UNSPENT',
        }
      ]
    })

    const balanceResponse = await request.get(`/balance/${satoshi}`)

    expect(balanceResponse.status).toBe(200)
    expect(balanceResponse.body).toEqual({ balance: 100000000 })
  })

  it('should reject to process a new genesis block', async () => {
    const { status, body } = await request
      .post('/blocks')
      .send({
        id: hash(0 + 'tx1'),
        height: 0,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [
              {
                address: satoshi,
                value: 100000000
              }
            ]
          }
        ]
      })

    expect(status).toBe(400)
    expect(body).toEqual({
      message: 'Invalid block height'
    })
  })

  it('should correctly process a genesis block with multiple outputs', async () => {
    await restartTable(db)

    const response = await request
      .post('/blocks')
      .send({
        id: hash(0 + 'tx1'),
        height: 0,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [
              {
                address: satoshi,
                value: 1000
              },
              {
                address: alice,
                value: 100
              },
              {
                address: bob,
                value: 50
              }
            ]
          }
        ]
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      utxos: [
        {
          txId: 'tx1',
          index: 0,
          blockHeight: 0,
          address: satoshi,
          value: 1000,
          status: 'UNSPENT',
        },
        {
          txId: 'tx1',
          index: 1,
          blockHeight: 0,
          address: alice,
          value: 100,
          status: 'UNSPENT',
        },
        {
          txId: 'tx1',
          index: 2,
          blockHeight: 0,
          address: bob,
          value: 50,
          status: 'UNSPENT',
        }
      ]
    })

    const responses = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`)
    ])

    responses.forEach(({ status }) => expect(status).toBe(200))

    expect(responses[0].body).toEqual({ balance: 1000 })
    expect(responses[1].body).toEqual({ balance: 100 })
    expect(responses[2].body).toEqual({ balance: 50 })
  })

  it('should correctly process a block with ONE transaction and multiple inputs and outputs', async () => {
    const { status, body } = await request
      .post('/blocks')
      .send({
        id: hash(1 + 'tx2'),
        height: 1,
        transactions: [
          {
            id: 'tx2',
            inputs: [
              {
                txId: 'tx1',
                index: 0
              },
              {
                txId: 'tx1',
                index: 1
              }
            ],
            outputs: [
              {
                address: satoshi,
                value: 900
              },
              {
                address: charles,
                value: 100
              },
              {
                address: alice,
                value: 70
              },
              {
                address: bob,
                value: 30
              }
            ]
          }
        ]
      })

    expect(status).toBe(200)
    expect(body).toEqual({
      utxos: [
        {
          txId: 'tx2',
          index: 0,
          blockHeight: 1,
          address: satoshi,
          value: 900,
          status: 'UNSPENT',
        },
        {
          txId: 'tx2',
          index: 1,
          blockHeight: 1,
          address: charles,
          value: 100,
          status: 'UNSPENT',
        },
        {
          txId: 'tx2',
          index: 2,
          blockHeight: 1,
          address: alice,
          value: 70,
          status: 'UNSPENT',
        },
        {
          txId: 'tx2',
          index: 3,
          blockHeight: 1,
          address: bob,
          value: 30,
          status: 'UNSPENT',
        }
      ]
    })

    const [
      { body: satoshiBalance },
      { body: aliceBalance },
      { body: bobBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`),
    ])

    expect(satoshiBalance).toEqual({ balance: 900 })
    expect(aliceBalance).toEqual({ balance: 70 })
    expect(bobBalance).toEqual({ balance: 80 })
    expect(charlesBalance).toEqual({ balance: 100 })
  })

  it('should correctly process a block with multiple transactions and a single input and output', async () => {
    const { status, body } = await request
      .post('/blocks')
      .send({
        id: hash(2 + 'tx3' + 'tx4'),
        height: 2,
        transactions: [
          {
            id: 'tx3',
            inputs: [
              {
                txId: 'tx2', // 100 charles
                index: 1
              },
            ],
            outputs: [
              {
                address: alice,
                value: 100
              },
            ]
          },
          {
            id: 'tx4',
            inputs: [
              {
                txId: 'tx2', // 30 bob
                index: 3
              }
            ],
            outputs: [
              {
                address: alice,
                value: 30
              },
            ]
          }
        ]
      })

    expect(status).toBe(200)
    expect(body).toEqual({
      utxos: [
        {
          txId: 'tx3',
          index: 0,
          blockHeight: 2,
          address: alice,
          value: 100,
          status: 'UNSPENT',
        },
        {
          txId: 'tx4',
          index: 0,
          blockHeight: 2,
          address: alice,
          value: 30,
          status: 'UNSPENT',
        }
      ]
    })

    const [
      { body: satoshiBalance },
      { body: aliceBalance },
      { body: bobBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`),
    ])

    expect(satoshiBalance).toEqual({ balance: 900 })
    expect(aliceBalance).toEqual({ balance: 200 })
    expect(bobBalance).toEqual({ balance: 50 })
    expect(charlesBalance).toEqual({ balance: 0 })
  })

  it('should correctly process a block with multiple transactions and multiple inputs and outputs', async () => {
    const response = await request
      .post('/blocks')
      .send({
        id: hash(3 + 'tx5' + 'tx6'),
        height: 3,
        transactions: [
          {
            id: 'tx5',
            inputs: [
              {
                txId: 'tx3', // 100, alice
                index: 0
              },
              {
                txId: 'tx4',
                index: 0 // 30, alice
              }
            ],
            outputs: [
              {
                address: bob,
                value: 120
              },
              {
                address: alice,
                value: 10
              }
            ]
          },
          {
            id: 'tx6',
            inputs: [
              {
                txId: 'tx2',
                index: 0 // 900 satoshi
              },
              {
                txId: 'tx2',
                index: 2 // 70 alice
              }
            ],
            outputs: [
              {
                address: charles,
                value: 100
              },
              {
                address: satoshi,
                value: 800
              },
              {
                address: charles,
                value: 70
              }
            ]
          }
        ]
      })

    expect(response.status).toBe(200)
    expect(_.orderBy(response.body.utxos, ['txId', 'index'])).toEqual(
      [
        {
          txId: 'tx5',
          index: 0,
          blockHeight: 3,
          address: bob,
          value: 120,
          status: 'UNSPENT',
        },
        {
          txId: 'tx5',
          index: 1,
          blockHeight: 3,
          address: alice,
          value: 10,
          status: 'UNSPENT',
        },
        {
          txId: 'tx6',
          index: 0,
          blockHeight: 3,
          address: charles,
          value: 100,
          status: 'UNSPENT',
        },
        {
          txId: 'tx6',
          index: 1,
          blockHeight: 3,
          address: satoshi,
          value: 800,
          status: 'UNSPENT',
        },
        {
          txId: 'tx6',
          index: 2,
          blockHeight: 3,
          address: charles,
          value: 70,
          status: 'UNSPENT',
        }
      ]
    )

    const [
      { body: satoshiBalance },
      { body: aliceBalance },
      { body: bobBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`),
    ])

    expect(satoshiBalance).toEqual({ balance: 800 })
    expect(aliceBalance).toEqual({ balance: 10 })
    expect(bobBalance).toEqual({ balance: 170 })
    expect(charlesBalance).toEqual({ balance: 170 })

    balanceSnapshot = {
      block: 3,
      balances: {
        satoshi: 800,
        alice: 10,
        bob: 170,
        charles: 170
      }
    }
  })

  it('should validate sum of inputs and outputs in each transaction', async () => {
    const response = await request
      .post('/blocks')
      .send({
        id: hash(4 + 'tx7' + 'tx8'),
        height: 4,
        transactions: [
          {
            id: 'tx7',
            inputs: [
              {
                txId: 'tx5', // 120 bob
                index: 0
              },
            ],
            outputs: [
              {
                address: bob,
                value: 110
              },
            ]
          },
          {
            id: 'tx8',
            inputs: [
              {
                txId: 'tx5', // 10 alice
                index: 1
              },
            ],
            outputs: [
              {
                address: bob,
                value: 20
              },
            ]
          }
        ]
      })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      message: 'Invalid amounts'
    })
  })

  it('should accept input txIds dependent on other output txId in the same block', async () => {
    const response = await request
      .post('/blocks')
      .send({
        id: hash(4 + 'tx7' + 'tx8' + 'tx9'),
        height: 4,
        transactions: [
          {
            id: 'tx7',
            inputs: [
              {
                txId: 'tx5', // 120 bob
                index: 0
              },
            ],
            outputs: [
              {
                address: alice,
                value: 120
              },
            ]
          },
          {
            id: 'tx8',
            inputs: [
              {
                txId: 'tx7', // 120 alice
                index: 0
              },
            ],
            outputs: [
              {
                address: bob,
                value: 10
              },
              {
                address: charles,
                value: 110
              },
            ]
          },
          {
            id: 'tx9',
            inputs: [
              {
                txId: 'tx8', // 110 charles
                index: 1
              },
              {
                txId: 'tx8', // 10 bob
                index: 0
              },
            ],
            outputs: [
              {
                address: charles,
                value: 120
              },
            ]
          }
        ]
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      utxos: [
        {
          txId: 'tx9',
          index: 0,
          blockHeight: 4,
          address: charles,
          value: 120,
          status: 'UNSPENT',
        }
      ]
    })

    const [
      { body: satoshiBalance },
      { body: aliceBalance },
      { body: bobBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`),
    ])

    expect(satoshiBalance).toEqual({ balance: 800 })
    expect(aliceBalance).toEqual({ balance: 10 })
    expect(bobBalance).toEqual({ balance: 50 })
    expect(charlesBalance).toEqual({ balance: 290 })

  })

  it('should prevent multiple blocks of the same height of being processed', async () => {
    const createRequest = () => request
      .post('/blocks')
      .send({
        id: hash(5 + 'tx11'),
        height: 5,
        transactions: [
          {
            id: 'tx11',
            inputs: [
              {
                txId: 'tx9', // 120 charles
                index: 0
              },
            ],
            outputs: [
              {
                address: alice,
                value: 120
              },
            ]
          }
        ]
      })

    const responses = await Promise.all(
      Array.from({ length: 10 }).map(() => createRequest())
    )

    expect(responses).toHaveLength(10)
    // only one request should have been processed
    expect(responses.filter(({ status }) => status === 200).length).toBe(1)

    const [
      { body: aliceBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${alice}`),
      request.get(`/balance/${charles}`),
    ])

    expect(aliceBalance).toEqual({ balance: 130 })
    expect(charlesBalance).toEqual({ balance: 170 })
  })

  it('should rollback and restore balances', async () => {
    const { block, balances } = balanceSnapshot
    await request.post('/rollback')
      .query({ height: block })

    const [
      { body: satoshiBalance },
      { body: aliceBalance },
      { body: bobBalance },
      { body: charlesBalance }
    ] = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`),
    ])

    expect(satoshiBalance).toEqual({ balance: balances.satoshi })
    expect(aliceBalance).toEqual({ balance: balances.alice })
    expect(bobBalance).toEqual({ balance: balances.bob })
    expect(charlesBalance).toEqual({ balance: balances.charles })
  })

  it('should correctly enqueue and process multiple transactions', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    const originalAddToQueue = queueRepository.addToQueue

    // slow down processing to allow enqueueing
    spyOn(queueRepository, 'addToQueue').mockImplementationOnce(async (...args) => {
      await delay(1000)
      await originalAddToQueue(args as unknown as Block)
    })

    // resets to genesis block
    await request.post('/rollback')
      .query({ height: 0 })

    const block1 = {
      id: hash(1 + 'tx2'),
      height: 1,
      transactions: [
        {
          id: 'tx2',
          inputs: [
            {
              txId: 'tx1',
              index: 0
            },
            {
              txId: 'tx1',
              index: 1
            }
          ],
          outputs: [
            {
              address: satoshi,
              value: 900
            },
            {
              address: charles,
              value: 100
            },
            {
              address: alice,
              value: 70
            },
            {
              address: bob,
              value: 30
            }
          ]
        }
      ]
    }

    const block2 = {
      id: hash(2 + 'tx3' + 'tx4'),
      height: 2,
      transactions: [
        {
          id: 'tx3',
          inputs: [
            {
              txId: 'tx2', // 100 charles
              index: 1
            },
          ],
          outputs: [
            {
              address: alice,
              value: 100
            },
          ]
        },
        {
          id: 'tx4',
          inputs: [
            {
              txId: 'tx2', // 30 bob
              index: 3
            }
          ],
          outputs: [
            {
              address: alice,
              value: 30
            },
          ]
        }
      ]
    }

    const responses = await Promise.all([
      request.post('/blocks/async').send(block1),
      request.post('/blocks/async').send(block2),
    ])

    responses.map(({ status }) => expect(status).toBe(202))

    await delay(1500)

    const balances = await Promise.all([
      request.get(`/balance/${satoshi}`),
      request.get(`/balance/${alice}`),
      request.get(`/balance/${bob}`),
      request.get(`/balance/${charles}`)
    ])

    expect(balances[0].body).toEqual({ balance: 900 })
    expect(balances[1].body).toEqual({ balance: 200 })
    expect(balances[2].body).toEqual({ balance: 50 })
    expect(balances[3].body).toEqual({ balance: 0 })
  }, 10000)

})

