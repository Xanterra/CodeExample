/* eslint-disable no-undef */
const assert = require('chai').assert
process.env.NODE_ENV = 'test'
const main = require('../index')
const aws = require('aws-sdk')
const _ = require('lodash')
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
  body: {
    Name: "Joe Schmo's testing claim"
  },
  number: 33
}
const expectedArgumentForSQSSendMessage =
{
  DelaySeconds: 10,
  MessageAttributes: {
    Timestamp: {
      DataType: 'String',
      StringValue: '2021-01-25T23:23:46.375Z'
    },
    ClaimNumber: {
      DataType: 'Number',
      StringValue: '33'
    }
  },
  MessageBody: '{"Name":"Joe Schmo\'s testing claim"}',
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/632522679498/defaultQueue'
}

describe('The API Gateway Receiver', async function () {
  beforeEach(async function () {
  })
  afterEach(async function () {
    sandbox.restore()
    if (fs.existsSync(baseDir + '/local_config_moved.json')) {
      await rename(path.format(path.parse(baseDir + '/local_config_moved.json')), path.format(path.parse(baseDir + '/local_config.json')))
    }
  })
  describe('When called with proper arguments', async function () {
    it('Should give a correct response', async function () {
      SQSSpy = sandbox.spy(sqs)
      await main.sendMessageSQS(testInput, 'https://sqs.us-east-1.amazonaws.com/632522679498/defaultQueue', SQSSpy)
      const actualArgumentForCall = await SQSSpy.sendMessage.getCall(0).args[0]
      const paramsToTest = ['DelaySeconds', 'MessageBody', 'QueueUrl', 'MessageAttributes.Timestamp.DataType', 'MessageAttributes.ClaimNumber.DataType', 'MessageAttributes.ClaimNumber.StringValue']
      assertEqualPartialObjectArray(paramsToTest, expectedArgumentForSQSSendMessage, actualArgumentForCall)
      // we can't just assert the two objects directly as the timestamps will differ
    })
  })
  describe('When called with incorrect arguments', async function () {
    it('Should properly handle non-JSON input', async function () {
      const response = await runThisLambdaLocally('}' + JSON.stringify(testInput) + 22)
      assert.equal(response, 'You passed an event that is not proper JSON or lacks a body or claim number')
    })
    it('Should properly handle incomplete input', async function () {
      const response = await runThisLambdaLocally({ notWhatWereLookingFor: 'ValueHere' })
      assert.equal(response, 'You passed an event that is not proper JSON or lacks a body or claim number')
    })
    it('Should properly handle issues with accessing config', async function () {
      await rename(path.format(path.parse(baseDir + '/local_config.json')), path.format(path.parse(baseDir + '/local_config_moved.json')))
      const response = await runThisLambdaLocally(testInput)
      assert.equal(response, 'Error accessing config')
    })
    it('Should properly handle SQS errors', async function () {
      const response = await main.sendMessageSQS(testInput, 'httpss://sqs.us-east-1.amazonaws.com/632522679498/defaultQueue', sqs)
      assert.equal(response, 'Error calling SQS')
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
function assertEqualPartialObjectArray (argNames, expected, actual) {
  argNames.forEach(element => assertEqualPartialObject(element, expected, actual))
};
function assertEqualPartialObject (argName, expected, actual) { // we use lodash rather than bracket notation so this can be more general
  assert.equal(_.get(expected, argName), _.get(actual, argName), 'Should pass correct parameters')
};
