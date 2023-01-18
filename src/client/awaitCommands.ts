import { MatrixClient } from "matrix-bot-sdk"

/**
 * An object for use in multi message commands
 * It defines what the next message should be and what to do with that message
 * 
 * @param description - Description of what the command does, used to send error messages: `Incorrect message type! Cancelling ${description}`
 * @param messageType - Message type to wait for. Possible values include m.message, m.file, m.image... @see {@link https://spec.matrix.org/latest/client-server-api/#mroommessage-msgtypes}
 * @param functionToExecute - Function to run if the next message from the sender is permitted and of the correct type.
 * @param data - Optional data to pass to the next step
 */
export interface AwaitMoreInputOptions {
    description: string,
    messageType: string,
    functionToExecute: (client: MatrixClient, roomId: string, event: any, options: AwaitMoreInputOptions) => Promise<void> | void,
    data?: any
}

// An object that holds multi message commands that are being handled
let awaitCommandQueue : {[senderId: string] : AwaitMoreInputOptions} = {}


/**
 * A function that will allow creating a command that awaits additional input from the user of a specific type
 * Optionally allowing the command to be locked for people without a certain amount of permissions
 * 
 * @param {MatrixClient} client - The bot client, generated from @see generateAndStartClient
 * @param {string} roomId - The id of the room to send the message in
 * @param {any} event - The event object returned by on.message/sendmessage
 * @param {boolean} requiresManagePermission - true/false on whether elevated permissions are needed to run this command
 * @param {AwaitMoreInputOptions} awaitMoreInputOptions - Object that defines what type of message to wait for and what to do with it afterwards. @see AwaitMoreInputOptions 
 * @param {string} [notice] - Notice message to send when the first part of the command is issued
 * @param {boolean} [noticeInThread] - Whether to send the notice in a thread
 * @returns 
 */
export async function awaitMoreInput(client: MatrixClient, roomId: string, event: any, requiresManagePermission : boolean, awaitMoreInputOptions: AwaitMoreInputOptions, notice?: string, noticeInThread: boolean = false) {
    const senderId = event['sender'];

    if (requiresManagePermission) {
        // If the sender is allowed to kick, they're allowed to manage the bot
        let allowedToManageBot = await client.userHasPowerLevelFor(senderId, roomId, 'kick', true);
        if (!allowedToManageBot) {
            client.replyNotice(roomId, event, 'My apologies! You need to have the \'kick\' permission to change my settings.');
            return;
        }
    }

    awaitCommandQueue[senderId] = awaitMoreInputOptions;

    if (!notice) {
        return;
    }

    if (!noticeInThread) {
        client.replyNotice(roomId, event, notice);
    } else {
        const threadStartEventId = event['content']['m.relates_to'] ? event['content']['m.relates_to']['event_id'] : event['event_id'];
        client.sendMessage(roomId, {
            body: notice,
            msgtype: 'm.notice',
            'm.relates_to': {
                'rel_type': 'm.thread',
                'event_id': threadStartEventId
            }
        });
    }
}

/**
 * A helper function that runs any multi message commands currently in queue
 * This gets called automatically if you use @see client-setup.onMessage
 * Otherwise, you can simply just run it on.message, with no additional setup needed
 * 
 * @param client - The bot client, generated from @see generateAndStartClient
 * @param roomId - The id of the room to send the message in
 * @param event - The event object returned by on.message/sendmessage, that possibly contains the second part of a multi message command
 * @param content - The content of the event
 * @param sender - The sender of the event
 */
export function checkAwaitCommands(client: MatrixClient, roomId: string, event: any, content: any, sender: string) {
    const commandAwaitedFromSender = sender in awaitCommandQueue;

    if (commandAwaitedFromSender) {
        let awaitMoreInputOptions : AwaitMoreInputOptions = awaitCommandQueue[sender];
        if (awaitMoreInputOptions.messageType != content['msgtype']) {
            client.replyNotice(roomId, event, `Incorrect message type! Cancelling ${awaitMoreInputOptions.description}`);
        }
        else {
            awaitMoreInputOptions.functionToExecute(client, roomId, event, awaitMoreInputOptions);
        }
        delete awaitCommandQueue[sender];
    }
}