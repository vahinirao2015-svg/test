#!/bin/sh
set -eu

# Named volumes are often root-owned on first mount; ensure the app user can write SQLite.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data || true
chmod 775 /app/data || true

exec su -s /bin/sh nextjs -c "node server.js"
