import { MatrixClient } from "matrix-bot-sdk";

export async function changeAvatar(client: MatrixClient, roomId : string, event : any) {
    client.setAvatarUrl(event.content.url).then(() => {
        client.replyNotice(roomId, event, 'Avatar updated!')
    });
}

export async function changeDisplayname(client: MatrixClient, roomId: string, event: any) {
    client.setDisplayName(event.content.body).then(() => {
        client.replyNotice(roomId, event, 'Updated display name!')
    });
    
}