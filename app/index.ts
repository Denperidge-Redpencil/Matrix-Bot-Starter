import {MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider,  SimpleFsStorageProvider, AutojoinRoomsMixin, ConsoleLogger, ImageMessageEventContent} from 'matrix-bot-sdk';
import { getFromEnv, loadConfig } from './env';


//import mermaid from 'mermaid';
//import { run } from '@mermaid-js/mermaid-cli';
//import { launch as puppeteerLaunch, Browser } from 'puppeteer';
import url from 'url';
import mermaid from 'headless-mermaid';
import svg2img from 'svg2img';
import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

const homeserverUrl = getFromEnv('HOMESERVER_URL');

let self : string;
const regexMermaid = new RegExp('```mermaid(.*?|\n)*```', 'gmi');


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
    AutojoinRoomsMixin.setupOnClient(client);

    return Promise.all([client.getUserId(), client.getJoinedRooms(), client.start()]).then((params: [string, string[], void]) => {
        self = params[0];
        //browser = params[1];
        client.crypto.prepare(params[1]);
        console.log('Client started!');
        console.log(`Logged in as ${self} on ${homeserverUrl}`);
        client.on('room.message', async (roomId, event) => {
            if (!event['content']) return;  // If no content, skip
            
            const sender = event['sender'];
            if (sender == self || self == null) return;  // If message is from this bot, skip
            
            const body = event['content']['body'];
        
            let mermaidBlocks : RegExpExecArray|null = regexMermaid.exec(body);
            client.sendMessage(roomId, {
                'msgtype': 'm.text',
                'body': 'meow'
            })
        
            if (mermaidBlocks !== null) {
                if (mermaidBlocks.length < 1) return;
                
                let diagramDefinition = mermaidBlocks[0].replace(/```.*$/gmi, '');
                let mimetype : string, extension : string;
                
                let firstLine = mermaidBlocks[0].split('\n')[0];
                // If firstline includes an extension
                if (firstLine.includes('.')) {
                    extension = firstLine.substring(firstLine.indexOf('.')+1).toLowerCase();

                    // Switch case for common extension pitfalls
                    switch (extension) {
                        case 'svg':
                            mimetype = `image/svg+xml`;
                            break;
                        case 'svg+xml':
                            mimetype = 'svg';
                            break;
                        case 'jpg':
                            mimetype = `image/jpeg`;
                            break;                        
                        default:
                            mimetype = `image/${extension}`;
                            break;
                    }

                } else {
                    // Default to png
                    mimetype = `image/png`;
                    extension = 'png';
                }
                
                console.log(diagramDefinition)
                console.log(`${mimetype} - ${extension}`)

                renderMermaid(diagramDefinition).then((svgCode : string) => {

                    sendImage(client, roomId, 'mermaid.' + extension, mimetype, svgCode); 
                });
                
            } else {
                console.log('null')
            }
        
        });
        

        return [storage, crypto, client];
    });

}

checkForAccessToken().then(matrixLogin).then((value: (SimpleFsStorageProvider | RustSdkCryptoStorageProvider | MatrixClient)[]) => {

});


async function renderMermaid(diagramDefinition : string) : Promise<string> {
    return mermaid.execute(diagramDefinition, {
        flowchart: {
            htmlLabels: false
        }
    });
}



/**
 * 
 * @param client 
 * @param roomId 
 * @param filestream 
 * @param mimetype image/svg+xml 
 */
async function sendImage(client : MatrixClient, roomId : string, filename: string, mimetype: string, filestring : string) {
    let isSvg = mimetype.includes('svg');

    // Sharp will be used to:
    // - Determine width, height and size (all image types)
    // - Create a buffer (if not SVG)
    let sharpImage : sharp.Sharp = sharp(Buffer.from(filestring))
    let buffer = isSvg ? Buffer.from(filestring) : await sharpImage.toBuffer();
    let sizeData = await sharpImage.metadata();
    
    const encrypted = await client.crypto.encryptMedia(buffer);
    const mxc = await client.uploadContent(encrypted.buffer, mimetype);

    let message : ImageMessage = {
        msgtype: 'm.image',
        body: filename,
        info : {
            mimetype: mimetype,
            //size: sizeData.size,
            w: sizeData.width,
            h: sizeData.height,
        },
        file: {
            url: mxc,
            ...encrypted.file
        }
    };

    // If SVG, render a png as preview/thumbnail
    if (isSvg) {
        console.log("thub")
        const thumbnailBuffer = await sharpImage.toBuffer();
        const encrypted2 = await client.crypto.encryptMedia(thumbnailBuffer);
        const mxc2 = await client.uploadContent(encrypted2.buffer, 'image/png');

        message.info.thumbnail_file = {
            url: mxc2,
            ...encrypted2.file
        };
        message.info.thumbnail_info = {  // This doesn't do things I think but I'm keeping it here for now
            mimetype: 'image/png',
            //size: sizeData.size,
            w: sizeData.width,
            h: sizeData.height,
        };
    }
    console.log("thumbnailset")


    await client.sendMessage(roomId, message);
    console.log("sent")
}

interface ImageMessage {
    msgtype : string,
    body: string,
    info: ImageMessageInfo,
    file: {}
}

interface ImageMessageInfo {
    mimetype: string,
    w?: number,
    h?: number,
    thumbnail_file?: {},
    thumbnail_info?: ImageMessageInfo
}