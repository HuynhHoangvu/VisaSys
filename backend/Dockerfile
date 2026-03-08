FROM node:22-alpine

WORKDIR /app

# Copy các file cấu hình package và prisma trước để tận dụng Docker cache
COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt toàn bộ dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy toàn bộ source code vào container
COPY . .

# BIÊN DỊCH CODE: Chạy lệnh build (tsc) để tạo ra thư mục dist/
RUN npm run build

EXPOSE 3001

# CHẠY APP: Dùng npm start (tương đương node dist/server.js)
CMD ["npm", "start"]