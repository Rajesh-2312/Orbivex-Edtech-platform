FROM node:20-alpine

WORKDIR /app

# Works whether Docker context is backend/ (local compose) or repo root (Railway)
COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ .

EXPOSE 3001

CMD ["node", "server.js"]
