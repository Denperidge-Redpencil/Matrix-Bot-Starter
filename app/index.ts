import {MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin, ConsoleLogger, ImageMessageEventContent} from 'matrix-bot-sdk';
import { getFromEnv, loadConfig } from './env';


//import mermaid from 'mermaid';
//import { run } from '@mermaid-js/mermaid-cli';
//import { launch as puppeteerLaunch, Browser } from 'puppeteer';
import url from 'url';
import mermaid from 'headless-mermaid';
import svg2img from 'svg2img';
import { readFileSync, writeFileSync } from 'fs';
import sharp from 'sharp';

interface RenderedDiagram {
    requestEventId: string,
    answerEventId: string,
    event: any
}

const homeserverUrl = getFromEnv('HOMESERVER_URL');

let self : string;
const regexMermaid = new RegExp('```mermaid(.*?|\n)*?```', 'gmi');
let renderedDiagrams : Array<RenderedDiagram> = []



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

    self = await client.getUserId();
    AutojoinRoomsMixin.setupOnClient(client);
    await client.crypto.prepare(await client.getJoinedRooms());
    await client.start();


    console.log('Client started!');
    console.log(`Logged in as ${self} on ${homeserverUrl}`);

    return client;
}

async function setupCommands(client : MatrixClient) {
    client.on('room.message', async (roomId, event) => {
        if (!event['content']) return;  // If no content, skip
        
        const sender = event['sender'];
        if (sender == self) return;  // If message is from this bot, skip
        
        
        const body = event['content']['body'];
        let requestEventId = event['event_id']//.replace('\n', '');

        let isEdit = 'm.new_content' in event.content;

        mermaidInfoFromText(body).then((info) => {
            if (info == null) return;

            let diagramOrDiagrams = info.length > 1 ? 'diagrams' : 'diagram';
            let renderingOrRerendering = isEdit ? 'Re-rendering' : 'Rendering';
            let replyToEvent = event;
            // Message edit
            if (isEdit) {
                console.log(event)
                // In this case, event['event_id'] refers to the edit event itself, not to the message that is being edited
                requestEventId = event.content['m.relates_to'].event_id;
                //replyToEvent = 
    
                
                console.log('req: ' + requestEventId)

                let oldDiagrams : Array<string> = renderedDiagrams
                    .filter((render : RenderedDiagram) => render.requestEventId == event.content['m.relates_to'].event_id)
                    .map((render : RenderedDiagram) => render.answerEventId);

                oldDiagrams.forEach((eventId : string) => {
                    client.redactEvent(roomId, eventId, `The ${diagramOrDiagrams} prompt has been edited.`);
                })
            }

            client.sendMessage(roomId, {
                'msgtype': 'm.notice',
                'body': `${renderingOrRerendering} ${diagramOrDiagrams}...`,
                'm.relates_to': {
                    'm.in_reply_to': {
                        event_id: requestEventId
                    }
                }
            })

            //client.replyNotice(roomId, replyToEvent, `${renderingOrRerendering} ${diagramOrDiagrams}...`).then((eventId : string) => {
                //console.log("notice: " + eventId);
            //});

            


            for (let i=0; i < info.length; i++) {
                const params = info[i];

                const diagramDefinition = params[0];
                const extension = params[2];
                const mimetype = params[1];

                renderMermaid(diagramDefinition).then(async (svgCode : string) => {
                    sendImage(client, roomId, 'mermaid.' + extension, mimetype, svgCode).then((eventId) => {
                        renderedDiagrams.push({ 
                            requestEventId: event['event_id'],
                            answerEventId: eventId,
                            event
                        });
                    });
                });
            }
        });

        

    
        // regexMermaid.exec is not the same as match!
        
    });

}

checkForAccessToken().then(matrixLogin).then(setupCommands).catch((err) => {
    console.error(err);
});

async function mermaidInfoFromText(body: string) {
    let mermaidBlocks : Array<string>|null = body.match(regexMermaid);

    let info = [];

    if (mermaidBlocks !== null) {
        if (mermaidBlocks.length < 1) return;
        for (let i = 0; i < mermaidBlocks.length; i++) {
            let mermaidBlock = mermaidBlocks[i];
            let diagramDefinition = mermaidBlock.replace(/```.*/gi, '');
            let mimetype : string, extension : string;
            
            let firstLine = mermaidBlock.split('\n')[0];
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

            console.log(`${mimetype} - ${extension}`)
            info.push([diagramDefinition, mimetype, extension]);
        };

        return info;
        
    } else {
        console.log('null')
        return null;
    }

}


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
async function sendImage(client : MatrixClient, roomId : string, filename: string, mimetype: string, filestring : string, requestEventId? : string) {
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
        },
    };

    if (requestEventId != null) {
        message['m.relates_to'] = {
            'm.in_reply_to': {
                event_id: requestEventId
            }
        }
    }

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

    return client.sendMessage(roomId, message);
}

interface ImageMessage {
    msgtype : string,
    body: string,
    "'body'"?: string,
    info: ImageMessageInfo,
    file: {},

    'm.new_content'?: ImageMessage,
    'm.relates_to'?: {
        rel_type?: string,
        event_id?: string
        'm.in_reply_to': {}
    }
}

interface ImageMessageInfo {
    mimetype: string,
    w?: number,
    h?: number,
    thumbnail_file?: {},
    thumbnail_info?: ImageMessageInfo,
}