import { MatrixClient } from "matrix-bot-sdk"

interface AwaitMessageFrom {
    description: string,
    messageType: string,
    functionToExecute: (client: MatrixClient, roomId: string, event: any) => Promise<void> | void
}
let multiMessageCommandQueue : {[key: string] : AwaitMessageFrom} = {}

export async function handleMultiMessageCommand(client: MatrixClient, roomId: string, event: any, senderId: string, test: boolean, requiresManagePermission : boolean, awaitMessageFrom: AwaitMessageFrom, notice: string) {
    if (!test) {
        return;
    }

    if (requiresManagePermission) {
        // If the sender is allowed to kick, they're allowed to manage the bot
        let allowedToManageBot = await client.userHasPowerLevelFor(event['sender'], roomId, 'kick', true);
        if (!allowedToManageBot) {
            client.replyNotice(roomId, event, 'My apologies! You need to have the \'kick\' permission to change my settings.');
            return;
        }
    }

    multiMessageCommandQueue[senderId] = awaitMessageFrom;

    client.replyNotice(roomId, event, notice);
}

export function checkForMultiMessageCommand(client: MatrixClient, roomId: string, event: any, content: any, sender: string) {
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