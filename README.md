# Mermatrix


<span>
<img src="assets/mermatrix.png" align="left" style="width:100px;height: 100px; margin: 20px;">
<br>

Mermaid.js doesn't render automatically in Matrix. Lets fix that!
When a message contains a mermaid code block, this bot will return that very diagram.
</span>

&nbsp;&nbsp;&nbsp;

<img src="assets/Screenshot.png" clear="left" alt="A screenshot of Mermatrix in action" />

&nbsp;

Functionality:
- On a new message containing a diagram definition, render the diagram(s).
- Render multiple diagrams from one message.
- When the original message gets edited in x amount of time, re-render.
- Choose per diagram whether to render into svg or png.

## Usage
Once started, invite the bot to channels you wish to use it in.
Afterwards, it will automatically detect and parse mermaid code blocks! Example

    ```mermaid
    graph TD
        A -->|Label| B
    ```

**Tip:** Add `.png`, `.svg`, `...` after `mermaid` in the code block to select the desired output format!

There are also some commands you can use when @mentioning the bot!

| command |                  function                   |
| ------- | ------------------------------------------- |
| avatar  | Change the avatar of the bot account.       |
| name    | Change the display name of the bot account. |

You don't have to call them with any parameters!
After calling one of these commands, the next message you send will be used as input.

## Installing
- Clone the repository.
- Get an access token for your bot user (see [t2bot.io/docs/access_tokens/](https://t2bot.io/docs/access_tokens/)).
- Rename .env.example to .env and change the values.
- Run `npm install && npm build`.


|    npm run   |                   function                 |
| ------------ | ------------------------------------------ |
| start        | Run build/index.js                         |
| dev          | Run & watch app/index.ts                   |
| build        | Build app/ into build/                     |
| start-docker | Run the Dockerfile                         |
| dev-docker   | Build & run the Dockerfile                 |
| build-docker | Copy .env to .env.docker & build the image |

## Structure
- [app/](app/): Typescript code/src.
    - [@types/headless-mermaid](app/%40types/headless-mermaid/): type definition for the headless-mermaid api.
    - [commands/](app/commands/): the folder containing commands that can be used from the Matrix chat.
    - [utils/](app/utils/): functions used by the bot.
        - [client-setup](app/utils/client-setup.ts)
            1. Reads the .env file, either reading the access token or generating it from - and subsequently removing - the provided username/password.
            2. Sets up the Matrix client, including encryption, mixins, and the regex for when the bot is mentioned.
            3. Ties 1. & 2. together and returns the MatrixClient object.
            4. Additionally exposes onMessage, a function that can be used as an alternative to client.on('room.message'). Including automatic handling of multi message commands, returning extra variables like booleans about whether a message is an edit, and not responding to its own messages.
        - [env](app/utils/env.ts): (re)loads the .env file, and exposes getFromEnv, a function that returns environment variables but exits if undefined.
        - [globals](app/utils/globals.ts): defines globalThis types.
        - [logerror](app/utils/logerror.ts): exposes a simple function to be used with promises, e.g. `promise.then(()=>{...}).catch(logerror)`.
        - [multimessagecommands](app/utils/multimessagecommand.ts): adds support for multi message commmands. ![A screenshot of Element where a multi message command is displayed](assets/Screenshot-Multimessagecommands.png)
        - [sendImage](app/utils/sendImage.ts): exposes sendImage, a helper function that
            1. Automatically gets the image dimensions & size and sets it in the metadata.
            2. Converts the image to the passed mimetype.
            3. Uploads the image encrypted to Matrix.
            4. Easily allows the image to be used in a reply.
            5. In case of an SVG, generates a png thumbnail for increased compatibility.
    - [index](app/index.ts): runs the startClient from [client-setup](app/utils/client-setup.ts) and defines the commands to be run.
- [assets/](assets/): Images (and an image script) for use in the README.
- *build/*: Made during runtime. Compiled javascript code.
- *.env*: Manually made. Environment variables to use when running locally.
- *.env.docker* Manually made or generated from *.env*. Environment variables for use in Docker.


## Quirks
### SVG with a PNG preview
For one reason or the other, SVG's sent by the bot load forever.
As a workaround, a thumbnail/preview of the diagram gets rendered to PNG and attached to the message.

SVG's are really great. But also their implementation is weird. To give an example: Rocket.chat would preview SVG's on the desktop app and Chrome, but not on Firefox.

### Flowcharts don't render text unless specific settings are set
See the issue [here](https://github.com/mermaid-js/mermaid-cli/issues/112).

### USERNAME -> LOGINNAME
It seems weird to use this synonym for username while matrix tends to go for "username". Well, it turns out there is an environment variable on Windows called %USERNAME%, thus giving errors when this was run on Windows. Loginname it is!

#### Why remove the old images instead of replacing them?
Oh don't think I didn't try (see the replace-diagrams branch)! It's either not possible in Matrix, or I goofed something.

## License
This project is licensed under the [MIT License](LICENSE).


/help in profile section?
