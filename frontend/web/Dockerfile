# Gebruik de Nginx image
FROM nginx:alpine

# Installeer envsubst (voor het vervangen van variabelen in bestanden)
RUN apk add --no-cache gettext

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY firebase-init.js /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Kopieer het template bestand voor config.js
COPY config.template.js /usr/share/nginx/html/config.template.js

# Genereer het config.js bestand bij container startup
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'"]
