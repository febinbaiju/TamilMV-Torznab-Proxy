FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

RUN mkdir /app/database

COPY . /app

RUN npm install

EXPOSE 5000

CMD ["npm", "start"]