import { MatrixClient } from 'matrix-bot-sdk';
import mermaid from 'headless-mermaid';

import sendImage  from '../utils/sendImage';
import LogError from '../utils/logerror';

interface RenderedDiagram {
    requestEventId: string,
    answerEventId: string
}

const regexMermaid = new RegExp('```mermaid(.*?|\n)*?```', 'gmi');
let renderedDiagrams : Array<RenderedDiagram> = [];

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
        console.log('No mermaid diagrams found.');
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

export async function handleMermaidCodeblocks(client: MatrixClient, roomId: string, requestEventId: string, event: any, text: string, isEdit: boolean) {

    mermaidInfoFromText(text).then((diagramDefinitions) => {
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
                sendImage(client, roomId, event, 'mermaid', extension, mimetype, svgCode).then((eventId : string | null) => {
                    if (eventId == null) {
                        return;
                    } 
                    renderedDiagrams.push({ 
                        requestEventId: event['event_id'],
                        answerEventId: eventId
                    });
                });
            });
        }
    });
}