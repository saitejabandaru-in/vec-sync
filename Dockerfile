# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY public ./public
LABEL org.opencontainers.image.source=https://github.com/saitejabandaru-in/vector-sync-engine
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
