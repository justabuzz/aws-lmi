'use strict';

const AWS = require('aws-sdk');
const uuidV4 = require('uuid/v4');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
const sns = new AWS.SNS();

exports.AwsOps = function () { }

// exports.AwsOps.prototype.ddbGetSettings = function (userId) {
//     return new Promise(function (resolve, reject) {
//         let params = {
//             TableName: 'lmi_settings',
//             Key: {
//                 user_id: userId
//             }
//         };

//         dynamodb.get(params).promise()
//         .then(function(result) {
//             if (result.Item === undefined) {
//                 reject(Error('Settings not found'));
//             } else {
//                 resolve(result);
//             }
//         })
//         .catch(function(error) {
//             reject(Error(error));
//         })
//     })
// }

exports.AwsOps.prototype.setAwsResourceNames = function (ddbTableName, snsTopicArn) {
    this.ddbTableName = ddbTableName;
    this.snsTopicArn = snsTopicArn;
}

exports.AwsOps.prototype.ddbInsertRule = function (userId, sgId, rule, minutesToLive) {
    return new Promise(function (resolve, reject) {
        let date = new Date();
        let ttl = Math.floor(date.setMinutes(date.getMinutes() + minutesToLive) / 1000);

        let params = {
            TableName: this.ddbTableName,
            Item: {
                id: uuidV4(),
                user_id: userId,
                expiry: ttl,
                sg_id: sgId,
                rule: rule
            }
        };

        dynamodb.put(params).promise()
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            console.log('ddb insert error: %j', error);
            reject(error);
        });
    }.bind(this));
}

exports.AwsOps.prototype.snsPublishMessage = function (userId, subject, message) {
    return new Promise(function (resolve, reject) {
        console.log('sending message: userId %s, subject %s, message %s', userId, subject, message);
        let params = {
            Subject: subject,
            Message: message,
            TopicArn: this.snsTopicArn
        };

        sns.publish(params).promise()
        .then(function(result) {
            resolve(result);
        }).catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.AwsOps.prototype.ec2AddIngressRules = function (sgId, rule) {
    return new Promise(function (resolve, reject) {
        let params = this.constructSgRuleJson(sgId, rule);

        ec2.authorizeSecurityGroupIngress(params).promise()
        .then(function(data) {
            resolve(data);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.AwsOps.prototype.ec2DeleteIngressRules = function (sgId, rule) {
    return new Promise(function (resolve, reject) {
        let params = this.constructSgRuleJson(sgId, rule);

        ec2.revokeSecurityGroupIngress(params).promise()
        .then(function(data) {
            resolve(data);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}


exports.AwsOps.prototype.constructSgRuleJson = function (sgId, rule) {
    let json = {
        GroupId: sgId,
        IpPermissions: []
    };

    rule.ports.forEach(function(p) {
        json.IpPermissions.push({
            IpProtocol: 'tcp',
            FromPort: p.from,
            ToPort: p.to,
            IpRanges: [ { CidrIp: rule.ip + '/32' } ]
        });
    });

    return json;
}