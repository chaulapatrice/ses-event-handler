const {SESv2Client, PutSuppressedDestinationCommand} = require("@aws-sdk/client-sesv2");

exports.handler = async (event) => {
    const records = event.Records;
    const client = new SESv2Client();
    for (const record of records) {
        const body = JSON.parse(record.body);
        const message = JSON.parse(body.Message);

        switch (message.eventType) {
            case 'Complaint':
                for (const recipient of message.complaint.complainedRecipients) {
                    const input = {
                        EmailAddress: recipient.emailAddress,
                        Reason: 'COMPLAINT'
                    }
                    const command = new PutSuppressedDestinationCommand(input);
                    await client.send(command)
                }
                break;
            case 'Bounce':
                for (const recipient of message.bounce.bouncedRecipients) {
                    const input = {
                        EmailAddress: recipient.emailAddress,
                        Reason: 'BOUNCE'
                    }
                    const command = new PutSuppressedDestinationCommand(input);
                    await client.send(command)
                }
                break;
        }

    }
}