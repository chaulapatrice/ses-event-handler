import * as cdk from 'aws-cdk-lib';
import {CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {EventSourceMapping} from 'aws-cdk-lib/aws-lambda';
import * as path from "path"
import {SqsSubscription} from "aws-cdk-lib/aws-sns-subscriptions";
import {
    ConfigurationSet,
    ConfigurationSetTlsPolicy,
    EmailSendingEvent,
    EventDestination,
    SuppressionReasons
} from "aws-cdk-lib/aws-ses";

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'


import * as iam from 'aws-cdk-lib/aws-iam';


export class SesHandlerStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const sqsQueueDLQ = new sqs.Queue(this, 'SesHandlerQueueDLQ', {
            visibilityTimeout: cdk.Duration.seconds(300)
        });

        const sqsQueue = new sqs.Queue(this, 'SesHandlerQueue', {
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: {
                queue: sqsQueueDLQ,
                maxReceiveCount: 3
            }
        });


        const snsTopic = new sns.Topic(this, 'SesBounceAndComplaintsHandlerTopic', {
            displayName: 'SES bounce and complaints topic'
        });

        snsTopic.addSubscription(new SqsSubscription(sqsQueue))

        const dynamoDbTableName = 'ses_suppression_list'

        const dynamodbTable = new dynamodb.Table(
            this, 'SuppressionListTable', {
                partitionKey: {
                    name: 'email',
                    type: dynamodb.AttributeType.STRING
                },
                tableName: dynamoDbTableName
            }
        );

        const consumerFunction = new lambda.Function(this, 'SesBouncesAndComplaintsHandlerLambda', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../functions')),
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'consumer.handler',
            environment: {
                DYNAMODB_TABLE_NAME: dynamodbTable.tableName
            }
        });

        consumerFunction.addToRolePolicy(new iam.PolicyStatement(
            {
                actions: ['dynamodb:PutItem'],
                resources: ['*'],
                effect: iam.Effect.ALLOW
            }
        ))


        new EventSourceMapping(this, 'SesBouncesAndComplaintsHandlerEventSourceMapping', {
            target: consumerFunction,
            batchSize: 1,
            eventSourceArn: sqsQueue.queueArn
        });

        sqsQueue.grantConsumeMessages(consumerFunction);

        const configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
            suppressionReasons: SuppressionReasons.COMPLAINTS_ONLY,
            tlsPolicy: ConfigurationSetTlsPolicy.REQUIRE
        })

        configurationSet.addEventDestination('ToSNS', {
            destination: EventDestination.snsTopic(snsTopic),
            events: [
                EmailSendingEvent.COMPLAINT,
                EmailSendingEvent.BOUNCE
            ]
        })

        new CfnOutput(this, 'SNSTopicARN', {value: snsTopic.topicArn})

    }
}
