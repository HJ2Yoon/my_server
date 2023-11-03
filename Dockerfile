From ubuntu:20.04
RUN apt-get -qq update
RUN apt-get -qq upgrade --yes 
RUN apt-get -qq install curl --yes
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get -qq install nodejs --yes
RUN apt-get install -y python3-pip 
RUN pip3 install awscli 
RUN npm install
RUN npm i pm2 -g
WORKDIR /usr/src/app
COPY package*.json .
COPY . .
EXPOSE 8000
CMD ["pm2-runtime", "app.js"]