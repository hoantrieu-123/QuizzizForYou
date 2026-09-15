# ỨNG DỤNG TẠO & LÀM BÀI TRẮC NGHIỆM TỪ FILE WORD (.DOCX)

Website chạy trên localhost cho phép tải file Word `.docx`, tự động phân tích cấu trúc XML và bóc tách thuộc tính **Highlight** (`<w:highlight w:val="..."/>`) để xác định chính xác đáp án đúng, tự động nhận diện 6 dạng câu hỏi và tạo thành bài kiểm tra tương tác.

---

## 🌟 Tính Năng Nổi Bật

### 1. Đọc Highlight Thật Sự Từ Mã XML Word (.docx)
- Không chỉ đọc text thông thường; đọc từng **Run** (`<w:r>`) và kiểm tra thuộc tính XML `<w:highlight w:val="..."/>`.
- Nhận diện mọi màu Highlight: `yellow`, `green`, `cyan`, `magenta`, `blue`, `red`, `lightGray`, v.v., và màu nền ô bảng biểu (`<w:shd>`).
- Phân biệt chính xác Highlight của câu hỏi vs Highlight của phương án trả lời.

### 2. Thứ Tự Ưu Tiên Xác Định Đáp Án Đúng
1. **Ưu tiên 1**: Thuộc tính Highlight trong Word (`highlight != 'none'`).
2. **Ưu tiên 2**: Dòng văn bản `Đáp án: A` (hoặc `Answer: A, B`) nếu không có Highlight.
3. **Ưu tiên 3**: Hiển thị cảnh báo `⚠ Không tìm thấy đáp án được Highlight` và cho phép giáo viên/người dùng chọn đáp án trực tiếp trên màn hình Xem trước (Preview).

### 3. Hỗ Trợ Đầy Đủ 6 Loại Câu Hỏi
1. **Chọn một đáp án (`single_choice`)**: Đúng 1 phương án được Highlight.
2. **Chọn nhiều đáp án (`multiple_choice`)**: Từ 2 phương án trở lên được Highlight.
3. **Đúng / Sai (`true_false`)**:
   - Câu đơn: 2 lựa chọn Đúng / Sai (hoặc True / False).
   - Câu chùm nhiều mệnh đề: Danh sách phát biểu con (1, 2, 3... hoặc a, b, c...), mỗi phát biểu có Đúng / Sai riêng được bôi Highlight.
4. **Điền từ vào chỗ trống (`fill_blank`)**: Câu hỏi có `___` hoặc `[...]` và từ đáp án đúng được Highlight ở dưới hoặc trong dòng đáp án.
5. **Kéo thả từ vào ô trống (`drag_drop_blank`)**: Điền nhiều vị trí trống `[ 1 ]`, `[ 2 ]` tương ứng với các từ trong ngân hàng từ vựng kéo thả.
6. **Kéo thả ghép đôi (`matching`)**: Bảng hoặc cặp thuật ngữ (cột trái) và định nghĩa tương ứng (cột phải).

### 4. Giao Diện Sáng (Light Theme) Hiện Đại & Trực Quan
- Gam màu chủ đạo: Trắng, Xám nhạt (`#f8fafc`), Xanh dương (`#2563eb`).
- **Màn hình Preview & Chỉnh sửa**: Hiển thị nhãn `✓ Đáp án được Highlight: [màu]`, cho phép sửa nội dung, chuyển đổi loại câu hỏi, chọn lại đáp án đúng.
- **Màn hình Làm bài tương tác**: Hỗ trợ đầy đủ tương tác kéo thả HTML5, chọn radio/checkbox, Đúng/Sai, bảng điều hướng 1..N câu hỏi, đồng hồ đếm giờ.
- **Màn hình Chấm điểm**: Tự động chấm điểm, hiển thị số điểm và đối chiếu chi tiết lựa chọn của bạn vs đáp án gốc từ Word.

---

## 🚀 Hướng Dẫn Khởi Chạy Trên Localhost

### Cách 1: Chạy bằng 1 click (Khuyên dùng trên Windows)
Nhấp đúp chuột vào file:
```
run.bat
```
Hoặc mở terminal tại thư mục dự án và chạy:
```bash
python run.py
```
> Trình duyệt sẽ tự động mở địa chỉ: **http://localhost:8000**

---

### Cách 2: Chạy riêng Backend & Frontend (Chế độ Lập trình)

1. **Khởi động Backend (FastAPI)**:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

2. **Khởi động Frontend (React + Vite)**:
```bash
cd frontend
npm run dev
```
> Mở trình duyệt tại: **http://localhost:5173** (Tự động proxy API sang port 8000).

---

##  Hướng Dẫn Chuyển Dự Án Sang Máy Khác (Setup Trên Máy Mới)

Nếu bạn gửi toàn bộ thư mục này sang một máy tính khác:

### 1. Máy tính mới cần cài gì?
- **CHỈ CẦN DUY NHẤT PYTHON 3.8+** (Khuyên dùng Python 3.10, 3.11 hoặc 3.12 từ [python.org](https://www.python.org/downloads/)).
  > ⚠️ **LƯU Ý CỰC KỲ QUAN TRỌNG:** Khi cài đặt Python trên Windows, tại màn hình đầu tiên nhớ **tích chọn vào ô: `☑ Add python.exe to PATH`**.
- **KHÔNG CẦN CÀI NODE.JS** vì thư mục `frontend/dist` đã được biên dịch sẵn toàn bộ mã giao diện web.

### 2. Mẹo nén file gửi đi siêu nhẹ (~1MB):
- Trước khi nén thành file `.zip` để gửi, bạn có thể **xóa thư mục `frontend/node_modules`** (thư mục này nặng gần 100MB và không cần thiết để chạy web).

### 3. Cách khởi chạy trên máy mới:
- **Cách nhanh nhất (Tự động 100%):**
  Nhấp đúp chuột vào file:
  ```
  run.bat
  ```
  *File `run.bat` đã được lập trình thông minh: Nó sẽ tự kiểm tra các thư viện, tự động cài đặt `requirements.txt` lần đầu, sau đó bật server và mở trình duyệt `http://localhost:8000`.*

- **Cách chạy bằng dòng lệnh (CMD / PowerShell):**
  1. Mở cửa sổ CMD/PowerShell trong thư mục dự án.
  2. Cài thư viện:
     ```bash
     pip install -r requirements.txt
     ```
  3. Khởi chạy:
     ```bash
     python run.py
     ```



