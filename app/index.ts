import {MatrixClient} from 'matrix-bot-sdk';

import 'globals';
import { changeAvatar, changeDisplayname } from 'commands/customise';
import {checkForMultiMessageCommand as checkIfMessageIsForMultimessageCommand  } from 'utils/multimessagecommand';


async function onEvents(client : MatrixClient) {
    client.on('room.message', async (roomId, event) => {
        if (!event['content']) return;  // If no content, skip
        
        const sender = event['sender'];
        if (sender == clientId) return;  // If message is from this bot, skip
        
        const content = event['content'];
        const body = content['body'];
        let requestEventId = event['event_id'];

        const isEdit = 'm.new_content' in content;
        const isHtml = 'formatted_body' in content;

        checkIfMessageIsForMultimessageCommand(client, roomId)
        

        // Mentions are HTML
        // Example: formatted_body: '<a href="https://matrix.to/#/@example:example.org">example</a>: test'
        if (isHtml) {
            let formatted_body : string = content['formatted_body'];
            // If the bot is mentioned
            let mention = formatted_body.match(regexSelfMention)
            if (mention != null) {
                let command = formatted_body.replace(mention[0], '').toLowerCase();

                handleMultiMessageCommand(client, roomId, event, sender, 
                    (command.includes('picture') || command.includes('avatar')), 
                    true, 
                    {
                        description: 'avatar change',
                        messageType: 'm.image',
                        functionToExecute: changeAvatar
                    }, 
                    'Setting new avatar! If your next message is an image, I will update my avatar to that.');
                
                handleMultiMessageCommand(client, roomId, event, sender, 
                    (command.includes('name') || command.includes('handle')), 
                    true, 
                    {
                        description: 'display name change',
                        messageType: 'm.text',
                        functionToExecute: changeDisplayname
                    }, 
                    'Setting new display name! I\'ll set it to the contents of your next message.');
            }
        }

    });

}
