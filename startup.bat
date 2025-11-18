@echo off
title 启动器
echo 正在启动Python后端服务...

start "Python Backend" python app.py

echo.
echo 等待后端服务启动 (5秒)...

timeout /t 5 /nobreak > nul

echo.
echo 正在使用默认浏览器打开服务地址...

start "" "http://127.0.0.1:5000"

echo.
echo 启动脚本执行完毕。
echo 后端服务正在后台运行。
echo 如果浏览器没有自动打开，请手动在浏览器中访问: http://127.0.0.1:5000
echo.
