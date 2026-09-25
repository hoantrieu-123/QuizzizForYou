@echo off
title Tool Tao Quizizz Tu File Word

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [LOI] May tinh chua cai dat Python hoac chua bat "Add python.exe to PATH"!
    echo Vui long tai va cai dat Python tu: https://www.python.org/downloads/
    echo LUU Y QUAN TRONG: Khi cai dat, hay tich chon o "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

python run.py
if %errorlevel% neq 0 (
    echo.
    echo Co loi xay ra khi khoi chay ung dung!
    pause
)
