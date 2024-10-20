const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const {PutCommand} = require('@aws-sdk/lib-dynamodb');

exports.handler = async (event) => {
    const records = event.Records;
    const client = new DynamoDBClient({
        region: 'us-east-1'
    });
    for (const record of records) {
        const body = JSON.parse(record.body);
        const message = JSON.parse(body.Message);

        switch (message.eventType) {

            case 'Complaint':
                for (const recipient of message.complaint.complainedRecipients) {
                    const item = {
                        email: recipient.emailAddress,
                        reason: 'COMPLAINT'
                    }

                    const command = new PutCommand({
                        TableName: process.env.DYNAMODB_TABLE_NAME,
                        Item: item
                    })

                    await client.send(command)
                }
                break;

            case 'Bounce':
                for (const recipient of message.bounce.bouncedRecipients) {
                    const item = {
                        email: recipient.emailAddress,
                        Reason: 'BOUNCE'
                    }

                    const command = new PutCommand({
                        TableName: process.env.DYNAMODB_TABLE_NAME,
                        Item: item
                    })

                    await client.send(command)
                }
                break;

            default:
                console.log("Message:::::::::::::::", message)
                break
        }

    }
}