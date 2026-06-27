#!/bin/bash
cd /home/root/p2p-sport/sport-app
git pull origin main
npm run build
pm2 restart sport-app
echo "Deploy OK — $(date)"
