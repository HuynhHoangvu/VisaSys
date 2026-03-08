FROM node:22-alpine
WORKDIR /app

# Cài đặt các công cụ cần thiết để build Prisma (nếu cần)
RUN alpine-sdk

COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ code nguồn
COPY . .

# Mở cổng 3001
EXPOSE 3001

# Lệnh chạy chính thức
CMD ["npm", "start"]