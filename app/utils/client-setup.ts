import { readFileSync, writeFileSync } from 'fs';

import { MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin } from 'matrix-bot-sdk';

import './globals';
import { getFromEnv, loadConfig } from './env';
import { runMultiMessageCommand } from './multimessagecommand';


globalThis.homeserverUrl = getFromEnv('HOMESERVER_URL');

/**
 * A function that checks for a PASSWORD environment variable,
 * If it exists, it...
 *  - uses that and LOGINNAME to generate an access token
 *  - saves the newly generated access token into .env 
 *  - removes PASSWORD and LOGINNAME from .env
 *  - reloads the environment variables
 * Otherwise, it simply passes
 */
async function generateAccessToken() : Promise<void> {
    if (getFromEnv('PASSWORD', true) != '') {
        console.log("Deteced password. Generating access_token...");
        
        // Based on https://github.com/turt2live/matrix-bot-sdk/blob/13ce618976446ac4c8d325acf7aab80a9f5e8d2c/examples/login_register.ts
        let auth = await new MatrixAuth(homeserverUrl).passwordLogin(getFromEnv('LOGINNAME'), getFromEnv('PASSWORD'));
        let data = readFileSync('.env', { encoding: 'utf-8' });
        data += `\nACCESS_TOKEN="${auth.accessToken}"`;
        data = data.replace(/LOGINNAME=.*(\n|)/gi, '').replace(/PASSWORD=.*(\n|)/gi, '');
        writeFileSync('.env', data, {
            encoding: 'utf-8'
        });
        loadConfig();
    }
}

/**
 * Sets up...
 *  - Storage
 *  - Encryption
 *  - MatrixClient object
 *  - globals.clientId, the userId of the MatrixClient
 *  - globals.regexSelfMention, a Regex to check whether the client has been mentioned in a message
 *  - Mixins (as of writing, only the AutoJoinRoomsMixin)
 * 
 * @returns {MatrixClient} - A Matrix client for the bot, ready to be started
 */
async function matrixLogin() {
    const storage = new SimpleFsStorageProvider('bot.json');
    const crypto = new RustSdkCryptoStorageProvider('./crypto');
    const client = new MatrixClient(homeserverUrl, getFromEnv('ACCESS_TOKEN'), storage, crypto);

    globalThis.clientId = await client.getUserId();
    let selfEscaped = clientId.replace(/\./g, '\\.');
    globalThis.regexSelfMention = new RegExp(`<a href=".*?${selfEscaped}">[:]?`, 'g');
    AutojoinRoomsMixin.setupOnClient(client);
    await client.crypto.prepare(await client.getJoinedRooms());

    return client;
}

/**
 * Starts the passed client, logging its clientId & homeserverUrl
 * 
 * @param {MatrixClient} client - The Matrix client/bot to start
 * @returns {MatrixClient} - The started Matrix client/bot
 */
export async function startClient(client: MatrixClient) {
    await client.start();

    console.log('Client started!');
    console.log(`Logged in as ${clientId} on ${homeserverUrl}`);

    return client;
}

/**
 * Combines the above functions to fully create & start the Matrix Client
 * - @see generateAccessToken
 * - @see matrixLogin
 * - @see startClient
 * 
 * @returns {Promise<MatrixClient>} - The promise for the Matrix client/bot
 */
export async function generateAndStartClient() : Promise<MatrixClient> {
    return generateAccessToken().then(matrixLogin).then(startClient);
}

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
 */

export function onMessage(client: MatrixClient, 
    callback : (roomId: string, event: any, sender: string, content: any,
                body: any, requestEventId: string, isEdit: boolean, isHtml: boolean, mentioned: string ) => {}) {
    client.on('room.message', async (roomId, event) => { 
        if (!event['content']) return;  // If no content, skip
        
        const sender = event['sender'];
        if (sender == clientId) return;  // If message is from this bot, skip
        
        const content = event['content'];
        const body = content['body'];
        let requestEventId = event['event_id'];

        const isEdit = 'm.new_content' in content;
        const isHtml = 'formatted_body' in content;

        let mentioned = '';
        if (isHtml) {
            const formatted_body = content['formatted_body'];
            const mentionString = formatted_body.match(regexSelfMention);
            if (mentionString != null) {
                mentioned = formatted_body.replace(mentionString, '');
            }
        }

        runMultiMessageCommand(client, roomId, event, content, sender);

        callback(roomId, event, sender, content, body, requestEventId, isEdit, isHtml, mentioned);
    });
}