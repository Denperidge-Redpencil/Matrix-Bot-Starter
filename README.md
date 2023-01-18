# Matrix-Bot-Starter


<span>
<img src="assets/matrix-bot-starter.png" align="left" style="width:100px;height: 100px; margin: 20px; max-width: 200px;">

&nbsp;

A simple but powerful extension to [matrix-bot-sdk](https://github.com/turt2live/matrix-bot-sdk), to help you avoid boilerplating when creating Matrix bots.
</span>

&nbsp;&nbsp;&nbsp;

<img src="assets/screenshot.png" clear="both" alt="A screenshot of the matrix-bot-starter in action" />

&nbsp;

All of the following comes built-in:
- Multi-message commands.
- `startClient`, a no config client setup from environment variables
    1. Reads the .env file, either reading the access token or generating it from - and subsequently removing - the provided username/password.
    2. Sets up the Matrix client, including encryption, mixins, and the regex for when the bot is mentioned.
    3. Ties 1. & 2. together and returns the MatrixClient object.
- `onMessage`, a client.on('room.message') extension that...
    1. Returns extra variables, including whether the message is an edit, html, removing the @bot from a mention message 
    2. Stops the bot from responding to itself.
    3. Automatically implements `multiMessageCommandHandle`.
- `sendImage`, a helper function that...
    1. Automatically gets the image dimensions & size and sets it in the metadata.
    2. Converts the image to the passed mimetype.
    3. Uploads the image encrypted to Matrix.
    4. Easily allows the image to be used in a reply.
    5. In case of an SVG, generates a png thumbnail for increased compatibility.

- An example command that allows changing the bots display name & avatar from within the chat.

## Installation

You can simply install this package using npm!
```bash
npm i matrix-bot-starter
```

## Usage

The following code is enough to get a full bot up and running!

```typescript
// index.ts
import { MatrixClient } from 'matrix-bot-sdk';
import { newClient, awaitMoreInput, onMessage, changeAvatar, changeDisplayname } from 'matrix-bot-starter';

async function onEvents(client : MatrixClient) {
    onMessage(client, 
        async (roomId : string, event : any, sender: string, content: any, body: any, requestEventId: string, isEdit: boolean, isHtml: boolean, mentioned: string) => {
        if (isHtml) {
            if (mentioned) {
                let command = mentioned.toLowerCase();

                if (command.includes('picture') || command.includes('avatar')) {
                    awaitMoreInput(client, roomId, event,
                        true, 
                        {
                            description: 'avatar change',
                            messageType: 'm.image',
                            functionToExecute: changeAvatar
                        }, 
                        'Setting new avatar! If your next message is an image, I will update my avatar to that.');    
                }

                if (command.includes('name') || command.includes('handle')) {
                    awaitMoreInput(client, roomId, event,
                        true, 
                        {
                            description: 'display name change',
                            messageType: 'm.text',
                            functionToExecute: changeDisplayname
                        }, 
                        'Setting new display name! I\'ll set it to the contents of your next message.');
                }
            }
        }
    });

}

newClient().then((client : MatrixClient) => {
    onEvents(client);
});
```

```env
# .env
HOMESERVER_URL="http://example.com:8008"
ACCESS_TOKEN="syt_yourBotAccountAccessToken"
LOGINNAME="user"  # Optional, will be used to generate an access token and then removed
PASSWORD="pass"  # Optional, will be used to generate an access token and then removed
```

You can also use the template [here](https://github.com/Denperidge-Redpencil/Matrix-Bot-Starter-Starter), or view a full example [here](https://github.com/Denperidge-Redpencil/Mermatrix).

## Built-in example commands

There are also some commands you can implement when @mentioning the bot!

| command |                  function                   |
| ------- | ------------------------------------------- |
| avatar  | Change the avatar of the bot account.       |
| name    | Change the display name of the bot account. |

You don't have to call them with any parameters!
After calling one of these commands, the next message you send will be used as input.

## Building locally
- Clone the repository.
- Get an access token for your bot user (see [t2bot.io/docs/access_tokens/](https://t2bot.io/docs/access_tokens/)).
- Rename .env.example to .env and change the values.
- Run `npm install && npm run build`.

To locally pack & use it from another project, go into that project folder and run the following.
```bash
# The git clone url can be changed, or you can just mv or ln -s a local version
git clone https://github.com/Denperidge-Redpencil/Matrix-Bot-Starter.git
cd Matrix-Bot-Starter/
npm run build
npm pack
cd ..
npm install ./Matrix-Bot-Starter/*.tgz
```

### Publishing
```
npm version {major/minor/patch}
git push
npm publish --public
```

## Structure
- [src/](src/)
    - [client/](src/client/): Matrix-related functions.
        - [awaitCommands.ts](src/client/awaitCommands.ts): adds support for multi message commmands.
        - [client-setup.ts](src/client/client-setup.ts)
        - [onMessage.ts](src/client/onMessage.ts): exposes `onMessage`.
        - [sendImage.ts](src/client/sendImage.ts): exposes `sendImage`.
        - [logerror.ts](src/utils/logerror.ts): exposes a simple function that can be used...
            - Shorthand with promises, e.g. `promise.then(()=>{...}).catch(logError);`.
            - Longer to log + send a message to the user, e.g. `promise.then(()=>{...}).catch((err) =>{logError(err, client, roomId)});`
    - [commands/](src/commands/): the folder containing commands that can be used from the Matrix chat.

    - [utils/](src/utils/): non-Matrix related functions.
        - [env.ts](src/utils/env.ts): (re)loads the .env file, and exposes getFromEnv, a function that returns environment variables but exits if undefined.
        - [globals.ts](src/utils/globals.ts): defines globalThis types.

    - [index.ts](src/index.ts): defines exports.
- [assets/](assets/): Images (and an image script) for use in the README.
- *lib/*: Made during runtime. Compiled javascript code.


## Quirks
### SVG with a PNG preview
For one reason or the other, SVG's sent by the bot load forever.
As a workaround, a thumbnail/preview of the diagram gets rendered to PNG and attached to the message.

SVG's are really great. But also their implementation is weird. To give an example: Rocket.chat would preview SVG's on the desktop app and Chrome, but not on Firefox.

### USERNAME -> LOGINNAME
It seems weird to use this synonym for username while matrix tends to go for "username". Well, it turns out there is an environment variable on Windows called %USERNAME%, thus giving errors when this was run on Windows. Loginname it is!

## License
This project is licensed under the [MIT License](LICENSE).

