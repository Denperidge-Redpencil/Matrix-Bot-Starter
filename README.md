# Mermatrix

Mermaid.js doesn't render automatically in Matrix. Lets fix that!
When a message contains a mermaid code block, the bot will return that very diagram.

Functionality:
- On new message, render the diagram(s) to svg.
- Render multiple diagrams from one message. (TODO)
- When a message with a rendering attached to it gets edited, re-render. (TODO)

## Installing
- Clone the repository.
- Get an access token for your bot user (see [t2bot.io/docs/access_tokens/](https://t2bot.io/docs/access_tokens/)).
- Rename .env.example to .env and change the values.
- Run `npm install` & `npm start`.

## Quirks
### SVG with a PNG preview
For one reason or the other, SVG's sent by the bot load forever.
As a workaround, a thumbnail/preview of the diagram gets rendered to PNG and attached to the message.

SVG's are really great. But also their implementation is weird. To give an example: Rocket.chat would preview SVG's on the desktop app and Chrome, but not on Firefox.

### Flowcharts don't render text unless specific settings are set
See the issue [here](https://github.com/mermaid-js/mermaid-cli/issues/112).


### USERNAME -> LOGINNAME
It seems weird to use this synonym for username while matrix tends to go for "username". Well, it turns out there is an environment variable on Windows called %USERNAME%, thus giving errors when this was run on Windows. Loginname it is!


## License
This project is licensed under the [MIT License](LICENSE).


/help in profile section?
