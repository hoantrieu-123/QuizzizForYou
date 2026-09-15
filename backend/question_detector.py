"""
Question Detector
Analyzes document blocks (paragraphs and tables with run-level highlights)
and detects the 6 question types:
1. single_choice
2. multiple_choice
3. true_false
4. fill_blank
5. drag_drop_blank
6. matching
"""
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple


def is_question_header(text: str) -> bool:
    """Check if text starts like 'Câu 1:', 'Question 1.', 'Bài 1:', etc."""
    stripped = text.strip()
    return bool(re.match(r'^(?:Câu|Question|Bài)\s*(\d+)[:.]?\s*', stripped, re.IGNORECASE))


def parse_question_header(text: str) -> Tuple[str, str]:
    """Extract (question_number, question_title_text)."""
    m = re.match(r'^(?:Câu|Question|Bài)\s*(\d+)[:.]?\s*(.*)$', text.strip(), re.IGNORECASE)
    if m:
        return m.group(1), m.group(2).strip()
    return "", text.strip()


def is_option_text(text: str) -> Optional[Tuple[str, str]]:
    """Check if text starts with option label like 'A.', 'A)', 'A:', '[A]'."""
    m = re.match(r'^\s*([A-HJ-Z])[\.\)\:\-]\s*(.*)$', text.strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None


def is_statement_header(text: str) -> Optional[Tuple[str, str]]:
    """Check if text is a sub-statement like '1.', '2.', 'a.', 'b.'."""
    m = re.match(r'^\s*(\d+|[a-h])[\.\)]\s+(.*)$', text.strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None


def clean_text(t: str) -> str:
    return re.sub(r'\s+', ' ', t).strip()


def detect_questions_from_elements(elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Split the document elements into question blocks and analyze each block.
    """
    # 1. Group elements by question
    question_blocks: List[Dict[str, Any]] = []
    current_block: Optional[Dict[str, Any]] = None

    for elem in elements:
        if elem['type'] == 'paragraph' and is_question_header(elem['text']):
            if current_block is not None:
                question_blocks.append(current_block)
            q_num, q_title = parse_question_header(elem['text'])
            current_block = {
                'q_num': q_num,
                'header': elem['text'],
                'first_line': q_title,
                'header_elem': elem,
                'elements': []
            }
        else:
            if current_block is not None:
                current_block['elements'].append(elem)

    if current_block is not None:
        question_blocks.append(current_block)

    # 2. If no 'Câu \d+' headers found, try fallback grouping by numbered items '1. ...', '2. ...'
    if not question_blocks:
        current_block = None
        for elem in elements:
            if elem['type'] == 'paragraph':
                m = re.match(r'^(\d+)[\.\)]\s+(.*)$', elem['text'].strip())
                if m and len(elem['text'].strip()) > 3:
                    if current_block is not None:
                        question_blocks.append(current_block)
                    current_block = {
                        'q_num': m.group(1),
                        'header': elem['text'],
                        'first_line': m.group(2).strip(),
                        'header_elem': elem,
                        'elements': []
                    }
                    continue
            if current_block is not None:
                current_block['elements'].append(elem)
        if current_block is not None:
            question_blocks.append(current_block)

    # 3. Analyze each question block into one of the 6 question types
    parsed_questions: List[Dict[str, Any]] = []
    for idx, block in enumerate(question_blocks):
        q = analyze_question_block(block, idx + 1)
        parsed_questions.append(q)

    return parsed_questions


def analyze_question_block(block: Dict[str, Any], default_order: int) -> Dict[str, Any]:
    """
    Analyze a block of elements corresponding to a single question.
    Determines type, content, options, correct answers, statements, matching pairs.
    """
    q_num = block.get('q_num') or str(default_order)
    first_line = block.get('first_line', '')
    elements = block.get('elements', [])
    header = block.get('header', '')

    # Check for prompt indicating question text
    content_parts = [first_line] if first_line else [header]

    # Collect sub-paragraphs before any options or tables
    body_elements = []
    for elem in elements:
        body_elements.append(elem)

    # First check: Is this a matching table or matching pair?
    matching_result = try_detect_matching(content_parts, body_elements)
    if matching_result:
        matching_result['order'] = int(q_num) if q_num.isdigit() else default_order
        return matching_result

    # Second check: Is this a multi-statement True/False?
    # e.g., Statement 1, Table/P Sai/Đúng, Statement 2, Table/P Sai/Đúng
    tf_multi_result = try_detect_multi_statement_tf(content_parts, body_elements)
    if tf_multi_result:
        tf_multi_result['order'] = int(q_num) if q_num.isdigit() else default_order
        return tf_multi_result

    # Third check: Is this Drag and Drop blank?
    # e.g. "Kéo từ thích hợp vào vị trí trống" or multiple blanks with blank definitions
    drag_drop_result = try_detect_drag_drop_blank(content_parts, body_elements)
    if drag_drop_result:
        drag_drop_result['order'] = int(q_num) if q_num.isdigit() else default_order
        return drag_drop_result

    # Fourth check: Is this Fill Blank?
    fill_blank_result = try_detect_fill_blank(content_parts, body_elements)
    if fill_blank_result:
        fill_blank_result['order'] = int(q_num) if q_num.isdigit() else default_order
        return fill_blank_result

    # Fifth check: Single statement True/False?
    single_tf_result = try_detect_single_tf(content_parts, body_elements)
    if single_tf_result:
        single_tf_result['order'] = int(q_num) if q_num.isdigit() else default_order
        return single_tf_result

    # Sixth check: Multiple Choice or Single Choice with standard options (A, B, C, D)
    choice_result = detect_choice_question(content_parts, body_elements)
    choice_result['order'] = int(q_num) if q_num.isdigit() else default_order
    return choice_result


def try_detect_matching(content_parts: List[str], elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Detect matching question: 2-column table or arrow pairs (A -> B)."""
    full_content = ' '.join(content_parts)
    has_blank = bool(re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,})', full_content))
    if not has_blank:
        for elem in elements:
            if elem['type'] == 'paragraph' and re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,})', elem['text']):
                has_blank = True
                break

    # If document has fill-in/drag-and-drop blanks, it's NOT a matching question
    if has_blank:
        return None

    is_matching_keyword = bool(re.search(r'(ghép\s*đôi|nối\s*cột|ghép\s*cặp|matching|cột\s*trái|cột\s*phải|cột\s*a.*cột\s*b)', full_content, re.IGNORECASE))

    # Look for 2-column tables
    for elem in elements:
        if elem['type'] == 'table' and elem['col_count'] >= 2 and elem['row_count'] >= 2:
            rows = elem['rows']
            first_row_text = ' '.join([c['text'] for c in rows[0]]).lower()
            has_header_keywords = 'thuật ngữ' in first_row_text or 'định nghĩa' in first_row_text or 'cột' in first_row_text or 'khái niệm' in first_row_text

            start_idx = 1 if has_header_keywords else 0
            pairs = []
            has_highlight = False

            for r in rows[start_idx:]:
                if len(r) >= 2:
                    left_text = clean_text(r[0]['text'])
                    right_text = clean_text(r[1]['text'])
                    if left_text and right_text:
                        hl = r[0]['has_highlight'] or r[1]['has_highlight']
                        if hl:
                            has_highlight = True
                        pairs.append({
                            'id': f"pair_{uuid.uuid4().hex[:6]}",
                            'left': left_text,
                            'right': right_text,
                            'highlighted': hl
                        })

            if len(pairs) >= 2 and (is_matching_keyword or has_header_keywords or len(pairs) >= 3):
                desc = ' '.join(content_parts)
                return {
                    'id': f"q_{uuid.uuid4().hex[:8]}",
                    'type': 'matching',
                    'content': desc,
                    'pairs': pairs,
                    'options': [],
                    'correctAnswers': [f"{p['left']} → {p['right']}" for p in pairs],
                    'hasHighlight': has_highlight,
                    'highlightSource': 'Word highlight trong bảng / dòng' if has_highlight else 'Cặp hàng bảng',
                    'warning': None if has_highlight or len(pairs) >= 2 else "⚠ Cần kiểm tra cặp ghép đôi"
                }

    # Also check arrow style in paragraphs: e.g. "SOLID -> Nguyên tắc... (HL)"
    arrow_pairs = []
    has_hl = False
    for elem in elements:
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()
            # Ignore answer lines or bank lines
            if re.match(r'^(?:Đáp án|Answer|Từ khóa|Hộp từ|Từ cho trước)\s*[:.]', text, re.IGNORECASE):
                continue
            # match ->, →, :, =
            m = re.match(r'^\s*(?:[0-9a-zA-Z\.\)]+[\s\.\)]*)?([^\-\→\:\=]{2,})\s*(?:->|→|—)\s*(.+)$', text)
            if m and is_matching_keyword:
                left = clean_text(m.group(1))
                right = clean_text(m.group(2))
                hl = elem['has_highlight']
                if hl:
                    has_hl = True
                arrow_pairs.append({
                    'id': f"pair_{uuid.uuid4().hex[:6]}",
                    'left': left,
                    'right': right,
                    'highlighted': hl
                })

    if len(arrow_pairs) >= 2:
        return {
            'id': f"q_{uuid.uuid4().hex[:8]}",
            'type': 'matching',
            'content': ' '.join(content_parts),
            'pairs': arrow_pairs,
            'options': [],
            'correctAnswers': [f"{p['left']} → {p['right']}" for p in arrow_pairs],
            'hasHighlight': has_hl,
            'highlightSource': 'Word highlight theo cặp' if has_hl else 'Cặp ghép đôi dạng mũi tên',
            'warning': None
        }

    return None


def try_detect_multi_statement_tf(content_parts: List[str], elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Detect multi-statement True/False questions like:
    Statement 1
      Table: A. Sai (HL) | B. Đúng
    Statement 2
      Table: A. Sai | B. Đúng (HL)
    Or statements followed by Đúng / Sai paragraphs.
    """
    statements = []
    current_statement_text = None
    has_any_hl = False

    i = 0
    while i < len(elements):
        elem = elements[i]

        # Check if this paragraph is a numbered statement e.g. "1. Kestrel...", "a. JavaScript..."
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()
            # If it's a statement
            st_match = is_statement_header(text)
            if st_match:
                current_statement_text = text
                i += 1
                continue

        # Check if the next element is options for the current statement
        if current_statement_text:
            ans = None
            statement_has_hl = False
            hl_color = None

            # Option A: Next element is a Table with Đúng/Sai or Sai/Đúng
            if elem['type'] == 'table':
                # Check table cells
                cells = [c for row in elem['rows'] for c in row]
                is_tf_table = False
                for c in cells:
                    c_clean = c['text'].strip().lower()
                    if 'đúng' in c_clean or 'sai' in c_clean or 'true' in c_clean or 'false' in c_clean:
                        is_tf_table = True
                        if c['has_highlight']:
                            statement_has_hl = True
                            has_any_hl = True
                            hl_color = c['highlight_colors'][0] if c['highlight_colors'] else 'yellow'
                            if 'đúng' in c_clean or 'true' in c_clean:
                                ans = 'Đúng'
                            elif 'sai' in c_clean or 'false' in c_clean:
                                ans = 'Sai'

                if is_tf_table:
                    # If not highlighted, see if an answer is marked or default
                    if not ans:
                        # Check fallback "Đáp án: "
                        ans = 'Đúng'  # fallback
                    statements.append({
                        'id': f"st_{uuid.uuid4().hex[:6]}",
                        'order': len(statements) + 1,
                        'content': current_statement_text,
                        'correctAnswer': ans,
                        'options': ['Đúng', 'Sai'],
                        'highlighted': statement_has_hl,
                        'highlightColor': hl_color
                    })
                    current_statement_text = None
                    i += 1
                    continue

            # Option B: Paragraph with A. Đúng (HL) / B. Sai
            if elem['type'] == 'paragraph':
                p_text = elem['text'].strip().lower()
                if 'đúng' in p_text or 'sai' in p_text:
                    # Collect following paragraphs that might be Đúng/Sai
                    tf_paras = [elem]
                    j = i + 1
                    while j < len(elements) and elements[j]['type'] == 'paragraph':
                        next_t = elements[j]['text'].strip().lower()
                        if 'đúng' in next_t or 'sai' in next_t:
                            tf_paras.append(elements[j])
                            j += 1
                        else:
                            break

                    ans = 'Đúng'
                    for p in tf_paras:
                        if p['has_highlight']:
                            statement_has_hl = True
                            has_any_hl = True
                            hl_color = p['highlight_colors'][0] if p['highlight_colors'] else 'yellow'
                            hl_str = p.get('highlighted_text', '').strip().lower()
                            if 'sai' in hl_str or 'false' in hl_str:
                                ans = 'Sai'
                            elif 'đúng' in hl_str or 'true' in hl_str:
                                ans = 'Đúng'
                            else:
                                p_cl = p['text'].strip().lower()
                                if 'sai' in p_cl or 'false' in p_cl:
                                    ans = 'Sai'
                                elif 'đúng' in p_cl or 'true' in p_cl:
                                    ans = 'Đúng'

                    statements.append({
                        'id': f"st_{uuid.uuid4().hex[:6]}",
                        'order': len(statements) + 1,
                        'content': current_statement_text,
                        'correctAnswer': ans,
                        'options': ['Đúng', 'Sai'],
                        'highlighted': statement_has_hl,
                        'highlightColor': hl_color
                    })
                    current_statement_text = None
                    i = j
                    continue

        i += 1

    if len(statements) >= 2:
        return {
            'id': f"q_{uuid.uuid4().hex[:8]}",
            'type': 'true_false',
            'content': ' '.join(content_parts),
            'statements': statements,
            'options': [],
            'correctAnswers': [s['correctAnswer'] for s in statements],
            'hasHighlight': has_any_hl,
            'highlightSource': 'Word highlight trên từng mệnh đề Đúng/Sai' if has_any_hl else 'Mặc định',
            'warning': None if has_any_hl else "⚠ Có một số mệnh đề chưa được highlight đáp án"
        }

    return None


def try_detect_single_tf(content_parts: List[str], elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Detect single statement True/False question."""
    full_content = ' '.join(content_parts)

    all_options = []
    # Check elements for 2 options: Đúng and Sai
    for elem in elements:
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()
            opt = is_option_text(text)
            if opt:
                label, val = opt
                if val.lower() in ('đúng', 'sai', 'true', 'false'):
                    all_options.append({
                        'label': label,
                        'text': val,
                        'highlighted': elem['has_highlight'],
                        'highlightColor': elem['highlight_colors'][0] if elem['highlight_colors'] else None
                    })
            elif text.lower() in ('đúng', 'sai', 'true', 'false'):
                all_options.append({
                    'label': text,
                    'text': text,
                    'highlighted': elem['has_highlight'],
                    'highlightColor': elem['highlight_colors'][0] if elem['highlight_colors'] else None
                })
        elif elem['type'] == 'table':
            cells = [c for row in elem['rows'] for c in row]
            for c in cells:
                c_text = c['text'].strip()
                opt = is_option_text(c_text)
                if opt:
                    label, val = opt
                    if val.lower() in ('đúng', 'sai', 'true', 'false'):
                        all_options.append({
                            'label': label,
                            'text': val,
                            'highlighted': c['has_highlight'],
                            'highlightColor': c['highlight_colors'][0] if c['highlight_colors'] else None
                        })
                elif c_text.lower() in ('đúng', 'sai', 'true', 'false'):
                    all_options.append({
                        'label': c_text,
                        'text': c_text,
                        'highlighted': c['has_highlight'],
                        'highlightColor': c['highlight_colors'][0] if c['highlight_colors'] else None
                    })

    if len(all_options) == 2:
        val_texts = [o['text'].lower() for o in all_options]
        if ('đúng' in val_texts and 'sai' in val_texts) or ('true' in val_texts and 'false' in val_texts):
            hl_ans = [o['text'] for o in all_options if o['highlighted']]
            correct = hl_ans if hl_ans else ['Đúng']
            has_hl = len(hl_ans) > 0
            return {
                'id': f"q_{uuid.uuid4().hex[:8]}",
                'type': 'true_false',
                'content': full_content,
                'statements': [
                    {
                        'id': f"st_{uuid.uuid4().hex[:6]}",
                        'order': 1,
                        'content': full_content,
                        'correctAnswer': correct[0],
                        'options': ['Đúng', 'Sai'],
                        'highlighted': has_hl
                    }
                ],
                'options': all_options,
                'correctAnswers': correct,
                'hasHighlight': has_hl,
                'highlightSource': 'Word highlight' if has_hl else 'Không có highlight',
                'warning': None if has_hl else "⚠ Không tìm thấy đáp án được Highlight - Vui lòng chọn đáp án thủ công."
            }

    return None


def try_detect_fill_blank(content_parts: List[str], elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Detect Fill in the Blank question:
    Question contains '___' or '[...]' and has a highlighted answer below.
    """
    full_content = ' '.join(content_parts)
    has_blank = bool(re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,}|\[\s*\.\.\.\s*\])', full_content))

    if not has_blank:
        # Check if any element paragraph has blank
        for elem in elements:
            if elem['type'] == 'paragraph' and re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,})', elem['text']):
                has_blank = True
                full_content += " " + elem['text']
                break

    if not has_blank:
        return None

    # Check for highlighted answer in the elements or paragraph
    highlighted_words = []
    fallback_ans = None

    for elem in elements:
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()
            # If paragraph itself is highlighted or has highlighted runs
            if elem['has_highlight']:
                hl_text = elem['highlighted_text'].strip()
                # strip 'Đáp án:' if present
                hl_text = re.sub(r'^(?:Đáp án|Answer)\s*[:.]\s*', '', hl_text, flags=re.IGNORECASE)
                if hl_text:
                    highlighted_words.append(hl_text)
            elif re.search(r'^(?:Đáp án|Answer)\s*[:.]\s*(.+)$', text, re.IGNORECASE):
                m = re.search(r'^(?:Đáp án|Answer)\s*[:.]\s*(.+)$', text, re.IGNORECASE)
                fallback_ans = m.group(1).strip()
        elif elem['type'] == 'table':
            for r in elem['rows']:
                for c in r:
                    if c['has_highlight'] and c['highlighted_text'].strip():
                        highlighted_words.append(c['highlighted_text'].strip())

    if highlighted_words or fallback_ans:
        correct = highlighted_words if highlighted_words else [fallback_ans]
        has_hl = len(highlighted_words) > 0
        return {
            'id': f"q_{uuid.uuid4().hex[:8]}",
            'type': 'fill_blank',
            'content': full_content,
            'options': [],
            'correctAnswers': correct,
            'hasHighlight': has_hl,
            'highlightSource': 'Word highlight' if has_hl else 'Dòng Đáp án:',
            'warning': None if has_hl else "⚠ Nhận diện từ dòng Đáp án: (không có highlight)"
        }

    return None


def try_detect_drag_drop_blank(content_parts: List[str], elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Detect Drag and Drop into blanks question.
    e.g. Items with blanks '1. _____ dùng để tạo...', '2. _____ dùng để...',
    or words bank with highlighted assignments.
    Supports:
    - Multiple answers per blank / sentence (e.g. "Đáp án: Router, Switch, Hub")
    - Single-sentence or multi-sentence questions with drag & drop blanks
    - Explicit word banks (e.g. "Hộp từ:", "Từ khóa:")
    """
    full_content = ' '.join(content_parts)
    is_drag_keyword = bool(re.search(
        r'(kéo\s*từ|kéo\s*thả|drag.*drop|vị trí trống|vào\s*ô\s*trống|kéo\s*nhiều\s*đáp\s*án)',
        full_content, re.IGNORECASE
    ))

    # Look for items: 1. _____ text, followed by highlighted word
    def split_tokens(s: str) -> List[str]:
        cleaned = re.sub(r'^(?:Đáp án|Answer)\s*[:.]\s*', '', s, flags=re.IGNORECASE).strip()
        tokens = [t.strip() for t in re.split(r'[,;\n\t]+', cleaned) if t.strip()]
        return tokens

    items = []
    bank_words = []
    has_any_hl = False

    # Check for explicit word bank line like: "Hộp từ: A, B, C" or "Từ cho trước: X, Y, Z"
    for elem in elements:
        if elem['type'] == 'paragraph':
            m_bank = re.match(r'^(?:Hộp từ|Từ khóa cho trước|Từ khóa|Từ cho trước|Word Bank|Danh sách từ)\s*[:.]\s*(.+)$', elem['text'].strip(), re.IGNORECASE)
            if m_bank:
                for w in split_tokens(m_bank.group(1)):
                    if w not in bank_words:
                        bank_words.append(w)

    i = 0
    blank_counter = 1
    while i < len(elements):
        elem = elements[i]
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()
            # Pattern A: Numbered item with blank: "1. _____ là..." or "1) Câu có _____"
            m_numbered = re.match(r'^\s*(\d+)[\.\)]\s*(.*_{2,}.*)$', text)
            # Pattern B: Unnumbered item with blank if drag keyword present: "_____ là..." or "Câu có _____"
            has_blank = bool(re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,})', text))

            if m_numbered or (has_blank and is_drag_keyword and not re.match(r'^(?:Đáp án|Answer)\s*[:.]', text, re.IGNORECASE)):
                if m_numbered:
                    blank_num = int(m_numbered.group(1))
                    st_text = m_numbered.group(2).strip()
                else:
                    blank_num = blank_counter
                    st_text = text

                blank_counter += 1

                # Gather answers from following paragraph(s)
                item_answers = []
                item_hl = False

                j = i + 1
                while j < len(elements) and elements[j]['type'] == 'paragraph':
                    next_p = elements[j]
                    next_text = next_p['text'].strip()

                    # Stop if next paragraph is another numbered statement with blank
                    if re.match(r'^\s*\d+[\.\)]\s*.*_{2,}', next_text):
                        break
                    # Stop if next paragraph is a bank definition
                    if re.match(r'^(?:Hộp từ|Từ khóa|Từ cho trước|Word Bank)\s*[:.]', next_text, re.IGNORECASE):
                        break

                    is_ans_line = bool(re.match(r'^(?:Đáp án|Answer)\s*[:.]', next_text, re.IGNORECASE))
                    if next_p['has_highlight'] or is_ans_line:
                        item_hl = True
                        has_any_hl = True
                        tokens = []
                        if next_p['has_highlight']:
                            hl_runs = [r['text'].strip() for r in next_p.get('runs', []) if r.get('is_highlighted') and r.get('text', '').strip()]
                            # If runs are separated words
                            if hl_runs and len(hl_runs) > 1:
                                tokens = hl_runs
                            else:
                                tokens = split_tokens(next_p.get('highlighted_text', ''))

                        if not tokens or (len(tokens) == 1 and ',' in next_text):
                            tokens = split_tokens(next_text)

                        for tok in tokens:
                            if tok and tok not in item_answers:
                                item_answers.append(tok)
                        j += 1
                        if is_ans_line:
                            break
                    else:
                        if not item_answers and len(next_text) < 60 and not re.search(r'(_{2,}|\[\s*blank\s*\])', next_text):
                            tokens = split_tokens(next_text)
                            for tok in tokens:
                                if tok and tok not in item_answers:
                                    item_answers.append(tok)
                            j += 1
                        break

                i = j - 1

                for ans_w in item_answers:
                    if ans_w not in bank_words:
                        bank_words.append(ans_w)

                items.append({
                    'blank': blank_num,
                    'text': st_text,
                    'correctAnswer': ', '.join(item_answers) if item_answers else '',
                    'correctAnswers': item_answers,
                    'highlighted': item_hl
                })
        i += 1

    # If question prompt itself has blank and is_drag_keyword, but no items found in body:
    if not items and is_drag_keyword and re.search(r'(_{2,}|\[\s*blank\s*\]|\.{3,})', full_content):
        prompt_answers = []
        for elem in elements:
            if elem['type'] == 'paragraph':
                if elem['has_highlight']:
                    has_any_hl = True
                    for tok in split_tokens(elem.get('highlighted_text', '')):
                        if tok and tok not in prompt_answers:
                            prompt_answers.append(tok)
                elif re.match(r'^(?:Đáp án|Answer)\s*[:.]', elem['text'].strip(), re.IGNORECASE):
                    for tok in split_tokens(elem['text'].strip()):
                        if tok and tok not in prompt_answers:
                            prompt_answers.append(tok)

        if prompt_answers:
            for ans_w in prompt_answers:
                if ans_w not in bank_words:
                    bank_words.append(ans_w)
            items.append({
                'blank': 1,
                'text': full_content,
                'correctAnswer': ', '.join(prompt_answers),
                'correctAnswers': prompt_answers,
                'highlighted': has_any_hl
            })

    # Validate whether this qualifies as drag_drop_blank:
    if items and ((is_drag_keyword and len(items) >= 1) or len(items) >= 2):
        all_correct = []
        for it in items:
            for ca in (it.get('correctAnswers') or [it.get('correctAnswer')]):
                if ca and ca not in all_correct:
                    all_correct.append(ca)

        return {
            'id': f"q_{uuid.uuid4().hex[:8]}",
            'type': 'drag_drop_blank',
            'content': full_content,
            'items': items,
            'bank': bank_words,
            'options': [],
            'correctAnswers': all_correct,
            'hasHighlight': has_any_hl,
            'highlightSource': 'Word highlight các đáp án kéo thả' if has_any_hl else 'Dòng đáp án / Mặc định',
            'warning': None if has_any_hl else "⚠ Chưa có từ nào được highlight"
        }

    return None


def detect_choice_question(content_parts: List[str], elements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Standard Single Choice or Multiple Choice question.
    Gathers options from both tables and paragraphs.
    If >= 2 options are highlighted -> multiple_choice
    Else if 1 option is highlighted -> single_choice
    Fallback to "Đáp án: A" if no highlight.
    If still none -> warning: "⚠ Không tìm thấy đáp án được Highlight".
    """
    options: List[Dict[str, Any]] = []
    extra_content = []
    fallback_answer_str = None

    for elem in elements:
        if elem['type'] == 'paragraph':
            text = elem['text'].strip()

            # Check if this is an answer line: "Đáp án: A" or "Answer: A, B"
            ans_m = re.match(r'^(?:Đáp án|Answer)\s*[:.]\s*([A-HJ-Z\s,;]+)$', text, re.IGNORECASE)
            if ans_m:
                fallback_answer_str = ans_m.group(1).strip()
                continue

            opt = is_option_text(text)
            if opt:
                label, val = opt
                hl = elem['has_highlight']
                hl_color = elem['highlight_colors'][0] if elem['highlight_colors'] else 'yellow'
                options.append({
                    'label': label,
                    'text': val,
                    'full_text': text,
                    'highlighted': hl,
                    'highlightColor': hl_color if hl else None
                })
            elif len(options) == 0:
                # Question description before options
                extra_content.append(text)

        elif elem['type'] == 'table':
            # Extract options from table cells
            cells = [c for row in elem['rows'] for c in row]
            for c in cells:
                c_text = c['text'].strip()
                opt = is_option_text(c_text)
                if opt:
                    label, val = opt
                    hl = c['has_highlight']
                    hl_color = c['highlight_colors'][0] if c['highlight_colors'] else 'yellow'
                    options.append({
                        'label': label,
                        'text': val,
                        'full_text': c_text,
                        'highlighted': hl,
                        'highlightColor': hl_color if hl else None
                    })
                elif len(options) == 0 and c_text:
                    extra_content.append(c_text)

    # Sort options by label A, B, C, D if they have standard labels
    options.sort(key=lambda o: o.get('label', ''))

    # Determine correct answers based on Priority:
    # Priority 1: Highlight
    highlighted_options = [o for o in options if o['highlighted']]
    correct_answers = []
    has_highlight = False
    source = "Không tìm thấy đáp án"
    warning = None

    if highlighted_options:
        has_highlight = True
        correct_answers = [o['label'] for o in highlighted_options]
        source = f"Word highlight ({', '.join([o.get('highlightColor') or 'highlight' for o in highlighted_options])})"
    elif fallback_answer_str:
        # Priority 2: "Đáp án: A, B"
        labels = [l.strip().upper() for l in re.split(r'[,;\s]+', fallback_answer_str) if l.strip()]
        correct_answers = labels
        source = f"Dòng văn bản '{fallback_answer_str}' (Ưu tiên 2)"
        for o in options:
            if o['label'] in labels:
                o['highlighted'] = True
    else:
        # Priority 3: Warning
        warning = "⚠ Không tìm thấy đáp án được Highlight - Vui lòng chọn đáp án thủ công."

    # Determine question type:
    full_content = ' '.join(content_parts + extra_content).strip()
    is_multi_by_text = bool(re.search(r'chọn\s*(?:\d+|nhiều)\s*đáp án', full_content, re.IGNORECASE))

    # Rule 7: If >= 2 highlighted -> multiple_choice. If 1 highlighted -> single_choice.
    if len(highlighted_options) >= 2:
        q_type = 'multiple_choice'
    elif len(highlighted_options) == 1:
        q_type = 'single_choice'
    elif fallback_answer_str and len(correct_answers) >= 2:
        q_type = 'multiple_choice'
    elif is_multi_by_text or len(correct_answers) >= 2:
        q_type = 'multiple_choice'
    else:
        q_type = 'single_choice'

    return {
        'id': f"q_{uuid.uuid4().hex[:8]}",
        'type': q_type,
        'content': full_content,
        'options': options,
        'correctAnswers': correct_answers,
        'hasHighlight': has_highlight,
        'highlightSource': source,
        'warning': warning
    }
