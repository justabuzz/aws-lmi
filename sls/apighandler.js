'use strict';

const Utilities = require('./lib/utilities').Utilities;
const utils = new Utilities(
  process.env.IS_LOCAL ? 'lmi_rule' : process.env.TABLE_NAME,
  process.env.IS_LOCAL ? 'arn:aws:sns:ap-southeast-2:190027191216:test' : process.env.TOPIC_ARN);

module.exports.handler = (event, context, callback) => {
  console.log('processing event: %j', event);
  
  utils.addNewRule(event.userId, process.env.SG_ID, event.rule, event.minutesToLive).
  then(function(result) {
    console.log(result);
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'LMI worked',
        result: result,
      }),
    };

    callback(null, response);
  })
  .catch(function(error) {
    console.log('error: %j', error);
    const response = {
      statusCode: 500,
      body: JSON.stringify({
        message: 'LMI failed',
        error: error,
      }),
    };

    callback(response, null);
  });

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
