import {MatrixClient, MatrixAuth, RustSdkCryptoStorageProvider, SimpleFsStorageProvider, AutojoinRoomsMixin, ConsoleLogger} from 'matrix-bot-sdk';
import { getFromEnv, loadConfig } from './env';
//import mermaid from 'mermaid';
//import { run } from '@mermaid-js/mermaid-cli';
//import { launch as puppeteerLaunch, Browser } from 'puppeteer';
import url from 'url';
import mermaid from 'headless-mermaid';
import svg2img from 'svg2img';
import { readFileSync, writeFileSync } from 'fs';

const homeserverUrl = getFromEnv('HOMESERVER_URL');

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
        let auth = await new MatrixAuth(homeserverUrl).passwordLogin(getFromEnv('USERNAME'), getFromEnv('PASSWORD'));
        let data = readFileSync('.env', { encoding: 'utf-8' });
        data += `ACCESS_TOKEN="${auth.accessToken}"`;
        console.log(data)
        data = data.replace(/USERNAME=.*\n/gi, '').replace(/PASSWORD=.*\n/gi, '');
        console.log(data)
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
            if (sender == self || self == undefined) return;  // If message is from this bot, skip
            
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
                svg2img(svgCode, {
                    resvg: {
                        font: {
                            defaultFontFamily: 'Roboto'
                        },
                        textRendering: 2, // geometric precision
                    }
                }, async (error, buffer) => {
                    console.log(svgCode)
        
                    const encrypted = await client.crypto.encryptMedia(Buffer.from(svgCode));
                    const mxc = await client.uploadContent(encrypted.buffer, 'image/svg+xml');
        
        
                    const encrypted2 = await client.crypto.encryptMedia(buffer);
                    const mxc2 = await client.uploadContent(encrypted2.buffer, 'image/png');
        
                    await client.sendMessage(roomId, {
                        msgtype: 'm.image',
                        body: 'mermaid.svg',
                        info: {
                            mimetype: 'image/svg+xml',
                            //size: 10192, //buffer.length,
                            w: 52,
                            h: 160,
                            thumbnail_file: {
                                url: mxc2,
                                ...encrypted2.file
                            },
                            thumbnail_info: {
                                mimetype: 'image/png',
                                w: 52,
                                h: 160,
                               // size: 10192
                            }
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
        

        return [storage, crypto, client];
    });

}

checkForAccessToken().then(() => {
    matrixLogin().then((value: (SimpleFsStorageProvider | RustSdkCryptoStorageProvider | MatrixClient)[]) => {

    })
})



let self : string;
//let browser : Browser;

//mermaid.initialize({startOnLoad: true});



const regexMermaid = new RegExp('```mermaid(.*?|\n)*```', 'gmi');



// Based on https://github.com/mermaid-js/mermaid-cli/blob/5ff8be5250ed6c0b6f52d85bcbba2a4d9e477336/src/index.js#L201
async function renderMermaid(diagramDefinition : string) {
    //let page = await browser.newPage();
    /*await page.goto(url.pathToFileURL('./app/index.html').toString())
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
    //}, diagramDefinition)
    /*
    page.$eval('body', (body) => {
        console.log(body)
    })*/
}
