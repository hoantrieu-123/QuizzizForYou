"""
SQLite Database Layer for Quizizz Docx App
Stores Quizzes, Questions, and Quiz Attempts.
"""
import sqlite3
import json
import uuid
import os
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "quizizz.db")


def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if not already existing."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        question_count INTEGER NOT NULL DEFAULT 0,
        subject_id TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Check and add subject_id column if missing in existing quizzes table
    cursor.execute("PRAGMA table_info(quizzes)")
    quiz_columns = [col[1] for col in cursor.fetchall()]
    if 'subject_id' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN subject_id TEXT DEFAULT ''")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Seed default subjects if empty
    cursor.execute("SELECT COUNT(*) FROM subjects")
    if cursor.fetchone()[0] == 0:
        default_subjects = [
            ("subj_toan", "Môn Toán", 1),
            ("subj_van", "Môn Ngữ Văn", 2),
            ("subj_anh", "Môn Tiếng Anh", 3),
            ("subj_khtn", "Môn Khoa học tự nhiên", 4)
        ]
        cursor.executemany(
            "INSERT INTO subjects (id, name, order_idx) VALUES (?, ?, ?)",
            default_subjects
        )

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        order_idx INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        options_json TEXT,
        correct_answers_json TEXT,
        statements_json TEXT,
        items_json TEXT,
        pairs_json TEXT,
        bank_json TEXT,
        has_highlight BOOLEAN NOT NULL DEFAULT 0,
        highlight_source TEXT,
        warning TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        score REAL NOT NULL,
        total_score REAL NOT NULL,
        percentage REAL NOT NULL,
        details_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

# Auto-initialize database tables on module load
init_db()


def save_quiz(title: str, filename: str, questions: List[Dict[str, Any]]) -> str:
    """Save parsed quiz and all questions into SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    quiz_id = f"quiz_{uuid.uuid4().hex[:10]}"

    cursor.execute(
        "INSERT INTO quizzes (id, title, filename, question_count) VALUES (?, ?, ?, ?)",
        (quiz_id, title, filename, len(questions))
    )

    for idx, q in enumerate(questions, start=1):
        q_id = q.get('id') or f"q_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
        INSERT INTO questions (
            id, quiz_id, order_idx, type, content,
            options_json, correct_answers_json, statements_json,
            items_json, pairs_json, bank_json,
            has_highlight, highlight_source, warning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            q_id,
            quiz_id,
            q.get('order', idx),
            q.get('type', 'single_choice'),
            q.get('content', ''),
            json.dumps(q.get('options', []), ensure_ascii=False),
            json.dumps(q.get('correctAnswers', []), ensure_ascii=False),
            json.dumps(q.get('statements', []), ensure_ascii=False),
            json.dumps(q.get('items', []), ensure_ascii=False),
            json.dumps(q.get('pairs', []), ensure_ascii=False),
            json.dumps(q.get('bank', []), ensure_ascii=False),
            1 if q.get('hasHighlight') else 0,
            q.get('highlightSource', ''),
            q.get('warning', None)
        ))

    conn.commit()
    conn.close()
    return quiz_id


def get_quizzes() -> List[Dict[str, Any]]:
    """Retrieve list of all quizzes."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_quiz(quiz_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve quiz metadata and all questions."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,))
    quiz_row = cursor.fetchone()
    if not quiz_row:
        conn.close()
        return None

    quiz_data = dict(quiz_row)
    cursor.execute("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_idx ASC", (quiz_id,))
    q_rows = cursor.fetchall()
    conn.close()

    questions = []
    for r in q_rows:
        d = dict(r)
        questions.append({
            'id': d['id'],
            'order': d['order_idx'],
            'type': d['type'],
            'content': d['content'],
            'options': json.loads(d['options_json'] or '[]'),
            'correctAnswers': json.loads(d['correct_answers_json'] or '[]'),
            'statements': json.loads(d['statements_json'] or '[]'),
            'items': json.loads(d['items_json'] or '[]'),
            'pairs': json.loads(d['pairs_json'] or '[]'),
            'bank': json.loads(d['bank_json'] or '[]'),
            'hasHighlight': bool(d['has_highlight']),
            'highlightSource': d['highlight_source'],
            'warning': d['warning']
        })

    quiz_data['questions'] = questions
    return quiz_data


def update_quiz_questions(quiz_id: str, questions: List[Dict[str, Any]], title: Optional[str] = None) -> bool:
    """Update quiz and replace questions with modified data from preview."""
    conn = get_connection()
    cursor = conn.cursor()

    if title:
        cursor.execute("UPDATE quizzes SET title = ?, question_count = ? WHERE id = ?", (title, len(questions), quiz_id))
    else:
        cursor.execute("UPDATE quizzes SET question_count = ? WHERE id = ?", (len(questions), quiz_id))

    # Remove old questions
    cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))

    # Insert updated questions
    for idx, q in enumerate(questions, start=1):
        q_id = q.get('id') or f"q_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
        INSERT INTO questions (
            id, quiz_id, order_idx, type, content,
            options_json, correct_answers_json, statements_json,
            items_json, pairs_json, bank_json,
            has_highlight, highlight_source, warning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            q_id,
            quiz_id,
            q.get('order', idx),
            q.get('type', 'single_choice'),
            q.get('content', ''),
            json.dumps(q.get('options', []), ensure_ascii=False),
            json.dumps(q.get('correctAnswers', []), ensure_ascii=False),
            json.dumps(q.get('statements', []), ensure_ascii=False),
            json.dumps(q.get('items', []), ensure_ascii=False),
            json.dumps(q.get('pairs', []), ensure_ascii=False),
            json.dumps(q.get('bank', []), ensure_ascii=False),
            1 if q.get('hasHighlight') else 0,
            q.get('highlightSource', ''),
            q.get('warning', None)
        ))

    conn.commit()
    conn.close()
    return True


def delete_quiz(quiz_id: str) -> bool:
    """Delete a quiz, its questions, and its attempts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
    cursor.execute("DELETE FROM attempts WHERE quiz_id = ?", (quiz_id,))
    cursor.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    conn.commit()
    conn.close()
    return True


def save_attempt(quiz_id: str, score: float, total_score: float, details: Dict[str, Any]) -> str:
    """Save user attempt results."""
    conn = get_connection()
    cursor = conn.cursor()
    attempt_id = f"att_{uuid.uuid4().hex[:10]}"
    percentage = round((score / total_score * 100) if total_score > 0 else 0, 1)

    cursor.execute("""
    INSERT INTO attempts (id, quiz_id, score, total_score, percentage, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (attempt_id, quiz_id, score, total_score, percentage, json.dumps(details, ensure_ascii=False)))

    conn.commit()
    conn.close()
    return attempt_id


def get_subjects() -> List[Dict[str, Any]]:
    """Retrieve list of all subjects sorted by order_idx."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects ORDER BY order_idx ASC, created_at ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_subject(name: str) -> Dict[str, Any]:
    """Create a new subject."""
    conn = get_connection()
    cursor = conn.cursor()
    subject_id = f"subj_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM subjects")
    next_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO subjects (id, name, order_idx) VALUES (?, ?, ?)",
        (subject_id, name.strip(), next_order)
    )
    conn.commit()
    cursor.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return row


def update_subject(subject_id: str, name: str) -> bool:
    """Update subject name."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE subjects SET name = ? WHERE id = ?", (name.strip(), subject_id))
    conn.commit()
    conn.close()
    return True


def delete_subject(subject_id: str) -> bool:
    """Delete a subject and reset its quizzes to uncategorized."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET subject_id = '' WHERE subject_id = ?", (subject_id,))
    cursor.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
    conn.commit()
    conn.close()
    return True


def update_quiz_subject(quiz_id: str, subject_id: Optional[str] = None) -> bool:
    """Assign quiz to a subject or move it out to uncategorized."""
    conn = get_connection()
    cursor = conn.cursor()
    sub_val = subject_id.strip() if subject_id else ''
    cursor.execute("UPDATE quizzes SET subject_id = ? WHERE id = ?", (sub_val, quiz_id))
    conn.commit()
    conn.close()
    return True

