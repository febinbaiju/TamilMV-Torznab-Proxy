FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

RUN mkdir /app/database

COPY . /app

RUN npm install

ENV NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"

EXPOSE 5000

CMD ["npm", "start"]