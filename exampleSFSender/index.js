const axois = require('axios')
const fs = require('fs')
const aws = require('aws-sdk')
aws.config.update({ region: 'us-east-1' })
const sqs = new aws.SQS({ apiVersion: '2012-11-05' })

/*
If this was a service we actually wanted to integrate with rather than just a POC, would look into the below as it's likely that claims would have multiple records so performance-wise this would be a good move.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections_upsert.htm
*/

module.exports.handler = async (eventFromSQS, context) => {
  console.info(JSON.stringify(eventFromSQS))// don't need to do as much error checking here as this is not coming from an untrusted source
  const firstRecord = eventFromSQS.Records[0]// if we were doing batching we'd want to handle that but we're not
  const claimBodyToSend = firstRecord.body
  const claimNumber = firstRecord.messageAttributes.ClaimNumber.stringValue
  const receiptHandle = firstRecord.receiptHandle

  let userConfig = null
  try {
    const rawConfigData = fs.readFileSync('user_config.json')// realistically, you'd be storing and accessing this in a more secure fashion, but this is just a POC so this should do for now
    userConfig = JSON.parse(rawConfigData)
  } catch (ex) {
    console.error(ex)
    return 'Error accessing config'
  }
  const accessToken = await getSFToken(userConfig.sf_instance_name, userConfig.client_id, userConfig.client_secret, userConfig.username, userConfig.password, userConfig.security_token)
  const claimResults = await upsertClaim(userConfig.sf_instance_name, claimBodyToSend, claimNumber, accessToken)
  await deleteMessageSQS(receiptHandle, userConfig.queue_url, sqs)// we don't currently use the response from this function but that easily could change
  return claimResults
}

async function getSFToken (sfInstanceName, clientId, clientSecret, username, password, securityToken) {
  try { // for this and other SF functions, could mock SF's API for more modularity/to avoid accidentally integration testing
    const response = await axois.post('https://' + sfInstanceName + '/services/oauth2/token', 'grant_type=password&client_id=' + clientId + '&client_secret=' + clientSecret + '&username=' + username + '&password=' + password + securityToken)
    if (!response.data.access_token) throw new Error('Error getting token from SF')
    return response.data.access_token
  } catch (error) {
    console.error(error)
    throw new Error('Error getting token from SF')// we want to stop if this happens
  }
}

async function upsertClaim (sfInstanceName, claimBody, claimNumber, accessToken) {
  try {
    const axiosConfig = {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      }
    }
    const response = await axois.post('https://' + sfInstanceName + '/services/data/v50.0/sobjects/Claim__c/Claim_Number__c/' + claimNumber + '?_HttpMethod=PATCH', claimBody, axiosConfig)
    // could verify more about it and use that for future logic such as doing different things based upon whether it was a new insert or an update
    if (!response.data.success || response.data.success !== true) {
      console.error(response)
      throw new Error('Error upserting to Salesforce')// we don't want to delete if this happens
    } else {
      return response.data
    }
  } catch (ex) {
    console.error(ex)
    throw new Error('Error upserting to Salesforce')// we don't want to delete if this happens
  }
}

async function deleteMessageSQS (receiptHandle, queueUrl, sqsToUse) { // will fail if this is run in dev/test because the message doesn't exist
  try {
    const params = {
      ReceiptHandle: receiptHandle,
      QueueUrl: queueUrl
    }
    const response = await sqsToUse.deleteMessage(params).promise()// could do more here to verify the delete hasn't failed but this is fine for a POC/sample
    // if the delete fails, that just means it'll be upserted again which is fine as discussed in the other file (and if somehow this fails ten times, will proceed to the dead letter queue which isn't the end of the world)
    return response
  } catch (ex) {
    console.error(ex)
    return 'Error deleting from SQS or the message doesnt exist'
  }
}
console.info(process.env.NODE_ENV)
if (process.env.NODE_ENV === 'test') {
  console.log('Exporting additional stuff as this ia a test environment')
  module.exports.deleteMessageSQS = deleteMessageSQS
  module.exports.getSFToken = getSFToken
  module.exports.upsertClaim = upsertClaim
}
