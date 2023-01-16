import { MatrixClient } from 'matrix-bot-sdk';

import './utils/globals';
import { startClient, onMessage } from './utils/client-setup';
import { handleMultiMessageCommand } from './utils/multimessagecommand';
import { changeAvatar, changeDisplayname } from './commands/customise';
import { handleMermaidCodeblocks } from './commands/mermaid';


async function onEvents(client : MatrixClient) {
    onMessage(client, 
        async (roomId, event, sender, content, body, requestEventId, isEdit, isHtml) => {
        
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

        handleMermaidCodeblocks(client, roomId, requestEventId, event, body, isEdit);

    });

}

startClient().then((client : MatrixClient) => {
    onEvents(client);
});