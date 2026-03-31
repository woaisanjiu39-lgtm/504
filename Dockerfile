FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5040

CMD ["node", "server.js"]
