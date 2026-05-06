FROM node:22-alpine

WORKDIR /app

# Cài đặt build tools, Python, pip và các thư viện cần cho reportlab (xử lý ảnh, font)
RUN apk add --no-cache build-base python3 py3-pip jpeg-dev zlib-dev freetype-dev ttf-dejavu

# Cài reportlab (--break-system-packages cần thiết trên Alpine mới)
RUN pip3 install reportlab openpyxl --break-system-packages

# Copy package.json và package-lock.json trước để tận dụng cache Docker
COPY package*.json ./
COPY prisma ./prisma/

# Cài dependencies Node
RUN npm install

# Copy toàn bộ mã nguồn (bao gồm src/scripts/gen_salary.py)
COPY . .

# Build ứng dụng TypeScript (nếu cần) và generate Prisma client
RUN npm run build && npx prisma generate

EXPOSE 3001

# Áp dụng migration SQL đã commit (đồng bộ DB với schema — tránh lệch cột production).
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]