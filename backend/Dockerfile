FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci

COPY . .

RUN npm run build

RUN ls -la && ls -la generated || echo "generated not found"
RUN cp -r generated dist/generated

EXPOSE 3001

CMD ["node", "dist/server.js"]