FROM node:20-slim

ENV NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir /app/database

COPY . /app

RUN npm install

EXPOSE 5000

CMD ["npm", "start"]