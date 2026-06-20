FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir /app/database

COPY . /app

RUN npm install

EXPOSE 5000

CMD ["npm", "start"]