@echo off
echo Rebuilding web container on server...
set KEY=%USERPROFILE%\.ssh\id_ed25519_bhl
ssh -p 22 -i "%KEY%" -o StrictHostKeyChecking=no tungtranle@192.168.88.123 "export PATH=/Applications/Docker.app/Contents/Resources/bin:$PATH; cd ~/Projects/Beer-HL/bhl-oms && docker compose -f docker-compose.prod.yml --env-file .env.prod build web && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d web && echo REBUILD_OK"
pause
