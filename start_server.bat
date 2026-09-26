@echo off
echo ========================================================
echo Starting SINA Admin Portal Website Server...
echo ========================================================
echo Opening SINA Admin Portal in your default web browser...
start http://localhost:8080/index.html
python -m http.server 8080
pause
