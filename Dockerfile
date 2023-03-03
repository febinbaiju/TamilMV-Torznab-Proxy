FROM node:19

WORKDIR /app

COPY . /app

RUN npm install

EXPOSE 5000

CMD ["npm", "start"]

