# EMURGO Backend Engineer Challenge

## TL;DR
### Setup
`bun install` install dependencies

### Run server
`bun run-docker` or `docker compose up -d` if starting with bun fails for some reason
`bun start` starts the server, will work if the DB is running

### Run tests
`bun run test` runs all tests against the default containers started by `docker compose up`

---

## Architecture
This solution was built with Clean Architecture principles in mind. The business logic is encapsulated in the `interactor` and `entity` files, while boundaries `controller` and `repository` keep the domain rules isolated from delivery and persistence mechanisms. `routes` inverses the dependency on the framework, which Uncle Bob would approve.

All layers of the `blocks` domain are gathered in the same folder, so the file structure better conveys the system's intention.

## Design choices
As the main goal of the indexer is to keep address balances based on UTXOs, the database has only one table, `transactions`. This table tracks `SPENT` and `UNSPENT` transactions and the block where the transactions were spent (if so). Block ids where intentionally left out because they don't seem to contribuite to the system's objective.

Transactions are processed in order, and blocks, as they are consecutive, are taken one at a time.

There are sync and async ways to process blocks. When working synchronously, the server will respond with an HTTP 409 status if a new request arrives while a previous one is being processed.

When processing block asynchronously, new blocks are added to a Redis FIFO queue and sequentially processed.

# Future improvements
- Implement a controller abstraction to reduce code repetition
- Reduce data repetition in tests
- Graceful shutdown
- LRU balance cache
- handle eventual sync/async conflicts
- add block height to

## Requests

### **1. GET /balance/:address**

- **Description**: Retrieve the balance for a specific address.
- **Method**: `GET`
- **URL**: `/balance/:address`

#### Parameters:
| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| address   | string | Yes      | The address for which the balance is being requested. |

#### Response Body:
| Field   | Type   | Description                   |
|---------|--------|-------------------------------|
| balance | number | The current balance of the address. |

#### Example Response:

```json
{
  "balance": 1000
}
```

### **2. POST /rollback?height=number**

- **Description**: Rollback to a specific block height in the blockchain.
- **Method**: `POST`
- **URL**: `/rollback`

#### Query Parameters:
| Parameter | Type    | Required | Description                                    |
|-----------|---------|----------|------------------------------------------------|
| height    | integer | Yes      | The block height to which the rollback should be performed. |

### **3. POST /blocks**

- **Description**: Submit a new block to the blockchain.
- **Method**: `POST`
- **URL**: `/blocks`

#### Body Parameters:
| Parameter     | Type    | Required | Description                                       |
|---------------|---------|----------|---------------------------------------------------|
| id            | string  | Yes      | The block's unique identifier.                    |
| height        | integer | Yes      | The height of the block in the blockchain.        |
| transactions  | array   | Yes      | Array of transactions included in the block.      |
| transactions.id      | string  | Yes      | The transaction's unique identifier.              |
| transactions.inputs  | array   | Yes      | List of inputs for the transaction.               |
| transactions.inputs.txId | string | Yes      | The transaction ID that this input references.    |
| transactions.inputs.index | integer | Yes  | The index of the output in the referenced transaction. |
| transactions.outputs | array  | Yes      | List of outputs for the transaction.              |
| transactions.outputs.address | string | Yes  | The receiving address of the output.              |
| transactions.outputs.value | integer | Yes    | The value associated with the output.             |

#### Example Body:

```json
{
  "id": "block123",
  "height": 5,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [
        {
          "txId": "tx123",
          "index": 0
        }
      ],
      "outputs": [
        {
          "address": "address123",
          "value": 1000
        }
      ]
    }
  ]
}
```
#### Response Body:
Each object in the array represents a transaction with the following fields:

| Field        | Type   | Description                                      |
|--------------|--------|--------------------------------------------------|
| txId         | string | The unique identifier of the transaction.        |
| index        | number | The index of the transaction.                    |
| blockHeight  | number | The height of the block in the blockchain.       |
| address      | string | The address associated with the transaction.     |
| value        | number | The value of the transaction.                    |
| status       | string | The status of the transaction (`UNSPENT`. |

#### Example Response:

```json
[
  {
    "txId": "tx123",
    "index": 0,
    "blockHeight": 5,
    "address": "address123",
    "value": 1000,
    "status": "UNSPENT"
  },
  {
    "txId": "tx124",
    "index": 1,
    "blockHeight": 5,
    "address": "address124",
    "value": 500,
    "status": "UNSPENT"
  }
]
```

### **3. POST /blocks**

- **Description**: Submit a new block to the blockchain.
- **Method**: `POST`
- **URL**: `/blocks/async`

#### Body Parameters:
- same as the sync version

### Response body:
- HTTP 202
- empty response

---

# EMURGO Backend Engineer Challenge

This challenge is designed to evaluate your skills with data processing and API development. You will be responsible for creating an indexer that will keep track of the balance of each address in a blockchain.

Please read all instructions bellow carefully.

## Instructions
Fork this repository and make the necessary changes to complete the challenge. Once you are done, simply send your repository link to us and we will review it.

## Setup
This coding challenge uses [Bun](https://bun.sh/) as its runtime. If you are unfamiliar with it, you can follow the instructions on the official website to install it - it works pretty much the same as NodeJS, but has a ton of features that make our life easier, like a built-in test engine and TypeScript compiler.

Strictly speaking, because we run this project on Docker, you don't even need to have Bun installed on your machine. You can run the project using the `docker-compose` command, as described below.

The setup for this coding challenge is quite simple. You need to have `docker` and `docker-compose` installed on your machine. If you don't have them installed, you can follow the instructions on the official docker website to install them.

https://docs.docker.com/engine/install/
https://docs.docker.com/compose/install/

Once you have `docker` and `docker-compose` installed, you can run the following command to start the application:

```bash
docker-compose up -d --build
```

or using `Bun`

```bash
bun run-docker
```

## The Challenge
Your job is to create an indexer that will keep track of the current balance for each address. To do that, you will need to implement the following endpoints:

### `POST /blocks`
This endpoint will receive a JSON object that should match the `Block` type from the following schema:

```ts
Output = {
  address: string;
  value: number;
}

Input = {
  txId: string;
  index: number;
}

Transaction = {
  id: string;
  inputs: Array<Input>
  outputs: Array<Output>
}

Block = {
  id: string;
  height: number;
  transactions: Array<Transaction>;
}
```

Based on the received message you should update the balance of each address accordingly. This endpoint should also run the following validations:
- validate if the `height` is exactly one unit higher than the current height - this also means that the first ever block should have `height = 1`. If it is not, you should return a `400` status code with an appropriate message;
- validate if the sum of the values of the inputs is exactly equal to the sum of the values of the outputs. If it is not, you should return a `400` status code with an appropriate message;
- validate if the `id` of the Block correct. For that, the `id` of the block must be the sha256 hash of the sum of its transaction's ids together with its own height. In other words: `sha256(height + transaction1.id + transaction2.id + ... + transactionN.id)`. If it is not, you should return a `400` status code with an appropriate message;

#### Understanding the Schema
If you are familiar with the UTXO model, you will recognize the schema above. If you are not, here is a brief explanation:
- each transaction is composed of inputs and outputs;
- each input is a reference to an output of a previous transaction;
- each output means a given address **received** a certain amount of value;
- from the above, it follows that each input **spends** a certain amount of value from its original address;
- in summary, the balance of an address is the sum of all the values it received minus the sum of all the values it spent;

### `GET /balance/:address`
This endpoint should return the current balance of the given address. Simple as that.

### `POST /rollback?height=number`
This endpoint should rollback the state of the indexer to the given height. This means that you should undo all the transactions that were added after the given height and recalculate the balance of each address. You can assume the `height` will **never** be more than 2000 blocks from the current height.

## Example
Imagine the following sequence of messages:
```json
{
  height: 1,
  transactions: [{
    id: "tx1",
    inputs: [],
    outputs: [{
      address: "addr1",
      value: 10
    }]
  }]
}
// here we have addr1 with a balance of 10

{
  height: 2,
  transactions: [{
    id: "tx2",
    inputs: [{
      txId: "tx1",
      index: 0
    }],
    outputs: [{
      address: "addr2",
      value: 4
    }, {
      address: "addr3",
      value: 6
    }]
  }]
}
// here we have addr1 with a balance of 0, addr2 with a balance of 4 and addr3 with a balance of 6

{
  height: 3,
  transactions: [{
    id: "tx3",
    inputs: [{
      txId: "tx2",
      index: 1
    }],
    outputs: [{
      address: "addr4",
      value: 2
    }, {
      address: "addr5",
      value: 2
    }, {
      address: "addr6",
      value: 2
    }]
  }]
}
// here we have addr1 with a balance of 0, addr2 with a balance of 4, addr3 with a balance of 0 and addr4, addr5 and addr6 with a balance of 2
```

Then, if you receive the request `POST /rollback?height=2`, you should undo the last transaction which will lead to the state where we have addr1 with a balance of 0, addr2 with a balance of 4 and addr3 with a balance of 6.

## Tests
You should write tests for all the operations described above. Anything you put on the `spec` folder in the format `*.spec.ts` will be run by the test engine.

Here we are evaluating your capacity to understand what should be tested and how. Are you going to create abstractions and mock dependencies? Are you going to test the database layer? Are you going to test the API layer? That's all up to you.

## Further Instructions
- We expect you to handle errors and edge cases. Understanding what these are and how to handle them is part of the challenge;
- We provided you with a setup to run the API and a Postgres database together using Docker, as well as some sample code to test the database connection. You can change this setup to use any other database you'd like;