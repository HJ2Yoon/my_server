From ubuntu:20.04
RUN sudo apt update
RUN sudo apt-get install -y curl
RUN sudo apt install nodejs npm
RUN sudo apt-get install -y python3-pip 
RUN pip3 install awscli 
RUN npm install
RUN npm i pm2 -g
WORKDIR /usr/src/app
COPY package*.json .
COPY . .
EXPOSE 8000
CMD ["pm2-runtime", "app.js"]