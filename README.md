## Synopsis

LMI is a serverless project to be deployed on AWS. It provides a quick way to add temporary rules to Security Groups, by accessing a simple web app, specifying an IP address, port range and number of minutes to keep the rule on. Read all about it in my post here: https://medium.com/@onclouds/accessing-your-aws-ec2-instances-on-the-go-3122ba46d853

## Motivation

It happened to me a few times that I had to open ports to IPs to allow access to EC2 instances while on the go (either for me, or for my developers). It is never a quick thing to open the necessary ports for your IP. This solution, which is comprised of a client web app (React) and a serverless solution for the backend, makes it easy and quick.

## Installation

I assume you already have AWS CLI And Serverless installed and configured.

The majority of the deployment process is done by Serverless Framework. Steps for deploying this solution are:
1. Create an Amazon Cognito User Pool and a client app. Make sure not to generate a client secret, because your client is a web app. Create a user in the pool. This will be the user you will use to sign in to the react client app.
2. Plug the User Pool ARN in serverless.yml (variable USER_POOL_ARN).
3. Review serverless.yml parameters at the top and change values as needed. One important variable is the SG_ID - this is the security group ID which you will add/remove rules from. Also - set your email, as this will be the address that will receive messages about added and removed SG rules.
3. Deploy the serverless project.
4. Set the parameters in lmi-client/public/index.html (APIG endpoint is emitted when sls deploy completes as ServiceEndpoint output)
5. Prepare the React app (execute `npm install` and `npm run build` inside lmi-client directory)
6. Upload the React client (content of build directory) to BUCKET_NAME S3 bucket and make sure it's marked as public.

## Usage

1. Browse to 'lmi-react-site' S3 bucket web URL (URL is emitted when sls deployment completes).
2. Sign in using the credentials of the user you added to your Cognito User Pool.
3. Add a rule and submit.

## To do

- [ ] Add list of current rules after login, so user can remove them via UI
- [ ] Include a remove link in the "LMI rule added" email

That's it!
