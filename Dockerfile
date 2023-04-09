FROM node:19

WORKDIR /app

RUN mkdir /app/database

COPY . /app

RUN npm install

EXPOSE 5000

CMD ["npm", "start"]

