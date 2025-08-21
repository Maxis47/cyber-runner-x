FROM node:20-alpine

# Workdir hanya backend
WORKDIR /app

# Install deps dari server/package.json
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy sisa kode server
COPY . .

# Bind ke host/port yang benar
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Jalankan server
CMD ["node","server.js"]
