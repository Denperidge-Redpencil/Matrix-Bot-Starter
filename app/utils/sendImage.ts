import { MatrixClient } from "matrix-bot-sdk";
import sharp from 'sharp';

import LogError from '../utils/logerror';

//import 'globals';


let formats : { [key: string]: sharp.AvailableFormatInfo } = {};
Object.values(sharp.format).forEach((format: sharp.AvailableFormatInfo) => {
    formats[format.id] = format;
})

/**
 * 
 * @param client 
 * @param roomId 
 * @param filestream 
 * @param mimetype image/svg+xml 
 */

export default async function sendImage(client : MatrixClient, roomId : string, event: any, filename: string, extension: string, mimetype: string, filestring : string, requestEventId? : string) {
    let isSvg = mimetype.includes('svg');

    // Sharp will be used to:
    // - Determine width, height and size (all image types)
    // - Create a buffer (if not SVG)

    let sharpImage : sharp.Sharp;
    let buffer: Buffer;

    try { 
        sharpImage = sharp(Buffer.from(filestring)).toFormat(formats[extension]);
        buffer = isSvg ? Buffer.from(filestring) : await sharpImage.toBuffer();
    } catch (err : any) {
        if (err) { 
            client.replyText(roomId, event, Object(err).toString());
        }
        return null;
    }
    
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