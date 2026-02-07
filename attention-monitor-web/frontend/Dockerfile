# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx config template that uses PORT env var
RUN mkdir -p /etc/nginx/templates && \
    echo 'server { listen ${PORT}; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/templates/default.conf.template

# Create startup script to inject API_URL
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-inject-config.sh && \
    echo 'if [ -n "$API_URL" ]; then' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo '  sed -i "s|__API_URL__|$API_URL|g" /usr/share/nginx/html/config.js' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo 'fi' >> /docker-entrypoint.d/40-inject-config.sh && \
    chmod +x /docker-entrypoint.d/40-inject-config.sh

# Default values
ENV PORT=80
ENV API_URL=

CMD ["nginx", "-g", "daemon off;"]
