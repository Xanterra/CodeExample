const lambdaLocal = require('lambda-local')
const path = require('path')
const func = require(path.join(__dirname, 'index.js'))

const testInput = {
  body: {
    Name: "Joe Schmo's testing claim"
  },
  number: 33
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
