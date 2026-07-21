#!/bin/sh
set -eu

mkdir -p /app/data

# When started as root (Docker Compose), fix volume ownership then drop privileges.
# When started as uid 1001 (Kubernetes securityContext), just run the server.
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /app/data || true
  chmod 775 /app/data || true
  exec su -s /bin/sh nextjs -c "node server.js"
fi

exec node server.js
