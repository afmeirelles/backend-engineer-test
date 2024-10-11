import server from './server'
import configs from '../configs'
import { bootstrap } from './_shared/postgresClient'
import { setupQueue } from './_shared/queueClient'

bootstrap(configs.databaseUrl)
  .then(() => setupQueue())
  .then(() => server(configs))