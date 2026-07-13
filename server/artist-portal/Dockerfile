FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_PUBLIC_API_URL=http://localhost:8080
ENV VITE_PUBLIC_API_URL=$VITE_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/build ./build
COPY package*.json ./
RUN npm ci --omit=dev
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
