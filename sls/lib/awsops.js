'use strict';

const AWS = require('aws-sdk');
const uuidV4 = require('uuid/v4');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
const sns = new AWS.SNS();

exports.AwsOps = function () { }

exports.AwsOps.prototype.setAwsResourceNames = function (ddbTableName, snsTopicArn) {
    this.ddbTableName = ddbTableName;
    this.snsTopicArn = snsTopicArn;
}

exports.AwsOps.prototype.ddbInsertRule = function (userId, sgId, rule, ttl) {
    return new Promise(function (resolve, reject) {
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

        console.log('adding new rule: %j', params);

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

exports.AwsOps.prototype.ddbGetCurrentRules = function (userId) {
    return new Promise(function (resolve, reject) {
        let params = {
            TableName: this.ddbTableName,
            FilterExpression: 'user_id = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        dynamodb.scan(params).promise()
        .then(function(result) {
            resolve(result);
        }).catch(function(error) {
            console.log('ddbGetCurrentRules error: %j', error);
            reject(Error(error));
        });
    }.bind(this));
}

exports.AwsOps.prototype.ddbDeleteRule = function (ruleId, userId) {
    return new Promise(function (resolve, reject) {
        var params = {
            TableName: this.ddbTableName,
            Key: {
                id: ruleId,
                user_id: userId
            }
        };

        console.log('delete params: %j', params);

        dynamodb.delete(params).promise()
        .then(function(result) {
            resolve(result);
        }).catch(function(error) {
            console.log('ddbDeleteRule error: %j', error);
            reject(Error(error));
        })
    }.bind(this))
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
            console.log('Adding ingress SG rule failed. Not bubbling up the error. Details: %j', error);
            //reject(Error(error));
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