import {MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin, ConsoleLogger} from 'matrix-bot-sdk';
import { getFromEnv } from './env';
import mermaid from 'mermaid';

const homeserverUrl = getFromEnv('HOMESERVER_URL');
const storage = new SimpleFsStorageProvider('bot.json');
const client = new MatrixClient(homeserverUrl, getFromEnv('ACCESS_TOKEN'), storage);

let self : string;

AutojoinRoomsMixin.setupOnClient(client);
//mermaid.initialize({startOnLoad: true});

Promise.all([client.getUserId(), client.start()]).then((params: [string, any]) => {
    self = params[0];
    console.log('Client started!');
    console.log(`Logged in as ${self} on ${homeserverUrl}`);
});

const regexMermaid = new RegExp('```mermaid(.*?|\n)*```', 'gmi');

client.on('room.message', (roomId, event) => {
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
        //let parse = mermaid.parse(diagramDefinition)
        //console.log(parse)
        mermaid.mermaidAPI.render('graph', diagramDefinition, (svgCode) => {
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
