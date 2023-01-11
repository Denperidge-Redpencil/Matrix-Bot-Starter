import {MatrixClient, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin, ConsoleLogger} from 'matrix-bot-sdk';
import { getFromEnv } from './env';
//import mermaid from 'mermaid';
//import { run } from '@mermaid-js/mermaid-cli';
import { launch as puppeteerLaunch, Browser } from 'puppeteer';
import url from 'url';
import mermaid from 'headless-mermaid';
import svg2img from 'svg2img';
import { readFileSync } from 'fs';

const homeserverUrl = getFromEnv('HOMESERVER_URL');
const storage = new SimpleFsStorageProvider('bot.json');
const crypto = new RustSdkCryptoStorageProvider('./crypto');
const client = new MatrixClient(homeserverUrl, getFromEnv('ACCESS_TOKEN'), storage, crypto);

let self : string;
let browser : Browser;

AutojoinRoomsMixin.setupOnClient(client);
//mermaid.initialize({startOnLoad: true});

Promise.all([client.getUserId(), puppeteerLaunch({headless: true}), client.start(), client.getJoinedRooms()]).then((params: [string, Browser, any, string[]]) => {
    self = params[0];
    browser = params[1];
    client.crypto.prepare(params[3]);
    console.log('Client started!');
    console.log(`Logged in as ${self} on ${homeserverUrl}`);
});

const regexMermaid = new RegExp('```mermaid(.*?|\n)*```', 'gmi');

client.on('room.message', async (roomId, event) => {
    if (!event['content']) return;  // If no content, skip
    
    const sender = event['sender'];
    if (sender == self) return;  // If message is from this bot, skip
    
    const body = event['content']['body'];

    let mermaidBlocks : RegExpExecArray|null = regexMermaid.exec(body);
    client.sendMessage(roomId, {
        'msgtype': 'm.text',
        'body': 'meow'
    })

    if (mermaidBlocks !== null) {
        if (mermaidBlocks.length < 1) return;
        let diagramDefinition = mermaidBlocks[0].replace('```mermaid', '').replace('```', '');
        console.log(diagramDefinition)
        let svgCode : string = await mermaid.execute(diagramDefinition);

        //console.log(svgCode)
        
        //let buffer = Buffer.from(svgCode)
        //const encrypted = await client.crypto.encryptMedia(readFileSync('app/image.png'));
        svg2img(svgCode, async (error, buffer) => {

            const encrypted = await client.crypto.encryptMedia(Buffer.from(svgCode));
            const mxc = await client.uploadContent(encrypted.buffer, 'image/svg+xml');


            const encrypted2 = await client.crypto.encryptMedia(buffer);
            const mxc2 = await client.uploadContent(encrypted2.buffer, 'image/png');

            await client.sendMessage(roomId, {
                msgtype: 'm.image',
                body: 'mermaid.svg',
                info: {
                    mimetype: 'image/svg+xml',
                    size: 10192, //buffer.length,
                    w: 52,
                    h: 160
                },
                file: {
                    url: mxc,
                    ...encrypted.file
                }
            })
        })
        //let mxc = await client.uploadContentFromUrl('https://ih1.redbubble.net/image.1932679503.2966/poster,504x498,f8f8f8-pad,600x600,f8f8f8.jpg')
        
        /*
        client.sendMessage(roomId, {
            msgtype: 'm.text',
            body: 'https://ih1.redbubble.net/image.1932679503.2966/poster,504x498,f8f8f8-pad,600x600,f8f8f8.jpg'
        })
        /*
        svg2img(svgCode, async (error, buffer) => {
            //const mxc = await client.uploadContent(encrypted.buffer);
            const encrypted = await client.crypto.encryptMedia(buffer);

            const mxc = await client.uploadContent(encrypted.buffer, 'image/svg+xml');

            console.log(client.uploadContentFromUrl)
    
            client.sendMessage(roomId, {
                msgtype: 'm.image',
                body: 'mermaid.svg',
                info: {
                    mimetype: 'image/svg+xml'
                },
                file: {
                    url: mxc,
                    ...encrypted.file
                }
            })
        });
       
        //console.log(mermaid.parse(diagramDefinition))
        
        //let render = await renderMermaid(diagramDefinition);
        //console.log(render)

        //let parse = mermaid.parse(diagramDefinition)
        //console.log(parse)
        
        //let document = '';
        /*
        mermaid.render('graph', diagramDefinition, (svgCode) => {
            client.sendHtmlText(roomId, svgCode)
        });
        /*
        client.sendMessage(roomId, { 
            'msgtype': 'm.text',
            'body': diagramDefinition
        });
        /*
        client.sendMessage(roomId, { 
            'msgtype': 'm.text',
            'body': parse
        });
        */
        
    } else {
        console.log('null')
    }

});


// Based on https://github.com/mermaid-js/mermaid-cli/blob/5ff8be5250ed6c0b6f52d85bcbba2a4d9e477336/src/index.js#L201
async function renderMermaid(diagramDefinition : string) {
    let page = await browser.newPage();
    await page.goto(url.pathToFileURL('./app/index.html').toString())
    console.log("enwpage")
    await page.evaluate((diagramDefinition : string) => {
        
        console.log("---")
        console.log(diagramDefinition)
        //console.log(mermaid)
        console.log("---")
        //mermaid.initialize({})

        /*
        mermaid.render('graph', diagramDefinition, (svgCode: any) => {
            console.log("e")
            console.log(svgCode);
        });*/
    }, diagramDefinition)
    /*
    page.$eval('body', (body) => {
        console.log(body)
    })*/
}
