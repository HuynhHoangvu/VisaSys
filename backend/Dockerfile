FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Generate prisma client
RUN npx prisma generate

COPY . .

EXPOSE 3001

# Chạy thẳng TypeScript bằng tsx, không cần build dist
CMD ["npx", "tsx", "src/server.ts"]