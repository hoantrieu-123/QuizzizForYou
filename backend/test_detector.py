import sys
from backend.word_parser import parse_docx_file
from backend.question_detector import detect_questions_from_elements

sys.stdout.reconfigure(encoding='utf-8')

def test_file(filename):
    print(f"=== Testing file: {filename} ===")
    elements = parse_docx_file(filename)
    questions = detect_questions_from_elements(elements)
    print(f"Total questions detected: {len(questions)}")
    for q in questions:
        print(f"Question {q['order']} [{q['type']}]: {q['content'][:60]}")
        if q.get('options'):
            print("  Options:", [(o['label'], o['text'], o['highlighted']) for o in q['options']])
        if q.get('statements'):
            print("  Statements:", [(s['order'], s['correctAnswer'], s['highlighted']) for s in q['statements']])
        if q.get('items'):
            print("  Blank items:", [(it['blank'], it['correctAnswer'], it['highlighted']) for it in q['items']])
        if q.get('pairs'):
            print("  Matching pairs:", [(p['left'], p['right'], p['highlighted']) for p in q['pairs']])
        print(f"  Answers: {q.get('correctAnswers')}")
        print(f"  Highlight source: {q.get('highlightSource')}")
        if q.get('warning'):
            print(f"  Warning: {q['warning']}")
        print()

if __name__ == "__main__":
    test_file("sample_quiz_highlighted.docx")

