FROM node:18 AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

FROM node:18 AS backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server ./

FROM node:18
WORKDIR /app
COPY --from=frontend /app/client/build ./client/build
COPY --from=backend /app/server ./server
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "index.js"]
