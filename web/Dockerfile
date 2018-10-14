FROM node:10.12

WORKDIR /opt/web

ADD package.json ./
RUN npm i

COPY app.js ./
COPY index.html ./

CMD npm start
