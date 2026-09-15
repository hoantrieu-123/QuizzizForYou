"""
Launcher script for Docx Quiz Application
Starts FastAPI server on http://localhost:8000 and automatically opens the browser.
"""
import sys
import os
import webbrowser
import threading
import time

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://localhost:8000")


if __name__ == "__main__":
    import uvicorn

    print("=" * 65)
    print("  ỨNG DỤNG TẠO & LÀM BÀI TRẮC NGHIỆM TỪ FILE WORD (.DOCX)")
    print("  - Tự động nhận diện thẻ XML Highlight (<w:highlight>)")
    print("  - Hỗ trợ 6 dạng câu hỏi: Chọn 1, Chọn nhiều, Đúng/Sai,")
    print("    Điền từ, Kéo thả ô trống, Ghép đôi (Matching)")
    print("  - Địa chỉ Website: http://localhost:8000")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)

