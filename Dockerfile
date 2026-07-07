FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install

# Build shared package
COPY packages/shared ./packages/shared

# Build API
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api

# Run
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
