FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN cd server && npm install --workspaces=false --no-audit --no-fund
RUN cd client && npm install --workspaces=false --no-audit --no-fund

COPY server ./server
COPY client ./client

RUN cd client && npm run build

WORKDIR /app/server
ENV PORT=5000
EXPOSE 5000
CMD ["sh", "-c", "node src/scripts/wait-for-db.js && npm run db:init && npm start"]