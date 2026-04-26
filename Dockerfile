FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3002
CMD ["node", "dist/main"]
