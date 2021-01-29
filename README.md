# CodeExample
This is essentially a lightweight POC of an enterprise (in this case Salesforce) integration that is highly scalable and intermittent-fault-tolerant (of intermittent errors by the API being integrated with). The first Lambda is called by API Gateway, and it sends a message to SQS with the relevant info, triggering the second lambda, which performs an upsert and then deletes the message if successful. 
If not, after the visibility timeout expires (to prevent expending all retries if, say, the SF instance's API stops responding for 30 seconds or so), it will be retried automatically until it hits the configured maximum number of retries, at which point the message will be sent to a dead letter queue, which could easily be hooked up to a lambda to send an email to the user informing them that their update was not successful.

You can sample this working by calling the route specified in the Postman collection set up as it does (you'll need an API key, just ask).

To see the result, ask for a login to my dev Salesforce environment.

To run the tests, simply populate the two config JSON files with appropriate data - I can provide versions or the config info.

If you have any questions about how AWS is configured or would like to use my instance to test (the tests won't run properly without access to AWS), I'd be happy to help, and please let me know if you run into any issues.

I have this configured to use a standard queue.
At least once delivery isn't really a problem here as on the SF side, we do an upsert and updating it with the same data multiple times isn't a problem. However, potentially out of order messages *if* the API calls are made frequently, such as a user making multiple updates to the same claim, could result in the last one being executed (and hence, the final SF state) *not* being the last one input, so we'd want to either handle that in code with something like a sequence counter (messy re parallelism), orsimply switch to a FIFO queue.
Depending upon our application, the limitation of 300 transactions per second per send/receive/delete could become a problem. If this was something I was implementing for a client, we'd need to discuss whether the above problem re ordering of the throughput constraint was a bigger deal.

Depending upon performance impact vs simplicity tradeoff decisions, adding code to handle hot starts and avoid re-initializing this like you might do for a DB connection would be worth considering.

If this was a service we actually wanted to integrate with rather than just a POC, would look into the below as it's likely that claims would have multiple records so performance-wise this would be a good move.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections_upsert.htm