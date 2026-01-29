#!/bin/bash
# Kill zombie processes on dev ports
# Run this before starting dev servers if you encounter EADDRINUSE errors

# Default ports:
# - 3000: Web (TanStack Router)
# - 3210: Convex
PORTS=(3000 3210)

echo "🔍 Checking for processes on dev ports..."

killed=0
for port in "${PORTS[@]}"; do
  pid=$(lsof -t -i ":$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "   Port $port: killing PID $pid"
    kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
    ((killed++))
  fi
done

if [ $killed -eq 0 ]; then
  echo "✅ No zombie processes found"
else
  echo "✅ Killed $killed process(es)"
fi
