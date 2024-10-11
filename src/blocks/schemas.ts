export const balanceRequestSchema = {
  params: {
    type: 'object',
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
} as const;

export const rollbackRequestSchema = {
  querystring: {
    type: 'object',
    properties: {
      height: { type: 'integer', minimum: 0 },
    },
    required: ['height'],
  }
} as const;

export const newBlockRequestSchema = {
  body: {
    type: 'object',
    required: ['id', 'height', 'transactions'],
    properties: {
      id: { type: 'string' },
      height: { type: 'integer', minimum: 0 },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'inputs', 'outputs'],
          properties: {
            id: { type: 'string' },
            inputs: {
              type: 'array',
              items: {
                type: 'object',
                required: ['txId', 'index'],
                properties: {
                  txId: { type: 'string' },
                  index: { type: 'integer', minimum: 0 }
                }
              }
            },
            outputs: {
              type: 'array',
              items: {
                type: 'object',
                required: ['address', 'value'],
                properties: {
                  address: { type: 'string' },
                  value: { type: 'integer', minimum: 0 }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
