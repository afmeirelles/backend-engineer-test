import { describe, it, expect, spyOn, beforeAll, afterAll, mock } from 'bun:test';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import type TestAgent from 'supertest/lib/agent';
import server from '../../../src/server';
import * as interactor from '../../../src/blocks/interactor';
import * as controller from '../../../src/blocks/controller';


describe('The blocks api', () => {

  let fastify: FastifyInstance
  let request: TestAgent

  beforeAll(async () => {
    // mock processQueue so it won't try to connect to redis on server startup
    spyOn(controller, 'processQueue').mockResolvedValue()

    fastify = await server({ logger: false })
    request = supertest(fastify.server)

    spyOn(interactor, 'getBalance').mockResolvedValue(0)
    spyOn(interactor, 'saveNewBlock').mockResolvedValue([])
    spyOn(interactor, 'rollbackBlocks').mockResolvedValue()

  })

  afterAll(async () => {
    fastify.close()
    mock.restore()
  })

  describe('when reading balances', () => {

    it('should return a 404 error if the address is not provided', async () => {
      const response = await request.get('/balance')

      expect(response.status).toBe(404)
    })

    it('should return the value the interactor returns', async () => {
      const response = await request.get('/balance/0x1234')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ balance: 0 })
    })

  })

  describe('when saving new blocks',  () => {

    it('should return a 400 error if any of required parameters is missing', async () => {
      const response = await request
        .post('/blocks')
        .send({
          id: 'blockId',
          height: 0,
        })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        message: `body must have required property 'transactions'`
      })
    })

    it('should not accept negative block heights', async () => {
      const response = await request
        .post('/blocks')
        .send({
          id: 'blockId',
          height: -1,
          transactions: []
        })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          message: 'body/height must be >= 0'
        })
    })

    it('should return whatever the interactor returns', async () => {
      const response = await request
        .post('/blocks')
        .send({
          id: 'blockId',
          height: 0,
          transactions: []
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ utxos: [] })
    })

  })

  describe('when rollbacking blocks',  () => {

    it('should return a 404 error if block height is missing', async () => {
      const response = await request
        .get('/rollback')

      expect(response.status).toBe(404)
    })

    it('should return whatever the interactor returns', async () => {
      const response = await request
        .post('/rollback')
        .query({
          height: 0,
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({})
    })

  })

})