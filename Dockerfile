FROM node:18

WORKDIR /app

RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*


COPY app/ .
COPY build/ .
COPY package*.json ./
COPY tsconfig.json .
COPY .env.docker .env
# 
#COPY crypto/ .
#COPY bot.json .

RUN ["npm", "ci"]
RUN ["npm", "run", "build"]

CMD ["npm", "start"]
