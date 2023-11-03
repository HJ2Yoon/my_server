FROM node:20.9.0

RUN apt-get update && \
    apt-get install -y curl && \
    apt-get install unzip 

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    sudo ./aws/install && \
    rm awscliv2.zip 

RUN npm install
RUN npm i pm2 -g

WORKDIR /usr/src/app
COPY package*.json .
COPY . .
EXPOSE 8000
CMD ["pm2-runtime", "app.js"]