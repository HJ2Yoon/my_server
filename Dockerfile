FROM node:20.9.0
WORKDIR /usr/src/app
COPY package*.json .
RUN npm install
RUN npm i pm2 -g
COPY . .
EXPOSE 3000
CMD ["pm2-runtime", "app.js"]