# Step 1: Build the React SPA
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies in a cached layer
COPY package*.json ./
RUN npm ci

# Copy full source and build
COPY . .
RUN npm run build

# Step 2: Serve using high-performance Nginx
FROM nginx:alpine

# Copy static assets from build step
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config template with PORT placeholder
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Cloud Run defaults port to 8080 or sets dynamic PORT env
ENV PORT=8080
EXPOSE 8080

# The default nginx entrypoint includes a template parser (envsubst)
# which replaces ${PORT} in /etc/nginx/templates/default.conf.template
# and writes it into /etc/nginx/conf.d/default.conf at container startup.
