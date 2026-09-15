@echo off
chcp 65001 > nul
title Tool Tao Quizizz Tu File Word

echo ================================================================
echo   ỨNG DỤNG TẠO & LÀM BÀI TRẮC NGHIỆM TỪ FILE WORD (.DOCX)
echo ================================================================

REM 1. Kiểm tra xem Python đã được cài đặt chưa
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Máy tính chưa cài đặt Python hoặc chưa bật "Add python.exe to PATH"!
    echo Vui lòng tải và cài đặt Python từ: https://www.python.org/downloads/
    echo LƯU Ý QUAN TRỌNG: Khi cài đặt, hãy tích chọn ô "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

REM 2. Kiểm tra các thư viện bắt buộc, nếu thiếu thì tự động cài đặt
python -c "import fastapi, uvicorn, docx, multipart" > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [THÔNG BÁO] Phát hiện lần đầu khởi chạy, đang tự động cài đặt thư viện cần thiết...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [LỖI] Cài đặt thư viện thất bại! Vui lòng kiểm tra kết nối Internet.
        pause
        exit /b 1
    )
    echo [THÀNH CÔNG] Đã cài đặt xong tất cả thư viện!
)

REM 3. Khởi chạy ứng dụng
echo.
echo Đang mở ứng dụng tại: http://localhost:8000 ...
python run.py
pause
