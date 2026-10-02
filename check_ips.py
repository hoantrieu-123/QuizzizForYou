#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Công cụ kiểm tra Nhật ký IP truy cập Website (Private Admin CLI)
Hỗ trợ kết nối trực tiếp tới Turso Cloud Database hoặc SQLite nội bộ.
Chỉ chạy trên máy tính cá nhân của bạn - Hoàn toàn bảo mật và riêng tư 100%!
"""

import os
import sys
import json
import sqlite3
from datetime import datetime

# UTF-8 encoding support for Windows Console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".turso_config.json")
LOCAL_DB = os.path.join(os.path.dirname(__file__), "backend", "quizizz.db")

def load_turso_config():
    """Load Turso credentials from environment or local config file."""
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

    if (not url or not token) and os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                url = url or cfg.get("TURSO_DATABASE_URL", "").strip()
                token = token or cfg.get("TURSO_AUTH_TOKEN", "").strip()
        except Exception:
            pass

    return url, token

def save_turso_config(url, token):
    """Save Turso credentials locally so user only enters once."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"TURSO_DATABASE_URL": url, "TURSO_AUTH_TOKEN": token}, f, indent=2)
        print("[THÀNH CÔNG] Đã lưu thông tin cấu hình Turso vào máy của bạn!")
    except Exception as e:
        print(f"[CẢNH BÁO] Không thể lưu file cấu hình: {e}")

def get_db_connection():
    """Establish connection to Turso Cloud or fallback to local SQLite."""
    url, token = load_turso_config()

    if url and token and HAS_LIBSQL:
        try:
            conn = libsql.connect(database=url, auth_token=token)
            return conn, f"Cloud Turso ({url.split('@')[-1].split('//')[-1]})"
        except Exception as e:
            print(f"[LỖI] Kết nối Turso thất bại: {e}")
            print("[THÔNG BÁO] Đang chuyển sang đọc database nội bộ...")

    if os.path.exists(LOCAL_DB):
        conn = sqlite3.connect(LOCAL_DB)
        conn.row_factory = sqlite3.Row
        return conn, f"SQLite Nội Bộ ({LOCAL_DB})"

    return None, "Không tìm thấy cơ sở dữ liệu"

def parse_user_agent(ua):
    """Simplify User-Agent for compact console display."""
    if not ua:
        return "Không rõ"
    l = ua.lower()
    os_name = "Khác"
    if "windows" in l: os_name = "Windows"
    elif "android" in l: os_name = "Android"
    elif "iphone" in l or "ipad" in l: os_name = "iOS"
    elif "macintosh" in l or "mac os" in l: os_name = "macOS"
    elif "linux" in l: os_name = "Linux"

    browser = ""
    if "edg/" in l: browser = "Edge"
    elif "chrome/" in l: browser = "Chrome"
    elif "safari/" in l and "chrome" not in l: browser = "Safari"
    elif "firefox/" in l: browser = "Firefox"
    elif "coccoc" in l: browser = "CốcCốc"

    return f"{os_name} · {browser}" if browser else os_name

def format_time(ts_str):
    """Format timestamp string into readable local VN time."""
    if not ts_str:
        return ""
    try:
        clean = ts_str.replace("T", " ").split(".")[0]
        return clean
    except Exception:
        return ts_str

def view_recent_logs(limit=30):
    """Display the latest visitor logs in a clean console table."""
    conn, db_name = get_db_connection()
    if not conn:
        print("[LỖI] Không thể kết nối cơ sở dữ liệu.")
        return

    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM visitor_logs")
        total_visits = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT ip_address) FROM visitor_logs")
        unique_ips = cursor.fetchone()[0]

        cursor.execute("""
            SELECT ip_address, country, method, path, user_agent, status_code, created_at 
            FROM visitor_logs 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
    except Exception as e:
        print(f"[LỖI] Không thể đọc bảng visitor_logs: {e}")
        conn.close()
        return

    print("\n" + "=" * 95)
    print(f"  NHẬT KÝ IP TRUY CẬP WEBSITE (PRIVATE ADMIN TOOL)")
    print(f"  Cơ sở dữ liệu: {db_name}")
    print(f"  Tổng lượt truy cập: {total_visits}  |  Số IP duy nhất: {unique_ips}")
    print("=" * 95)

    if not rows:
        print("  Chưa có dữ liệu truy cập nào được ghi nhận.")
        print("=" * 95)
        conn.close()
        return

    print(f"| {'THỜI GIAN':<19} | {'ĐỊA CHỈ IP':<18} | {'Q.GIA':<6} | {'P.THỨC':<6} | {'ĐƯỜNG DẪN / THAO TÁC':<22} | {'THIẾT BỊ':<16} |")
    print("-" * 95)

    for r in rows:
        # Support both tuple index and dict/Row
        ip = r[0] if isinstance(r, (tuple, list)) else r["ip_address"]
        country = (r[1] or "--") if isinstance(r, (tuple, list)) else (r["country"] or "--")
        method = r[2] if isinstance(r, (tuple, list)) else r["method"]
        path = r[3] if isinstance(r, (tuple, list)) else r["path"]
        ua = r[4] if isinstance(r, (tuple, list)) else r["user_agent"]
        time_str = r[6] if isinstance(r, (tuple, list)) else r["created_at"]

        clean_path = path if len(path) <= 22 else path[:19] + "..."
        device = parse_user_agent(ua)
        device = device if len(device) <= 16 else device[:13] + "..."

        print(f"| {format_time(time_str):<19} | {ip:<18} | {country:<6} | {method:<6} | {clean_path:<22} | {device:<16} |")

    print("=" * 95 + "\n")
    conn.close()

def view_top_ips():
    """Display IP ranking by number of visits."""
    conn, db_name = get_db_connection()
    if not conn:
        print("[LỖI] Không thể kết nối cơ sở dữ liệu.")
        return

    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT ip_address, country, COUNT(*) as visit_count, MAX(created_at) as last_seen 
            FROM visitor_logs 
            GROUP BY ip_address 
            ORDER BY visit_count DESC 
            LIMIT 20
        """)
        rows = cursor.fetchall()
    except Exception as e:
        print(f"[LỖI] Truy vấn thất bại: {e}")
        conn.close()
        return

    print("\n" + "=" * 75)
    print(f"  BẢNG XẾP HẠNG IP TRUY CẬP NHIỀU NHẤT ({db_name})")
    print("=" * 75)
    print(f"| {'TOP':<4} | {'ĐỊA CHỈ IP':<18} | {'Q.GIA':<6} | {'SỐ LƯỢT VÀO':<12} | {'LẦN CUỐI CÙNG':<19} |")
    print("-" * 75)

    for idx, r in enumerate(rows, start=1):
        ip = r[0] if isinstance(r, (tuple, list)) else r["ip_address"]
        country = (r[1] or "--") if isinstance(r, (tuple, list)) else (r["country"] or "--")
        count = r[2] if isinstance(r, (tuple, list)) else r["visit_count"]
        last_seen = r[3] if isinstance(r, (tuple, list)) else r["last_seen"]

        print(f"| {idx:<4} | {ip:<18} | {country:<6} | {count:<12} | {format_time(last_seen):<19} |")

    print("=" * 75 + "\n")
    conn.close()

def clear_logs_action():
    """Prompt and clear all logs from database."""
    confirm = input("\n[CẢNH BÁO] Bạn có chắc chắn muốn xóa TOÀN BỘ nhật ký IP? (nhập 'yes' để xác nhận): ")
    if confirm.strip().lower() != "yes":
        print("[HỦY BỎ] Thao tác xóa đã bị hủy.")
        return

    conn, db_name = get_db_connection()
    if not conn:
        return
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM visitor_logs")
        conn.commit()
        print(f"[THÀNH CÔNG] Đã xóa toàn bộ nhật ký IP trên {db_name}!")
    except Exception as e:
        print(f"[LỖI] Không thể xóa: {e}")
    finally:
        conn.close()

def configure_turso():
    """Prompt user to set Turso Database URL and Auth Token."""
    print("\n" + "=" * 65)
    print("  CẤU HÌNH KẾT NỐI TURSO CLOUD DATABASE")
    print("=" * 65)
    curr_url, curr_token = load_turso_config()
    if curr_url:
        print(f"URL hiện tại: {curr_url}")

    url = input("Nhập Turso Database URL (bỏ trống để giữ nguyên): ").strip()
    token = input("Nhập Turso Auth Token (bỏ trống để giữ nguyên): ").strip()

    final_url = url or curr_url
    final_token = token or curr_token

    if final_url and final_token:
        save_turso_config(final_url, final_token)
    else:
        print("[LỖI] URL hoặc Token không được để trống!")

def main():
    while True:
        print("\n" + "=" * 50)
        print("  QUẢN LÝ NHẬT KÝ IP WEBSITE (PRIVATE CLI)")
        print("=" * 50)
        print("  1. Xem 30 lượt truy cập gần nhất")
        print("  2. Xem 100 lượt truy cập gần nhất")
        print("  3. Xem bảng xếp hạng các IP vào nhiều nhất")
        print("  4. Cấu hình kết nối Turso Cloud")
        print("  5. Xóa toàn bộ nhật ký IP")
        print("  0. Thoát")
        print("-" * 50)

        choice = input("Chọn chức năng (0-5) [Mặc định: 1]: ").strip()
        if choice in ("", "1"):
            view_recent_logs(limit=30)
        elif choice == "2":
            view_recent_logs(limit=100)
        elif choice == "3":
            view_top_ips()
        elif choice == "4":
            configure_turso()
        elif choice == "5":
            clear_logs_action()
        elif choice == "0":
            print("\nTạm biệt!")
            break
        else:
            print("[LỖI] Lựa chọn không hợp lệ, vui lòng chọn lại.")

if __name__ == "__main__":
    # If passed an argument like `python check_ips.py --top`
    if len(sys.argv) > 1 and sys.argv[1] == "--top":
        view_top_ips()
    else:
        # Default run: Show recent logs directly, then prompt if in interactive shell
        view_recent_logs(limit=30)
        if sys.stdin.isatty():
            main()
