const lambdaLocal = require('lambda-local')
const path = require('path')
const func = require(path.join(__dirname, 'index.js'))

const testInput = {
  Records:
[{
  messageId: 'f49f588b-a977-4e90-aeae-be56b7511653',
  receiptHandle:
'AQEBunZMRnKDj1uDVeQWwD3bI6562nn3+bUD7hH1lI3vlEA5jdPtO3+OE7sRYDv3QqmMypj9FyMsMcftv2XGlRJTXnUEDK1y3PiT77pSHTuv0V+6Nb4/WtUsqXp/khE4L9DU7pfUpiWGz6SHfSaln4R3GyGP2MB8EsQceY/oK7ANOnxV+ZUvSUK+0gvOLdNQq6CSfL5ooj+3W0/sv/cIP6A0NvEL81vUNJbvkRqWBw+5EEXlAzbt+aky7Co6Rb0Jh4ErHvK+pDl1Z5kHH7HFuh8AUP9u5FEYC6OHqnNJzj9PqgK6I1flrf1qCzSYgwRxKg2zGfeMMcMsP47wEac5ST8R+GfA13lrz3Zf0n/D3wE9pZRnFgFRfWyShIIuTjSMT95z',
  body: '{"Name":"Joe Schmo\'s testing claim"}',
  attributes:
{
  ApproximateReceiveCount: '1',
  SentTimestamp: '1611454350825',
  SenderId: 'AIDAZGRKKETFCQMFNZIDW',
  ApproximateFirstReceiveTimestamp: '1611454360825'
},
  messageAttributes:
{
  ClaimNumber:
    {
      stringValue: '33',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'Number'
    },
  Timestamp:
    {
      stringValue: '2021-01-24T02:12:31.199Z',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'String'
    }
},
  md5OfMessageAttributes: '692666fb55db526f2decc6597e50da14',
  md5OfBody: '2d88c8f352e3e81f672e2a5ba45a49fb',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:us-east-1:632522679498:defaultQueue',
  awsRegion: 'us-east-1'
}]
}

runLocally()

async function runLocally () {
  const result = await lambdaLocal.execute({
    event: testInput,
    lambdaFunc: func,
    timeoutMs: 30000 * 100,
    envfile: 'local_envs.env',
    envdestroy: true
  })
  console.log(result)
};
