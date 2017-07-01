const {
  CognitoUser,
  CognitoUserPool
} = window.AWSCognito.CognitoIdentityServiceProvider;

export let cognitoUser = null;
let cognitoIdJwtToken = null;

window.AWSCognito.config.region = window.COGNITO_REGION;

const userPool = new CognitoUserPool({
  UserPoolId: window.COGNITO_USER_POOL_ID,
  ClientId: window.COGNITO_USER_POOL_CLIENT_ID
});

// log user out
export function signout() {
  if (null === cognitoUser) {
    return;
  }

  cognitoUser.signOut();
  cognitoUser = null;
  cognitoIdJwtToken = null;
}

// authenticate user, and also ask for MFA or verification code, if needed
export function signin(username, password) {
  return new Promise((resolve, reject) => {
    let authenticationData = {
      Username: username,
      Password: password,
    };

    let authenticationDetails = new window.AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);

    let userData = {
      Username: username,
      Pool: userPool
    };

    cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (session) {
        //console.log('authenticateUser: result:\n' + JSON.stringify(session))
        //console.log(session)
        Promise.all([
          getUserInfo(cognitoUser),
          doRefreshCredentials(session)]).then((values) => {
          resolve(values[0])
        }, reason => {
          reject(reason)
        });
      },
      onFailure: reject,
      newPasswordRequired: function(userAttributes, requiredAttributes) {
            // User was signed up by an admin and must provide new
            // password and required attributes, if any, to complete
            // authentication.

            //for simplicity I will just pass the current password to get away from collecting new password

            // the api doesn't accept these fields back
            delete userAttributes.email_verified;
            delete userAttributes.phone_number_verified;

            // Get these details and call
            cognitoUser.completeNewPasswordChallenge(password, userAttributes, this);
        }
    })
  })
}

function getUserInfo(cognitoUser) {
  return new Promise((resolve, reject) => {
    cognitoUser.getUserAttributes(function (err, result) {
      if (err) {
        reject(err);
      }

      let user = {};

      for (let i = 0; i < result.length; i++) {
        user[result[i].getName()] = result[i].getValue();
      }

      resolve(user);
    });
  })

}


export function updateUserInfo(user) {
  console.log('enter');
  if (cognitoUser === null) {
    console.log('User is null');
    return;
  }

  let attrs = [];
  let attr = {
    Name: 'locale',
    Value: user.locale
  };

  let congitoAttr = new window.AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(attr);
  attrs.push(congitoAttr);

  console.log(cognitoUser)

  cognitoUser.updateAttributes(attrs, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });

}

export function hasCognitoUser() {
  return cognitoUser !== null;
}

export function refreshCredentials() {
  if (cognitoUser === null) {
    cognitoUser = userPool.getCurrentUser();
  }

  return new Promise((resolve, reject) => {
    if (cognitoUser === null) {
      reject('No session data');
    }

    cognitoUser.getSession(function (err, session) {
      if (err) {
        reject(err);
      }

      Promise.all([
        getUserInfo(cognitoUser),
        doRefreshCredentials(session)]).then(values => {
        console.log('refreshCredentials - leave')
        resolve(values[0])
      }, reason => {
        reject(reason)
      });
    })
  })

}

export function getIdJwtToken() {
  return cognitoIdJwtToken;
}

function doRefreshCredentials(session) {
  return new Promise((resolve, reject) => {
    if (!session || !session.isValid()) {
      reject('invalid session');
    }

    // console.log('access token + ' + session.getAccessToken().getJwtToken())
    // console.log('id token + ' + session.getIdToken().getJwtToken())

    cognitoIdJwtToken = session.getIdToken().getJwtToken();
    resolve();
  })
}