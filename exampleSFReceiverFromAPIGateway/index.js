const fs = require('fs')
const aws = require('aws-sdk')// in Lambda, AWS credentials will automatically be loaded from IAM
aws.config.update({ region: 'us-east-1' })
const sqs = new aws.SQS({ apiVersion: '2012-11-05' })
/* Depending upon performance impact vs simplicity tradeoff decisions, adding code to handle hot starts and avoid re-initializing this
 like you might do for a DB connection would be worth considering. */

module.exports.handler = async (eventThatShouldBeAClaim) => {
  let queueUrl = null
  try {
    const stringifiedEvent = JSON.stringify(eventThatShouldBeAClaim)
    console.log('Incoming Event' + stringifiedEvent)
    const result = JSON.parse(stringifiedEvent)// if the performance tradeoff is judged worth less clarity, this whole try/catch could be removed.
    if (!result.body || !result.number) return 'You passed an event that is not proper JSON or lacks a body or claim number'
  } catch (ex) {
    console.error(ex)
    return 'You passed an event that is not proper JSON or lacks a body or claim number'
  }
  try {
    const rawConfigData = fs.readFileSync('local_config.json')// realistically, you'd be storing and accessing this in a more secure fashion, but this is just a POC so this should do for now
    const localConfig = JSON.parse(rawConfigData)
    queueUrl = localConfig.queue_url
  } catch (ex) {
    return 'Error accessing config'
  }
  const resultOfSendingToSQS = await sendMessageSQS(eventThatShouldBeAClaim, queueUrl, sqs)
  return resultOfSendingToSQS
}

async function sendMessageSQS (claimToSend, queueUrl, sqsProvided) {
  let result = 'Failed to send'; let messageBody = null; let claimNumber = null; let timestamp = null

  try {
    messageBody = JSON.stringify(claimToSend.body)
    claimNumber = claimToSend.number.toString()
    timestamp = new Date().toISOString()
  } catch (ex) {
    console.error(ex)// don't want to put bad calls in the queue. It should usually blow up before this though
    return ('Error populating SQS parameters')
  }

  const params = {
    // Remove DelaySeconds and add MessageDeduplicationId + MessageGroupId if FIFO
    DelaySeconds: 10,
    MessageAttributes: {
      Timestamp: { // this would be used in the (not implemented) third lambda to handle the dead letter queue and send emailed failure notifications
        DataType: 'String',
        StringValue: timestamp
      },
      ClaimNumber: {
        DataType: 'Number',
        StringValue: claimNumber
      }
    },
    MessageBody: messageBody,
    QueueUrl: queueUrl
  }

  try {
    const response = await sqsProvided.sendMessage(params).promise()
    /* I have this configured to use a standard queue.
    At least once delivery isn't really a problem here as on the SF side,
    we do an upsert and updating it with the same data multiple times isn't a problem.
    However, potentially out of order messages *if* the API calls are
    made frequently, such as a user making multiple updates to the same claim,
    could result in the last one being executed (and hence, the final SF state)
    *not* being the last one input, so we'd want to either handle that in code
    with something like a sequence counter (messy re parallelism), or
    simply switch to a FIFO queue. Depending upon our application, the limitation
    of 300 transactions per second per send/receive/delete could become a problem.
    If this was something I was implementing for a client, we'd need to discuss
    whether the above problem re ordering or the throughput constraint was a bigger
    deal.
    */
    if (response.ResponseMetadata.RequestId) result = 'Sent to queue'
    return result
  } catch (ex) { // Could do more to handle specific failures, but for a code sample, this will do.
    console.error(ex)
    return 'Error calling SQS'
  }
}
if (process.env.NODE_ENV === 'test') {
  console.log('Exporting additional stuff as this ia a test environment')
  module.exports.sendMessageSQS = sendMessageSQS
}
