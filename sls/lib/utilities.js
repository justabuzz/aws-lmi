'use strict';

const util = require('util');

const AwsOps = require('./awsops').AwsOps;
const awsops = new AwsOps();

exports.Utilities = function (ddbTblName, snsTopicName) {
    awsops.setAwsResourceNames(ddbTblName, snsTopicName);
}

exports.Utilities.prototype.addNewRule = function (userId, sgId, rule, minutesToLive) {
    return new Promise(function (resolve, reject) {
        if (minutesToLive < 1)
            minutesToLive = 1;
        else if (minutesToLive > 30)
            minutesToLive = 30;
        
        if (!validateIpAddress(rule.ip))
            reject('Invalid IP address');

        awsops.ddbInsertRule(userId, sgId, rule, minutesToLive)
        .then(function(result) {
            console.log('ddb insert result: %j', result);
            resolve(result);
        })
        .catch(function(error) {
            console.log('ddb insert error: %j', error);
            reject(Error(error));
        });
    });
}

exports.Utilities.prototype.processDdbStream = function (stream) {
    return new Promise(function (resolve, reject) {
        let promises = [];
        stream.Records.forEach(function(record) {
            if (record.eventName === 'INSERT') {
                promises.push(this.ruleAdded(record));
            } else if (record.eventName === 'REMOVE') {
                promises.push(this.ruleExpired(record));
            }
        }.bind(this));

        Promise.all(promises)
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.ruleAdded = function (ddbRecord) {
    return new Promise(function (resolve, reject) {
        let image = ddbRecord.dynamodb.NewImage;
        let rule = this.constructRuleFromStreamImage(image);
        let sgId = image.sg_id.S;
        let expiry = (new Date(0)).setUTCSeconds(image.expiry.N);
        let userId = image.user_id.S;

        awsops.ec2AddIngressRules(sgId, rule)
        .then(function(result) {
            return result;
        })
        .then(function(result) {
            return awsops.snsPublishMessage(userId, 'LMI - new rule added', util.format('Expiry: %s; SG ID: %s, rule: %j', expiry, sgId, rule));
        })
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.ruleExpired = function (ddbRecord) {
    return new Promise(function (resolve, reject) {
        let image = ddbRecord.dynamodb.OldImage;
        let rule = this.constructRuleFromStreamImage(image);
        let sgId = image.sg_id.S;
        let expiry = (new Date(0)).setUTCSeconds(image.expiry.N);
        let userId = image.user_id.S;

        awsops.ec2DeleteIngressRules(sgId, rule)
        .then(function(result) {
            return result;
        })
        .then(function(result) {
            return awsops.snsPublishMessage(userId, 'LMI - rule removed', util.format('SG ID: %s, rule: %j', sgId, rule));
        })
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.constructRuleFromStreamImage = function (image) {
    let rule = {
      ip: image.rule.M.ip.S,
      ports: []
    };

    image.rule.M.ports.L.forEach(function(p) {
        rule.ports.push({ from: p.M.from.N, to: p.M.to.N });
    });

    return rule;
}

function validateIpAddress(ip) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}