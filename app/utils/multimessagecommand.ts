import { MatrixClient } from "matrix-bot-sdk"

/**
 * An object for use in multi message commands
 * It defines what the next message should be and what to do with that message
 * 
 * @param description - Description of what the command does, used to send error messages: `Incorrect message type! Cancelling ${description}`
 * @param messageType - Message type to wait for. Possible values include m.message, m.file, m.image... @see {@link https://spec.matrix.org/latest/client-server-api/#mroommessage-msgtypes}
 * @param functionToExecute - Function to run if the next message from the sender is permitted and of the correct type.
 */
interface AwaitMessageFrom {
    description: string,
    messageType: string,
    functionToExecute: (client: MatrixClient, roomId: string, event: any) => Promise<void> | void
}

// An object that holds multi message commands that are being handled
let multiMessageCommandQueue : {[senderId: string] : AwaitMessageFrom} = {}


/**
 * A function that will allow creating a command that awaits additional input from the user of a specific type
 * Optionally allowing the command to be locked for people without a certain amount of permissions
 * 
 * @param {MatrixClient} client - The bot client, generated from @see startClient
 * @param {string} roomId - The id of the room to send the message in
 * @param {any} event - The event object returned by on.message/sendmessage
 * @param {boolean} test - A boolean on whether the command should be execcuted. @example (command.includes('name') || command.includes('handle')) 
 * @param {boolean} requiresManagePermission - true/false on whether elevated permissions are needed to run this command
 * @param {AwaitMessageFrom} awaitMessageFrom - Object that defines what type of message to wait for and what to do with it afterwards. @see AwaitMessageFrom 
 * @param {string} notice - Notice message to send when the first part of the command is issued 
 * @returns 
 */
export async function handleMultiMessageCommand(client: MatrixClient, roomId: string, event: any, test: boolean, requiresManagePermission : boolean, awaitMessageFrom: AwaitMessageFrom, notice: string) {
    if (!test) {
        return;
    }

    const senderId = event['sender'];

    if (requiresManagePermission) {
        // If the sender is allowed to kick, they're allowed to manage the bot
        let allowedToManageBot = await client.userHasPowerLevelFor(senderId, roomId, 'kick', true);
        if (!allowedToManageBot) {
            client.replyNotice(roomId, event, 'My apologies! You need to have the \'kick\' permission to change my settings.');
            return;
        }
    }

    multiMessageCommandQueue[senderId] = awaitMessageFrom;

    client.replyNotice(roomId, event, notice);
}

/**
 * A helper function that runs any multi message commands currently in queue
 * This gets called automatically if you use @see client-setup.onMessage
 * Otherwise, you can simply just run it on.message, with no additional setup needed
 * 
 * @param client - The bot client, generated from @see startClient
 * @param roomId - The id of the room to send the message in
 * @param event - The event object returned by on.message/sendmessage, that possibly contains the second part of a multi message command
 * @param content - The content of the event
 * @param sender - The sender of the event
 */
export function runMultiMessageCommand(client: MatrixClient, roomId: string, event: any, content: any, sender: string) {
    const multiMessageCommandToHandle = sender in multiMessageCommandQueue;

    if (multiMessageCommandToHandle) {
        let multiMessageCommand : AwaitMessageFrom = multiMessageCommandQueue[sender];
        if (multiMessageCommand.messageType != content['msgtype']) {
            client.replyNotice(roomId, event, `Incorrect message type! Cancelling ${multiMessageCommand.description}`);
        }
        else {
            multiMessageCommand.functionToExecute(client, roomId, event);
        }
        delete multiMessageCommandQueue[sender];
    }
}