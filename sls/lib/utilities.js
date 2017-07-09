'use strict';

const util = require('util');

const AwsOps = require('./awsops').AwsOps;
const awsops = new AwsOps();

exports.Utilities = function (lmiName, ddbTblName, snsTopicName, minsToLiveCap) {
    this.minsToLiveCap = minsToLiveCap;
    this.lmiName = lmiName;
    awsops.setAwsResourceNames(ddbTblName, snsTopicName);
}

exports.Utilities.prototype.addNewSgRule = function (userId, sgId, rule, minutesToLive) {
    return new Promise(function (resolve, reject) {
        if (minutesToLive < 1)
            minutesToLive = 1;
        else if (minutesToLive > this.minsToLiveCap)
            minutesToLive = this.minsToLiveCap;
        
        if (!validateIpAddress(rule.ip))
            reject('Invalid IP address');

        awsops.ddbInsertRule(userId, sgId, rule, calculateTtl(minutesToLive))
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            console.log('ddb insert error: %j', error);
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.updateSgRulesIp = function (userId, newIp) {
    return new Promise(function (resolve, reject) {
        this.getCurrentRules(userId)
        .then(function(rules) {
            let promises = [];
            rules.forEach(function(r) {
                let p = new Promise(function(resolve, reject) {
                    r.rule.ip = newIp;
                    awsops.ddbDeleteRule(r.id, r.user_id)
                    .then(function(result) {
                        return awsops.ddbInsertRule(userId, r.sg_id, r.rule, r.expiry)
                    })
                    .then(function(result) {
                        resolve(result);
                    })
                    .catch(function(error) {
                        console.log('update IP del rule error: %j', error);
                        reject(Error(error));
                    });
                });

                promises.push(p);
            });
            
            Promise.all(promises)
            .then(function(result) {
                resolve({ updateCount: rules.length });
            })
            .catch(function(error) {
                console.log('update IP resolve promise array error: %s', error);
                reject(Error(error));
            });
        })
        .catch(function(error) {
            console.log(JSON.stringify(error));
            console.log('update IP error: %j', error);
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.getCurrentRules = function (userId) {
    return new Promise(function (resolve, reject) {
        awsops.ddbGetCurrentRules(userId)
        .then(function(result) {
            resolve(result.Items);
        })
        .catch(function(error) {
            console.log(JSON.stringify(error));
            console.log('getCurrentRules error: %j', error);
            reject(Error(error));
        });
    });
}

exports.Utilities.prototype.deleteRule = function (ruleId, userId) {
    return new Promise(function (resolve, reject) {
        return awsops.ddbDeleteRule(ruleId, userId)
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            console.log('deleteRule error: %j', error);
            reject(Error(error));
        });
    });
}

exports.Utilities.prototype.processDdbStream = function (stream) {
    return new Promise(function (resolve, reject) {
        let promises = [];
        stream.Records.forEach(function(record) {
            if (record.eventName === 'INSERT') {
                promises.push(this.sgRuleAdded(record));
            } else if (record.eventName === 'REMOVE') {
                promises.push(this.sgRuleExpired(record));
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

exports.Utilities.prototype.sgRuleAdded = function (ddbRecord) {
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
            return awsops.snsPublishMessage(userId,
                    util.format('LMI - %s - new rule added', this.lmiName),
                    util.format('Expiry: %s; SG ID: %s, rule: %j', expiry, sgId, rule));
        }.bind(this))
        .then(function(result) {
            resolve(result);
        })
        .catch(function(error) {
            reject(Error(error));
        });
    }.bind(this));
}

exports.Utilities.prototype.sgRuleExpired = function (ddbRecord) {
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
            return awsops.snsPublishMessage(userId,
                    util.format('LMI - %s - rule removed', this.lmiName),
                    util.format('SG ID: %s, rule: %j', sgId, rule));
        }.bind(this))
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

function calculateTtl(minutesToLive) {
    let date = new Date();
    return Math.floor(date.setMinutes(date.getMinutes() + minutesToLive) / 1000);
}