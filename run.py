"""
Launcher script for Docx Quiz Application
Starts FastAPI server on http://localhost:8000 and automatically opens the browser.
"""
import sys
import os
import subprocess
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

def ensure_dependencies():
    """Check required dependencies and install them if missing."""
    needed = False
    try:
        import fastapi
        import uvicorn
        import docx
        import multipart
    except ImportError:
        needed = True

    if needed:
        print("\n[THÔNG BÁO] Phát hiện lần đầu khởi chạy, đang tự động cài đặt thư viện cần thiết...")
        req_file = os.path.join(os.path.dirname(__file__), "requirements.txt")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file])
            print("[THÀNH CÔNG] Đã cài đặt xong tất cả thư viện!\n")
        except Exception as e:
            print(f"[LỖI] Cài đặt thư viện thất bại: {e}")
            print("Vui lòng kiểm tra kết nối mạng và thử lại.")
            sys.exit(1)

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    ensure_dependencies()
    import uvicorn

    print("=" * 65)
    print("  ỨNG DỤNG TẠO & LÀM BÀI TRẮC NGHIỆM TỪ FILE WORD (.DOCX)")
    print("  - Tự động nhận diện thẻ XML Highlight (<w:highlight>)")
    print("  - Hỗ trợ 6 dạng câu hỏi: Chọn 1, Chọn nhiều, Đúng/Sai,")
    print("    Điền từ, Kéo thả ô trống, Ghép đôi (Matching)")
    print("  - Địa chỉ Website: http://localhost:8000")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
