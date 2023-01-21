import { MatrixClient } from "matrix-bot-sdk";
import { checkAwaitCommands } from "./awaitCommands";

import '../utils/globals';

/**
 * A function that uses client.on('room.message') to expand its functionality
 * - Giving you extra variables besides roomId & event ( @see onMessageCallback )
 * - Automatically skips messages without content
 * - Automatically skips messages sent by the client/bot itself
 * - Automatically handles the second part of multi message commands. @see runMultiMessageCommand
 * 
 * @param client - The bot client, generated from @see generateAndStartClient
 * @param {onMessageCallback} callback - The callback that handles the message
 * 
 */
/**
 * @callback onMessageCallback
 * 
 * @param {string} roomId - The id of the room the event was sent in
 * @param {any} event - The event object of the message
 * @param {string} sender - The id of the message sender
 * @param {any} content - The content of the message
 * @param {any} body - The body of the content
 * @param {string} requestEventId - The event id of the message
 * @param {boolean} isEdit - Returns whether the message is an edit or not
 * @param {boolean} isHtml - Returns whether the message is written in HTML or not
 * @param {string} mentioned - Returns '' if the client/bot is not mentioned, or the HTML string of the mention itself if the client/bot *is* mentioned
 * @param {any} relatesTo - Returns {} if the messages has no relates_to field, or the relates_to object of the event
 * @param {string} relatesToEventId - Returns '' if the message has no relates_to field, or the event id of the related event
 * @param {string} relatesToRelType - Returns '' if the message has no relates_to field, or the rel type of the related event
 */

export default function onMessage(client: MatrixClient, 
    callback : (roomId: string, event: any, sender: string, content: any, body: any, requestEventId: string, isEdit: boolean,
                isHtml: boolean, mentioned: string, relatesTo: any, relatesToEventId: string, relatesToRelType: string) => {}) {
    client.on('room.message', async (roomId, event) => { 
        if (!event['content']) return;  // If no content, skip
        
        const sender = event['sender'];
        if (sender == clientId) return;  // If message is from this bot, skip
        
        const content = event['content'];
        const body = content['body'];
        let requestEventId = event['event_id'];

        const isEdit = 'm.new_content' in content;
        const isHtml = 'formatted_body' in content;

        let mentioned : string = '';
        if (isHtml) {
            const selfEscaped = clientId.replace(/\./g, '\\.');
            const regexSelfMention = new RegExp(`<a href=".*?${selfEscaped}">.*?<\/a>[:]`, 'g');

            const formatted_body = content['formatted_body'];
            const mentionString = formatted_body.match(regexSelfMention);
            if (mentionString != null) {
                mentioned = formatted_body.replace(mentionString, '').trimStart();
            }
        }
        
        const relatesTo = 'm.relates_to' in content ? content['m.relates_to'] : {};
        const relatesToEventId = relatesTo ? relatesTo['event_id'] : "";
        const relatesToRelType = relatesToEventId && 'rel_type' in relatesTo ? relatesTo['rel_type'] : "";

        checkAwaitCommands(client, roomId, event, content, sender);

        callback(roomId, event, sender, content, body, requestEventId, isEdit, isHtml, mentioned, relatesTo, relatesToEventId, relatesToRelType);
    });
}
