FROM node:14-alpine
WORKDIR /Users/vn55pko/workflow1/testing-wrokflow
COPY package.json ./
RUN npm config set registry http://registry.npmjs.org/ 
RUN npm install  --silent --only=production 
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
