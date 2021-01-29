/* eslint-disable no-undef */
const assert = require('chai').assert
process.env.NODE_ENV = 'test'
const main = require('../index')
const aws = require('aws-sdk')
const sinon = require('sinon')
const lambdaLocal = require('lambda-local')
const fs = require('fs')
const path = require('path')
const util = require('util')
const rename = util.promisify(fs.rename)
const baseDir = path.resolve(__dirname, '..')
const func = require(path.join(baseDir, 'index.js'))

aws.config.update({ region: 'us-east-1' })
const sqs = new aws.SQS({ apiVersion: '2012-11-05' })
const sandbox = sinon.createSandbox()

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

userConfig = JSON.parse(fs.readFileSync('user_config.json'))
let accessToken = null

describe('The Salesforce Sender', async function () {
  beforeEach(async function () {
  })
  afterEach(async function () {
    sandbox.restore()
    if (fs.existsSync(baseDir + '/user_config_moved.json')) {
      await rename(path.format(path.parse(baseDir + '/user_config_moved.json')), path.format(path.parse(baseDir + '/user_config.json')))
    }
  })
  describe('When called with proper arguments', async function () {
    it('Should properly acquire the token', async function () {
      accessToken = await main.getSFToken(userConfig.sf_instance_name, userConfig.client_id, userConfig.client_secret, userConfig.username, userConfig.password, userConfig.security_token)
      assert.exists(accessToken)
    })
    it('Should properly upsert a record to SF', async function () { // this could do a read as well to verify it was correctly done, but - again - this is a brief code sample (and that's getting into integration testing rather than unit testing)
      const response = await main.upsertClaim(userConfig.sf_instance_name, testInput.Records[0].body, 33, accessToken)
      assert.equal(true, response.success)
    })
    it('Should attempt to upsert to SQS with the proper args', async function () {
      const expectedResult = {
        ReceiptHandle: testInput.Records[0].receiptHandle + 'false',
        QueueUrl: userConfig.queue_url
      }
      const SQSSpy = sandbox.spy(sqs)
      const returnedValue = await main.deleteMessageSQS(testInput.Records[0].receiptHandle + 'false', 'https://sqs.us-east-1.amazonaws.com/632522679498/defaultQueue', SQSSpy)
      const actualArgumentForCall = await SQSSpy.deleteMessage.getCall(0).args[0]
      assert.equal(JSON.stringify(expectedResult), JSON.stringify(actualArgumentForCall))
      assert.equal('Error deleting from SQS or the message doesnt exist', returnedValue)
      /* This should always blow up as we don't add a message to the queue prior to calling this and give it a bogus receipt handle.
      You could probably verify this properly by programatically disabling the lambda trigger (so it isn't removed before your next test runs),
      manually sending a message to the queue, and then calling this (for bonus points could also poll the queue after)
      before reenabling the lambda trigger. Or perhaps have a version of all of this that only exists for testing
      that has the lambda trigger disabled. (though for integration tests you'd absolutely want to make a version with the trigger)
      */
    })
  })
  describe('When called with incorrect arguments', async function () {
    it('Should properly handle issues with accessing config', async function () {
      await rename(path.format(path.parse(baseDir + '/user_config.json')), path.format(path.parse(baseDir + '/user_config_moved.json')))
      const response = await runThisLambdaLocally(testInput)
      assert.equal(response, 'Error accessing config')
    })
    it('Should properly handle SQS errors', async function () {
      const response = await main.deleteMessageSQS('AQEBunZMRnKDj1uDVeQWwD3bI6562nn3+bUD7hH1lI3vlEA5jdPtO3+OE7sRYDv3QqmMypj9FyMsMcftv2XGlRJTXnUEDK1y3PiT77pSHTuv0V+6Nb4/WtUsqXp/khE4L9DU7pfUpiWGz6SHfSaln4R3GyGP2MB8EsQceY/oK7ANOnxV+ZUvSUK+0gvOLdNQq6CSfL5ooj+3W0/sv/cIP6A0NvEL81vUNJbvkRqWBw+5EEXlAzbt+aky7Co6Rb0Jh4ErHvK+pDl1Z5kHH7HFuh8AUP9u5FEYC6OHqnNJzj9PqgK6I1flrf1qCzSYgwRxKg2zGfeMMcMsP47wEac5ST8R+GfA13lrz3Zf0n/D3wE9pZRnFgFRfWyShIIuTjSMT95z', 'httpss://sqs.us-east-1.amazonaws.com/632522679498/defaultQueue')
      assert.equal(response, 'Error deleting from SQS or the message doesnt exist')
    })
    it('Should properly blow up if it fails to acquire a token', async function () {
      try { // if this was used more than two places, modularize
        await main.getSFToken(userConfig.sf_instance_name, userConfig.client_id + 1, userConfig.client_secret, userConfig.username, userConfig.password, userConfig.security_token)
        assert.fail('Error was not thrown') // shouldn't run unless an error is not thrown
      } catch (e) {
        assert(e.message.includes('Error getting token from SF'))
      }
    })
    it('Should properly handle a failure in upserting a record to SF', async function () {
      try {
        await await main.upsertClaim(userConfig.sf_instance_name, testInput.Records[0].body, 33, '1')
        assert.fail('Error was not thrown') // shouldn't run unless an error is not thrown
      } catch (e) {
        assert(e.message.includes('Error upserting to Salesforce'))
      }
    })
  })
})

async function runThisLambdaLocally (testInput) { // there's potential for extraction of commonly used configs to a utility if this was used in more than two tests
  return await lambdaLocal.execute({
    event: testInput,
    lambdaFunc: func,
    timeoutMs: 30000 * 100, // could be a param if you wanted to tweak per test
    envfile: 'local_envs.env',
    envdestroy: true
  })
};
