#!/bin/sh
set -e

echo "[docker] Starting migrations..."
npx prisma migrate deploy
echo "[docker] Migrations complete."

echo "[docker] Starting server..."
npm start
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "[docker] Server exited with code $EXIT_CODE" >&2
  exit $EXIT_CODE
fi
