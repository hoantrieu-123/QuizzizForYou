"""
Comprehensive Word (.docx) Sample Generator for WordQuiz Tool
Generates a complete, beautifully-formatted Word document demonstrating ALL supported question formats:
1. Single Choice (Standard A, B, C, D)
2. Single Choice (Table 2x2 layout)
3. Multiple Choice (Multiple highlights)
4. True / False (Single question)
5. True / False (Multi-statement bundle a, b, c, d)
6. Fill in the Blank (Single slot with answer key)
7. Drag & Drop into Blanks (Numbered slots 1, 2, 3 with highlighted word bank)
8. Matching Pairs (2-column Table layout)
9. Matching Pairs (Arrow notation Left -> Right)
10. Fallback detection with 'Đáp án: C' (Un-highlighted fallback)
"""
import os
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls


def add_highlight_to_run(run, color_val="yellow"):
    """Explicitly inject <w:highlight w:val="..."/> into a run's XML."""
    rPr = run._r.get_or_add_rPr()
    for child in list(rPr):
        if child.tag.endswith('highlight'):
            rPr.remove(child)
    hl = OxmlElement('w:highlight')
    hl.set(qn('w:val'), color_val)
    rPr.append(hl)


def set_cell_background(cell, fill_hex):
    """Set shading background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag.endswith('shd'):
            tcPr.remove(child)
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Set cell padding in twentieths of a point (dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)


def create_comprehensive_docx(output_path: str) -> str:
    doc = docx.Document()

    # Page setup - Standard A4 with 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Base Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

    # =========================================================================
    # DOCUMENT HEADER
    # =========================================================================
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("TÀI LIỆU MẪU CÁC ĐỊNH DẠNG CÂU HỎI TRẮC NGHIỆM")
    title_run.font.size = Pt(17)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x1D, 0x4E, 0xD8)

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run("Chuẩn định dạng Highlight XML & Cấu trúc tương thích 100% với Tool Quizizz")
    sub_run.font.size = Pt(11)
    sub_run.font.italic = True
    sub_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    # Guide Box
    guide_table = doc.add_table(rows=1, cols=1)
    guide_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = guide_table.rows[0].cells[0]
    set_cell_background(cell, "EFF6FF")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)

    p_guide = cell.paragraphs[0]
    p_guide.paragraph_format.space_after = Pt(4)
    r1 = p_guide.add_run("📌 HƯỚNG DẪN DÀNH CHO GIÁO VIÊN & NGƯỜI SOẠN ĐỀ:")
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)

    bullets = [
        "1. Cách đánh dấu đáp án đúng: Dùng công cụ Text Highlight Color trên thanh công cụ Word (màu Vàng, Xanh lá, Cyan...).",
        "2. Nhận diện tự động: Hệ thống đọc trực tiếp mã XML gốc (<w:highlight>), không lo lệch font hay định dạng.",
        "3. Đa dạng 6 loại câu hỏi: Chọn 1, Chọn nhiều, Đúng/Sai, Điền từ, Kéo thả ô trống, Ghép đôi (Matching).",
        "4. Tự động sửa & bổ sung: Sau khi tải file lên, bạn hoàn toàn có thể thêm đáp án mới (E, F...) và sửa chữ tùy ý.",
        "5. Câu hỏi & Đáp án nhiều dòng: Hỗ trợ đoạn mã lập trình (Code), văn bản xuống hàng trong cả đề bài và các phương án A, B, C, D."
    ]
    for b in bullets:
        p_b = cell.add_paragraph()
        p_b.paragraph_format.space_after = Pt(2)
        r_b = p_b.add_run(b)
        r_b.font.size = Pt(10)
        r_b.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    def add_section_header(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(title_text)
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    # =========================================================================
    # DẠNG 1: CHỌN MỘT ĐÁP ÁN (SINGLE CHOICE)
    # =========================================================================
    add_section_header("I. Dạng 1: Trắc nghiệm Chọn một đáp án đúng (Single Choice)")

    # Câu 1: Dạng danh sách dòng tiêu chuẩn
    p_q1 = doc.add_paragraph()
    r = p_q1.add_run("Câu 1: ")
    r.font.bold = True
    p_q1.add_run("Giao thức mạng nào sau đây được sử dụng để truyền tải dữ liệu web an toàn có mã hóa?")

    opts_1 = [
        ("A. HTTP", False),
        ("B. HTTPS", True),
        ("C. FTP", False),
        ("D. SMTP", False)
    ]
    for opt_text, is_correct in opts_1:
        p_opt = doc.add_paragraph()
        p_opt.paragraph_format.left_indent = Inches(0.25)
        p_opt.paragraph_format.space_after = Pt(3)
        r_opt = p_opt.add_run(opt_text)
        if is_correct:
            add_highlight_to_run(r_opt, "yellow")

    # Câu 2: Dạng bảng 2x2 (Rất phổ biến trong đề thi ĐH/CĐ/ASP.NET)
    p_q2 = doc.add_paragraph()
    p_q2.paragraph_format.space_before = Pt(8)
    r = p_q2.add_run("Câu 2: ")
    r.font.bold = True
    p_q2.add_run("Trong kiến trúc MVC, thành phần nào giữ nhiệm vụ tiếp nhận yêu cầu từ người dùng và điều phối luồng dữ liệu?")

    tbl_q2 = doc.add_table(rows=2, cols=2)
    tbl_q2.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_q2_opts = [
        [("A. Model", False), ("B. View", False)],
        [("C. Controller", True), ("D. Database", False)]
    ]
    for row_idx, row_data in enumerate(tbl_q2_opts):
        for col_idx, (opt_text, is_correct) in enumerate(row_data):
            cell_ij = tbl_q2.rows[row_idx].cells[col_idx]
            set_cell_margins(cell_ij, top=60, bottom=60, left=100, right=100)
            p_ij = cell_ij.paragraphs[0]
            r_ij = p_ij.add_run(opt_text)
            if is_correct:
                add_highlight_to_run(r_ij, "yellow")

    # =========================================================================
    # DẠNG 2: CHỌN NHIỀU ĐÁP ÁN (MULTIPLE CHOICE)
    # =========================================================================
    add_section_header("II. Dạng 2: Trắc nghiệm Chọn nhiều đáp án đúng (Multiple Choice)")

    p_q3 = doc.add_paragraph()
    r = p_q3.add_run("Câu 3: ")
    r.font.bold = True
    p_q3.add_run("Những ngôn ngữ nào sau đây thường được biên dịch hoặc thực thi phía máy chủ (Back-end)? (Chọn các đáp án đúng)")

    opts_3 = [
        ("A. Python", True),
        ("B. C# (.NET)", True),
        ("C. Java", True),
        ("D. CSS", False)
    ]
    for opt_text, is_correct in opts_3:
        p_opt = doc.add_paragraph()
        p_opt.paragraph_format.left_indent = Inches(0.25)
        p_opt.paragraph_format.space_after = Pt(3)
        r_opt = p_opt.add_run(opt_text)
        if is_correct:
            add_highlight_to_run(r_opt, "green")

    # =========================================================================
    # DẠNG 3: ĐÚNG / SAI DẠNG ĐƠN (TRUE / FALSE SINGLE)
    # =========================================================================
    add_section_header("III. Dạng 3: Câu hỏi Đúng / Sai đơn lẻ")

    p_q4 = doc.add_paragraph()
    r = p_q4.add_run("Câu 4: ")
    r.font.bold = True
    p_q4.add_run("RESTful API chỉ có thể sử dụng định dạng JSON để truyền dữ liệu và không thể hỗ trợ XML.")

    opts_4 = [
        ("A. Đúng", False),
        ("B. Sai", True)
    ]
    for opt_text, is_correct in opts_4:
        p_opt = doc.add_paragraph()
        p_opt.paragraph_format.left_indent = Inches(0.25)
        p_opt.paragraph_format.space_after = Pt(3)
        r_opt = p_opt.add_run(opt_text)
        if is_correct:
            add_highlight_to_run(r_opt, "yellow")

    # =========================================================================
    # DẠNG 4: CHÙM ĐÚNG / SAI NHIỀU MỆNH ĐỀ (TRUE / FALSE MULTI-STATEMENT)
    # =========================================================================
    add_section_header("IV. Dạng 4: Chùm Đúng / Sai nhiều mệnh đề (Từng mệnh đề có Đúng/Sai)")

    p_q5 = doc.add_paragraph()
    r = p_q5.add_run("Câu 5: ")
    r.font.bold = True
    p_q5.add_run("Xét tính Đúng hoặc Sai của các phát biểu sau về cơ sở dữ liệu quan hệ (RDBMS):")

    statements = [
        ("a. Khóa chính (Primary Key) của một bảng không được phép chứa giá trị NULL.", "Đúng"),
        ("b. Một bảng trong cơ sở dữ liệu có thể có nhiều Khóa chính độc lập.", "Sai"),
        ("c. Khóa ngoại (Foreign Key) dùng để thiết lập mối quan hệ giữa hai bảng.", "Đúng"),
        ("d. Câu lệnh DROP TABLE chỉ xóa dữ liệu bên trong mà vẫn giữ lại cấu trúc bảng.", "Sai")
    ]
    for st_label_text, correct_val in statements:
        p_st = doc.add_paragraph()
        p_st.paragraph_format.left_indent = Inches(0.2)
        p_st.paragraph_format.space_after = Pt(2)
        p_st.add_run(st_label_text)

        p_choice = doc.add_paragraph()
        p_choice.paragraph_format.left_indent = Inches(0.4)
        p_choice.paragraph_format.space_after = Pt(4)

        if correct_val == "Đúng":
            r_d = p_choice.add_run("Đúng")
            add_highlight_to_run(r_d, "cyan")
            p_choice.add_run("  /  Sai")
        else:
            p_choice.add_run("Đúng  /  ")
            r_s = p_choice.add_run("Sai")
            add_highlight_to_run(r_s, "cyan")

    # =========================================================================
    # DẠNG 5: ĐIỀN TỪ VÀO CHỖ TRỐNG (FILL IN THE BLANK)
    # =========================================================================
    add_section_header("V. Dạng 5: Điền từ vào chỗ trống (Fill in the Blank)")

    p_q6 = doc.add_paragraph()
    r = p_q6.add_run("Câu 6: ")
    r.font.bold = True
    p_q6.add_run("Trong lập trình hướng đối tượng (OOP), tính chất cho phép một lớp con kế thừa các thuộc tính và phương thức của lớp cha gọi là tính ______.")

    p_ans6 = doc.add_paragraph()
    p_ans6.paragraph_format.left_indent = Inches(0.25)
    p_ans6.paragraph_format.space_after = Pt(4)
    p_ans6.add_run("Đáp án: ")
    r_ans6 = p_ans6.add_run("kế thừa")
    add_highlight_to_run(r_ans6, "yellow")

    # =========================================================================
    # DẠNG 6: KÉO THẢ VÀO Ô TRỐNG (DRAG & DROP BLANK)
    # =========================================================================
    add_section_header("VI. Dạng 6: Kéo thả từ thích hợp vào ô trống (Drag & Drop Blank)")

    p_q7 = doc.add_paragraph()
    r = p_q7.add_run("Câu 7: ")
    r.font.bold = True
    p_q7.add_run("Kéo thả các giao thức và thiết bị thích hợp vào các câu sau (Mỗi câu có thể kéo nhiều đáp án):")

    drag_items = [
        ("1. Các giao thức hoạt động ở tầng Ứng dụng (Application Layer): _____", ["HTTP", "DNS", "FTP", "SMTP"]),
        ("2. Các giao thức hoạt động ở tầng Giao vận (Transport Layer): _____", ["TCP", "UDP"]),
        ("3. Thiết bị hoạt động ở tầng Mạng (Network Layer): _____", ["Router"])
    ]
    for line_text, answer_words in drag_items:
        p_item = doc.add_paragraph()
        p_item.paragraph_format.left_indent = Inches(0.25)
        p_item.paragraph_format.space_after = Pt(2)
        p_item.add_run(line_text)

        p_w = doc.add_paragraph()
        p_w.paragraph_format.left_indent = Inches(0.4)
        p_w.paragraph_format.space_after = Pt(4)
        p_w.add_run("Đáp án: ")
        for idx, w in enumerate(answer_words):
            r_w = p_w.add_run(w)
            add_highlight_to_run(r_w, "yellow")
            if idx < len(answer_words) - 1:
                p_w.add_run(", ")

    # Hộp từ vựng bổ sung gây nhiễu
    p_extra = doc.add_paragraph()
    p_extra.paragraph_format.left_indent = Inches(0.25)
    p_extra.paragraph_format.space_after = Pt(6)
    r_bank = p_extra.add_run("Từ khóa cho trước: HTTP, DNS, FTP, SMTP, TCP, UDP, Router, Switch, IP, ICMP, ARP")
    r_bank.font.italic = True

    # =========================================================================
    # DẠNG 7: GHÉP ĐÔI THUẬT NGỮ - ĐỊNH NGHĨA (MATCHING PAIRS)
    # =========================================================================
    add_section_header("VII. Dạng 7: Ghép đôi thuật ngữ & định nghĩa (Matching Pairs)")

    p_q8 = doc.add_paragraph()
    r = p_q8.add_run("Câu 8: ")
    r.font.bold = True
    p_q8.add_run("Hãy ghép nối từng nguyên tắc thiết kế phần mềm SOLID với ý nghĩa tương ứng:")

    match_table = doc.add_table(rows=5, cols=2)
    match_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr = match_table.rows[0].cells
    hdr[0].text = "Thuật ngữ (Cột A)"
    hdr[1].text = "Ý nghĩa / Định nghĩa (Cột B)"
    set_cell_background(hdr[0], "F1F5F9")
    set_cell_background(hdr[1], "F1F5F9")
    set_cell_margins(hdr[0], top=80, bottom=80, left=120, right=120)
    set_cell_margins(hdr[1], top=80, bottom=80, left=120, right=120)

    pairs = [
        ("Single Responsibility Principle (SRP)", "Mỗi lớp chỉ nên chịu duy nhất một trách nhiệm thay đổi"),
        ("Open / Closed Principle (OCP)", "Mở rộng tính năng bằng kế thừa, đóng với việc sửa đổi mã nguồn gốc"),
        ("Liskov Substitution Principle (LSP)", "Các đối tượng lớp con phải có thể thay thế hoàn toàn cho lớp cha"),
        ("Dependency Inversion Principle (DIP)", "Các module cấp cao không nên phụ thuộc trực tiếp vào module cấp thấp")
    ]

    for i, (col_a, col_b) in enumerate(pairs, start=1):
        row_c = match_table.rows[i].cells
        set_cell_margins(row_c[0], top=60, bottom=60, left=120, right=120)
        set_cell_margins(row_c[1], top=60, bottom=60, left=120, right=120)

        p_a = row_c[0].paragraphs[0]
        r_a = p_a.add_run(col_a)
        add_highlight_to_run(r_a, "yellow")

        p_b = row_c[1].paragraphs[0]
        r_b = p_b.add_run(col_b)
        add_highlight_to_run(r_b, "yellow")

    # =========================================================================
    # DẠNG 8: DÒNG ĐÁP ÁN DỰ PHÒNG (KHI KHÔNG CÓ HIGHLIGHT)
    # =========================================================================
    add_section_header("VIII. Dạng bổ trợ: Tự nhận diện khi không có Highlight (Fallback 'Đáp án: C')")

    p_q9 = doc.add_paragraph()
    r = p_q9.add_run("Câu 9: ")
    r.font.bold = True
    p_q9.add_run("Đơn vị đo lường tốc độ truyền dữ liệu qua mạng thông dụng nhất là gì?")

    opts_9 = ["A. Byte/s", "B. bps (bit per second)", "C. GHz", "D. RPM"]
    for opt_text in opts_9:
        p_opt = doc.add_paragraph()
        p_opt.paragraph_format.left_indent = Inches(0.25)
        p_opt.paragraph_format.space_after = Pt(2)
        p_opt.add_run(opt_text)

    p_ans9 = doc.add_paragraph()
    p_ans9.paragraph_format.left_indent = Inches(0.25)
    p_ans9.paragraph_format.space_after = Pt(4)
    r_a9 = p_ans9.add_run("Đáp án: B")
    r_a9.font.bold = True
    r_a9.font.color.rgb = RGBColor(0x05, 0x96, 0x69)

    # =========================================================================
    # DẠNG 9: CÂU HỎI NHIỀU DÒNG (ĐOẠN MÃ CODE / LẬP TRÌNH)
    # =========================================================================
    add_section_header("IX. Dạng: Câu hỏi nhiều dòng kèm đoạn mã lập trình (Code Snippet)")

    p_q10 = doc.add_paragraph()
    r = p_q10.add_run("Câu 10: ")
    r.font.bold = True
    p_q10.add_run("Cho đoạn mã chương trình Kotlin sau:")

    code_lines_q10 = [
        "fun main() {",
        "    var sum = 0",
        "    for (i in 1..10) {",
        "        if (i % 2 == 0) {",
        "            sum += i",
        "        }",
        "    }",
        "    if (sum % 5 == 0)",
        "        println(sum)",
        "}"
    ]
    for line in code_lines_q10:
        p_code = doc.add_paragraph()
        p_code.paragraph_format.left_indent = Inches(0.35)
        p_code.paragraph_format.space_after = Pt(1)
        r_code = p_code.add_run(line)
        r_code.font.name = 'Consolas'
        r_code.font.size = Pt(10)
        r_code.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    p_q10_suffix = doc.add_paragraph()
    p_q10_suffix.paragraph_format.space_before = Pt(4)
    p_q10_suffix.add_run("Sau khi thực hiện đoạn mã trên, biến sum có giá trị bằng bao nhiêu?")

    tbl_q10 = doc.add_table(rows=2, cols=2)
    tbl_q10.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_q10_opts = [
        [("A. 40", False), ("B. 30", True)],
        [("C. 20", False), ("D. 50", False)]
    ]
    for row_idx, row_data in enumerate(tbl_q10_opts):
        for col_idx, (opt_text, is_correct) in enumerate(row_data):
            cell_ij = tbl_q10.rows[row_idx].cells[col_idx]
            set_cell_margins(cell_ij, top=60, bottom=60, left=100, right=100)
            p_ij = cell_ij.paragraphs[0]
            r_ij = p_ij.add_run(opt_text)
            if is_correct:
                add_highlight_to_run(r_ij, "yellow")

    # =========================================================================
    # DẠNG 10: ĐÁP ÁN NHIỀU DÒNG (CODE HOẶC VĂN BẢN XUỐNG DÒNG)
    # =========================================================================
    add_section_header("X. Dạng: Phương án đáp án nhiều dòng (Code hoặc văn bản xuống dòng)")

    p_q11 = doc.add_paragraph()
    r = p_q11.add_run("Câu 11: ")
    r.font.bold = True
    p_q11.add_run("Trong ngôn ngữ Kotlin, đoạn mã nào sau đây in ra các số từ 1 đến 10 nhưng bỏ qua giá trị 5?")

    tbl_q11 = doc.add_table(rows=2, cols=2)
    tbl_q11.alignment = WD_TABLE_ALIGNMENT.CENTER

    opt_a_lines = ["A. for (i in 1..10) {", "    if (i == 5)", "        println(i)", "}"]
    opt_b_lines = ["B. for (i in 1..10 step 5)", "    println(i)"]
    opt_c_lines = ["C. for (i in 1..10) {", "    if (i == 5)", "        continue;", "    println(i)", "}"]
    opt_d_lines = ["D. for (i in 1..10)", "    continue if (i == 5)"]

    grid_q11 = [
        [(opt_a_lines, False), (opt_b_lines, False)],
        [(opt_c_lines, True), (opt_d_lines, False)]
    ]

    for row_idx, row_data in enumerate(grid_q11):
        for col_idx, (lines, is_correct) in enumerate(row_data):
            cell_ij = tbl_q11.rows[row_idx].cells[col_idx]
            set_cell_margins(cell_ij, top=60, bottom=60, left=100, right=100)
            for l_idx, l_text in enumerate(lines):
                p_l = cell_ij.paragraphs[0] if l_idx == 0 else cell_ij.add_paragraph()
                p_l.paragraph_format.space_after = Pt(1)
                r_l = p_l.add_run(l_text)
                r_l.font.name = 'Consolas'
                r_l.font.size = Pt(9.5)
                if is_correct:
                    add_highlight_to_run(r_l, "yellow")

    # Save to path
    doc.save(output_path)
    return output_path


if __name__ == "__main__":
    out_file = "Mau_De_Thi_Tat_Ca_Dinh_Dang.docx"
    create_comprehensive_docx(out_file)
    print(f"Successfully generated: {out_file}")

