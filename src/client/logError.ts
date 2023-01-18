import { MatrixClient } from "matrix-bot-sdk";

/**
 * A function to be used to handle errors the same over the entire application.
 * This means that you don't have to rewrite logging code, and that you can change
 * the implementation of said logging easily
 * 
 * @param {any} err - The error object provided by a catch 
 * @param {MatrixClient} [client] - If you want to send the error to the user, pass the client/bot that should send the message
 * @param {string} [roomId] - If you want to send the error to the user, pass the roomId the message should be sent in 
 * 
 * @example promise.then(() => {...}).catch(logError);
 * 
 */
export default function logError(err: any, client?: MatrixClient, roomId?: string) {
    console.error(err);
    if (client !== undefined && roomId !== undefined) {
        client.sendNotice(roomId, JSON.stringify(err));
    }
};

