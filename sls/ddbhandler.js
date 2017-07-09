'use strict';

const Utilities = require('./lib/utilities').Utilities;
const utils = new Utilities(
  process.env.LMI_NAME,
  process.env.IS_LOCAL ? 'lmi_rule' : process.env.TABLE_NAME,
  process.env.IS_LOCAL ? '<<TEST SNS TOPIC>>' : process.env.TOPIC_ARN);

module.exports.handler = (event, context, callback) => {
  console.log('Processing event: %j', event)

  utils.processDdbStream(event).
  then(function(result) {
    console.log('Success result: %j', result);
    callback(null, result);
  })
  .catch(function(error) {
    console.log('Error result: %j', error);
    callback(error, null);
  });
};
