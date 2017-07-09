'use strict';

const Utilities = require('./lib/utilities').Utilities;
const utils = new Utilities(
  process.env.LMI_NAME,
  process.env.IS_LOCAL ? 'lmi_rule' : process.env.TABLE_NAME,
  process.env.IS_LOCAL ? '<<TEST SNS TOPIC>>' : process.env.TOPIC_ARN,
  process.env.MINS_TO_LIVE_CAP);

module.exports.handler = (event, context, callback) => {
  console.log('processing event: %j', event);

  let promise = undefined;
  if (event.rule) {
    promise = utils.addNewSgRule(event.userId, process.env.SG_ID, event.rule, event.minutesToLive);
  } else if (event.newIp) {
    promise = utils.updateSgRulesIp(event.userId, event.newIp);
  } else if (event.action === 'get-rules') {
    promise = utils.getCurrentRules(event.userId);
  } else if (event.action === 'delete-rule') {
    promise = utils.deleteRule(event.ruleId, event.userId);
  }
  
  if (promise === undefined) {
    const response = {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Bad Request',
      }),
    };

    callback(response, null);
  } else {
    promise.
    then(function(result) {
      console.log(result);
      const response = {
        statusCode: 200,
        body: JSON.stringify({
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
          error: error,
        }),
      };

      callback(response, null);
    });
  }
};
