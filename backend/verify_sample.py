import sys
from backend.word_parser import parse_docx_file
from backend.question_detector import detect_questions_from_elements

sys.stdout.reconfigure(encoding='utf-8')

elements = parse_docx_file('Mau_De_Thi_Tat_Ca_Dinh_Dang.docx')
questions = detect_questions_from_elements(elements)
print(f"Total detected questions: {len(questions)}")
for q in questions:
    print(f"Câu {q['order']}: Loại [{q['type']}] | Highlight: {q['hasHighlight']} | Đáp án: {q.get('correctAnswers')}")
    if q.get('warning'):
        print(f"   Cảnh báo: {q['warning']}")

