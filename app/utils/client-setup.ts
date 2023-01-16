import { readFileSync, writeFileSync } from 'fs';

import { getFromEnv, loadConfig } from './env';
import './globals';

import {MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin} from 'matrix-bot-sdk';

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

