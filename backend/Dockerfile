FROM node:22-alpine
WORKDIR /app

# Cài đặt công cụ build
RUN apk add --no-cache build-base

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Mở cổng 3001
EXPOSE 3001

# Lệnh chạy chính thức bằng tsx cho đúng chuẩn Prisma v7
CMD ["npm", "start"]