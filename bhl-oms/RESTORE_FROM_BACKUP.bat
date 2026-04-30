@echo off
echo === Restore BHL OMS from backup 25/4/2026 ===
echo.
echo Script nay se:
echo  1. Xoa database hien tai (demo data)
echo  2. Restore data that tu backup ngay 25/4/2026
echo  3. Chay migration moi (041, 042, 043)
echo  4. Bat tat ca AI feature flags
echo.
echo Can quyen Administrator de chay!
echo.
PowerShell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File \"%~dp0RESTORE_FROM_BACKUP.ps1\"' -Verb RunAs"
