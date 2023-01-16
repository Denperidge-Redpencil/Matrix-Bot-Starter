import { MatrixClient, MessageEventContent } from "matrix-bot-sdk";
import sharp from 'sharp';

import LogError from '../utils/logerror';

/**
 * Dynamically creates an object/dictionary for sharp.format.*
 * @example formats['jpeg'] => sharp.format.jpeg
 * 
 * @returns an object of { [ key: string ]: sharp.AvailableFormatInfo }
 */
function createSharpFormatDict() {
    let formats : { [key: string]: sharp.AvailableFormatInfo } = {};
    Object.values(sharp.format).forEach((format: sharp.AvailableFormatInfo) => {
        formats[format.id] = format;
    })
    return formats;
}
const formats : { [key: string]: sharp.AvailableFormatInfo } = createSharpFormatDict();


/**
 * A helper function to send images that...
 * - Automatically gets the image dimensions & size and sets the metadata
 * - Converts the image to the passed mimetype
 * - Uploads the image encrypted to Matrix
 * - Easily allows the image to be used as a reply
 * - When sending an SVG, generating a png thumbnail for increased preview compatibility
 * 
 * @param {MatrixClient} client - The bot client, generated from @see startClient
 * @param {string} roomId - Room to send the message in 
 * @param {string} filename - Name to use when uploading the file 
 * @param {string} extension - Extension to append to the filename
 * @param {string} mimetype - Image mimetype. @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types}
 * @param {string} filestring - A filestring, gained from readFile('image.png'), or regular svg code
 * @param {string} [replyEventId] - The message that the image should be sent as a reply to
 */
export default async function sendImage(client : MatrixClient, roomId : string, filename: string, extension: string, mimetype: string, filestring : string, replyEventId? : string) {
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
            let errorNotice : {
                body: string,
                msgtype: string,
                'm.relates_to'?: {}
            } = {
                body: Object(err).toString(),
                msgtype: 'm.notice'
            };

            if (replyEventId) {
                errorNotice['m.relates_to'] = {
                    'm.in_reply_to': {
                        event_id: replyEventId
                    }
                };
            }
            client.sendEvent(roomId, 'm.room.message', errorNotice);
            LogError(err);
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

    if (replyEventId != null) {
        message['m.relates_to'] = {
            'm.in_reply_to': {
                event_id: replyEventId
            }
        }
    }

    // If SVG, render a png as preview/thumbnail
    if (isSvg) {
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