import { readFileSync, writeFileSync } from 'fs';

import { MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin } from 'matrix-bot-sdk';

import '../utils/globals';
import { getFromEnv, loadConfig } from '../utils/env';


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
export async function newClient() : Promise<MatrixClient> {
    return generateAccessToken().then(matrixLogin).then(startClient);
}
