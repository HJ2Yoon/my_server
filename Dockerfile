FROM node:20.9.0
FROM amazon/aws-cli
RUN apt-get install -y python3-pip 
RUN pip3 install awscli 
RUN npm install
RUN npm i pm2 -g
WORKDIR /usr/src/app
COPY package*.json .
COPY . .
EXPOSE 8000
CMD ["pm2-runtime", "app.js"]