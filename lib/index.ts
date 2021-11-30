import { MongoClient } from 'mongodb'
import { Writable } from 'stream'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const build = require('pino-abstract-transport')

function normalize (chunk: any): any {
  chunk = chunk.toString().replace(/\$/g, '\uFF04')
  // chunk = chunk.replace(/\./g, '\uFF0E')
  return JSON.parse(chunk)
}

export interface MongoDBTransportOption {
  connectionString: string
  databaseName: string
  collectionName: string
  resetOnStartup?: boolean
}

export default async function (options: MongoDBTransportOption): Promise<Writable> {
  const client = new MongoClient(options.connectionString)
  await client.connect()
  const isExist = await client.db(options.databaseName).listCollections({ name: options.collectionName }).toArray()
  const controller = client.db(options.databaseName).collection(options.collectionName)
  if (options.resetOnStartup === true && isExist.length > 0) await controller.drop()

  const writer = new Writable({
    objectMode: true,
    autoDestroy: true,
    write (chunk, _, callback) {
      controller.insertOne(chunk, callback)
    },
    destroy (error, callback) {
      client.close().finally(function () {})
      // TODO: callback should be inside client.close
      callback(error)
    }
  })

  return build(function (source: any) {
    source.pipe(writer)
  }, {
    parseLine: normalize,
    close (err: Error, cb: Function) {
      writer.end()
      writer.once('close', cb.bind(null, err))
    }
  })
}
