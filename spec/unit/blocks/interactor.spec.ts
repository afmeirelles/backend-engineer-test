import { describe, it, expect, mock, spyOn, beforeEach, afterAll } from 'bun:test';
import type { Block, OutputRecord, TransactionRecord } from '../../../src/blocks/types';

import { getBalance, rollbackBlocks, saveNewBlock } from '../../../src/blocks/interactor';
import * as entity from '../../../src/blocks/entity';
import * as dbRepository from '../../../src/blocks/dbRepository';
import * as queueRepository from '../../../src/blocks/queueRepository';
import { TransactionRecordStatus } from '../../../src/blocks/entity';

describe('The blocks interactor', () => {

  afterAll(() => {
    mock.restore();
  })

  describe('when receiving a new block', () => {

    let newBlock: Block;
    let outputRecord: OutputRecord;
    let utxo: TransactionRecord;

    beforeEach(() => {
      newBlock = {
        id: 'blockId',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [
              {
                txId: 'tx1',
                index: 0
              }
            ],
            outputs: [
              {
                address: '0x321321321',
                value: 1
              }
            ]
          }
        ]
      };

      outputRecord = {
        txId: 'tx13',
        index: 0,
        blockHeight: 2,
        spentOnBlock: null,
        address: '0x321321321',
        value: 1,
        status: TransactionRecordStatus.UNSPENT
      }

      utxo = {
        id: 0,
        txId: 'tx1',
        index: 0,
        created: new Date(),
        updated: null,
        blockHeight: 2,
        spentOnBlock: null,
        address: '0x321321321',
        value: 1,
        status: TransactionRecordStatus.UNSPENT
      }

      spyOn(entity, 'requireValidBlockId').mockImplementation(() => { });
      spyOn(entity, 'requireValidBlockHeight').mockImplementation(() => { });
      spyOn(entity, 'requireUniqueInputId').mockImplementation(() => { });
      spyOn(entity, 'requireValidAmounts').mockImplementation(() => { });
      spyOn(entity, 'requireAllInputsFound').mockImplementation(() => { });
      spyOn(entity, 'buildOutputRecords').mockReturnValue([outputRecord]);

      spyOn(dbRepository, 'getLastBlock').mockResolvedValue(1);
      spyOn(dbRepository, 'getUnspentTransactionsFromList').mockResolvedValue([utxo]);
      spyOn(dbRepository, 'getTxsByIdList').mockResolvedValue([]);
      spyOn(dbRepository, 'saveAll').mockResolvedValue();

      spyOn(queueRepository, 'addToQueue').mockResolvedValue();
    })

    it('should call requireValidBlockId with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.requireValidBlockId).toHaveBeenCalledWith(
        newBlock.id,
        newBlock.height,
        newBlock.transactions.map(tx => tx.id)
      );
    })

    it('should call requireValidBlockHeight with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.requireValidBlockHeight).toHaveBeenCalledWith(
        1,
        newBlock.height
      );
    })

    it('should call requireUniqueInputId with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.requireUniqueInputId).toHaveBeenCalledWith(newBlock.transactions[0].inputs);
    })

    it('should call buildOutputRecords with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.buildOutputRecords).toHaveBeenCalledWith(
        newBlock.height,
        newBlock.transactions[0]
      );
    })

    it('should call getUnspentTransactions with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(dbRepository.getUnspentTransactionsFromList).toHaveBeenCalledWith([
        {
          txId: 'tx1',
          index: 0
        }
      ]);
    })

    it('should call requireValidAmounts with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.requireValidAmounts).toHaveBeenCalledWith([utxo], newBlock.transactions[0]);
    })

    it('should call requireAllInputsFound with correct params', async () => {
      await saveNewBlock(newBlock);

      expect(entity.requireAllInputsFound).toHaveBeenCalledWith(
        newBlock.transactions[0].inputs,
        [utxo],
      );
    })

    it('should call saveAll with correct params and return a list of utxos', async () => {
      const utxos = await saveNewBlock(newBlock);

      expect(utxos).toEqual([utxo]);

      expect(dbRepository.saveAll).toHaveBeenCalledWith(
        [utxo],
        [outputRecord]
      );
    })

  })

  describe('when fetching an address balance', () => {

    beforeEach(() => {
      spyOn(dbRepository, 'balanceOf').mockResolvedValue(1);
    })

    it('should just return the balance', async () => {
      const balance = await getBalance('0x123123123');

      expect(balance).toBe(1);

      expect(dbRepository.balanceOf).toHaveBeenCalledWith('0x123123123');
    })

  })

  describe('when rollbacking blocks', () => {

    beforeEach(() => {
      spyOn(entity, 'requireBlockExists').mockImplementation(() => { });
      spyOn(dbRepository, 'getLastBlock').mockResolvedValue(100);
      spyOn(dbRepository, 'deleteFromHeight').mockResolvedValue();
    })

    it('should should call getLastBlock with correct params', async () => {
      await rollbackBlocks(99);

      expect(dbRepository.getLastBlock).toHaveBeenCalled();
    })

    it('should should call requireBlockExists with correct params', async () => {
      await rollbackBlocks(99);

      expect(entity.requireBlockExists).toHaveBeenCalledWith(100, 99);
    })

    it('should should call deleteFromHeight with correct params', async () => {
      await rollbackBlocks(99);

      expect(dbRepository.deleteFromHeight).toHaveBeenCalledWith(99);
    })

  })

})



