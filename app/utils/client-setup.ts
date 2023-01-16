import { readFileSync, writeFileSync } from 'fs';

import { MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin } from 'matrix-bot-sdk';

import './globals';
import { getFromEnv, loadConfig } from './env';
import { runMultiMessageCommand } from './multimessagecommand';


globalThis.homeserverUrl = getFromEnv('HOMESERVER_URL');

async function checkForAccessToken() {
    if (getFromEnv('PASSWORD', true) != '') {
        console.log("Deteced password. Generating access_token...");
        
        /*
        let env = readFileSync('.env', {
            encoding: 'utf-8'
        });
        //let existingAccessToken = /ACCESS_TOKEN=.*$/.exec()
        //env = env.replace('')
        */
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

async function matrixLogin() {
    const storage = new SimpleFsStorageProvider('bot.json');
    const crypto = new RustSdkCryptoStorageProvider('./crypto');
    const client = new MatrixClient(homeserverUrl, getFromEnv('ACCESS_TOKEN'), storage, crypto);

    globalThis.clientId = await client.getUserId();
    let selfEscaped = clientId.replace(/\./g, '\\.');
    globalThis.regexSelfMention = new RegExp(`<a href=".*?${selfEscaped}">[:]?`, 'g');
    AutojoinRoomsMixin.setupOnClient(client);
    await client.crypto.prepare(await client.getJoinedRooms());
    await client.start();

    console.log('Client started!');
    console.log(`Logged in as ${clientId} on ${homeserverUrl}`);

    return client;
}

export function startClient() {
    let startPromise = checkForAccessToken().then(matrixLogin);
    startPromise.catch((err) => {
        console.error(err);
    });
    return startPromise;
}

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