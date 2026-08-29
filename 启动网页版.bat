@echo off
chcp 65001 >nul
title 小说工坊 - 网页版
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo 尚未构建网页资源，正在执行 npm run build ...
  call npm run build
)
echo 正在启动小说工坊（网页版）...
node server.mjs --open
pause
