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
    answerEventId: string
}

const homeserverUrl = getFromEnv('HOMESERVER_URL');

let self : string;
let formats : { [key: string]: sharp.AvailableFormatInfo };
const regexMermaid = new RegExp('```mermaid(.*?|\n)*?```', 'gmi');
let regexSelfMention : RegExp;
let renderedDiagrams : Array<RenderedDiagram> = [];

function LogError(err: any) {console.log(err);};

interface AwaitMessageFrom {
    description: string,
    messageType: string,
    functionToExecute: (client: MatrixClient, roomId: string, event: any) => Promise<void> | void
}
let multiMessageCommandQueue : {[key: string] : AwaitMessageFrom} = {}

async function handleMultiMessageCommand(client: MatrixClient, roomId: string, event: any, senderId: string, test: boolean, requiresManagePermission : boolean, awaitMessageFrom: AwaitMessageFrom, notice: string) {
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
    let selfEscaped = self.replace(/\./g, '\\.');
    regexSelfMention = new RegExp(`<a href=".*?${selfEscaped}">[:]?`, 'g');
    AutojoinRoomsMixin.setupOnClient(client);
    await client.crypto.prepare(await client.getJoinedRooms());
    await client.start();

    console.log('Client started!');
    console.log(`Logged in as ${self} on ${homeserverUrl}`);

    formats = {};
    Object.values(sharp.format).forEach((format: sharp.AvailableFormatInfo) => {
        formats[format.id] = format;
    })
    console.log(formats)

    return client;
}

async function setupCommands(client : MatrixClient) {
    client.on('room.message', async (roomId, event) => {
        if (!event['content']) return;  // If no content, skip
        
        const sender = event['sender'];
        if (sender == self) return;  // If message is from this bot, skip
        
        const content = event['content'];
        const body = content['body'];
        let requestEventId = event['event_id'];

        const isEdit = 'm.new_content' in content;
        const isHtml = 'formatted_body' in content;
        const multiMessageCommandToHandle = sender in multiMessageCommandQueue

        console.log(event);

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

        mermaidInfoFromText(body).then((diagramDefinitions) => {
            if (diagramDefinitions == null) return;

            let diagramOrDiagrams = diagramDefinitions.length > 1 ? 'diagrams' : 'diagram';
            let renderingOrRerendering = isEdit ? 'Re-rendering' : 'Rendering';

            // If the definition isn't new but edited, redact the previous renderings
            if (isEdit) {
                // In this case, event['event_id'] refers to the edit event itself, not to the message that is being edited
                requestEventId = event.content['m.relates_to'].event_id;

                let oldDiagramEventIds : Array<string> = renderedDiagrams
                    .filter((render : RenderedDiagram) => render.requestEventId == event.content['m.relates_to'].event_id)
                    .map((render : RenderedDiagram) => render.answerEventId);

                oldDiagramEventIds.forEach((eventId : string) => {
                    client.redactEvent(roomId, eventId, `The ${diagramOrDiagrams} prompt has been edited.`).catch(LogError);
                })
            }

            // Reply to the definition with a notice that there's rendering going on
            client.sendMessage(roomId, {
                'msgtype': 'm.notice',
                'body': `${renderingOrRerendering} ${diagramOrDiagrams}...`,
                'm.relates_to': {
                    'm.in_reply_to': {
                        event_id: requestEventId
                    }
                }
            })

            // For every diagram definition, render & send
            for (let i=0; i < diagramDefinitions.length; i++) {
                const params = diagramDefinitions[i];

                const diagramDefinition = params[0];
                const mimetype = params[1];
                const extension = params[2];

                renderMermaid(diagramDefinition).then(async (svgCode : string) => {
                    sendImage(client, roomId, 'mermaid', extension, mimetype, svgCode).then((eventId) => {
                        renderedDiagrams.push({ 
                            requestEventId: event['event_id'],
                            answerEventId: eventId
                        });
                    });
                });
            }
        });
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
async function sendImage(client : MatrixClient, roomId : string, filename: string, extension: string, mimetype: string, filestring : string, requestEventId? : string) {
    let isSvg = mimetype.includes('svg');

    // Sharp will be used to:
    // - Determine width, height and size (all image types)
    // - Create a buffer (if not SVG)

    let sharpImage : sharp.Sharp = sharp(Buffer.from(filestring)).toFormat(formats[extension]);
    let buffer = isSvg ? Buffer.from(filestring) : await sharpImage.toBuffer();
    let sizeData = await sharpImage.metadata();
    
    const encrypted = await client.crypto.encryptMedia(buffer);
    const mxc = await client.uploadContent(encrypted.buffer, mimetype);

    let message : ImageMessage = {
        msgtype: 'm.image',
        body: filename + '.' + extension,
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

    let messageSend = client.sendMessage(roomId, message);
    
    messageSend.catch(LogError);

    return messageSend;
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


async function changeAvatar(client: MatrixClient, roomId : string, event : any) {
    client.setAvatarUrl(event.content.url).then(() => {
        client.replyNotice(roomId, event, 'Avatar updated!')
    });
}

async function changeDisplayname(client: MatrixClient, roomId: string, event: any) {
    client.setDisplayName(event.content.body).then(() => {
        client.replyNotice(roomId, event, 'Updated display name!')
    });
    
}