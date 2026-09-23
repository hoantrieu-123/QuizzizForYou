"""
SQLite Database Layer for Quizizz Docx App
Stores Quizzes, Questions, and Quiz Attempts.
Optimized with SQLite WAL mode, database indexes, and thread-safe in-memory caching.
"""
import sqlite3
import json
import uuid
import os
import time
from threading import Lock
from typing import List, Dict, Any, Optional

try:
    import libsql
    HAS_LIBSQL = True
except ImportError:
    libsql = None
    HAS_LIBSQL = False

DB_FILE = os.path.join(os.path.dirname(__file__), "quizizz.db")
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

# ==============================================================================
# In-Memory High-Speed Cache Layer (Thread-Safe)
# ==============================================================================
_CACHE: Dict[str, Any] = {}
_CACHE_LOCK = Lock()
DEFAULT_TTL = 300  # 5 minutes


def cache_get(key: str) -> Optional[Any]:
    with _CACHE_LOCK:
        item = _CACHE.get(key)
        if item is not None:
            val, expire_at = item
            if time.time() < expire_at:
                return val
            _CACHE.pop(key, None)
    return None


def cache_set(key: str, val: Any, ttl: float = DEFAULT_TTL):
    with _CACHE_LOCK:
        _CACHE[key] = (val, time.time() + ttl)


def cache_clear_key(key: str):
    with _CACHE_LOCK:
        _CACHE.pop(key, None)


def cache_clear_prefix(prefix: str):
    with _CACHE_LOCK:
        keys_to_del = [k for k in _CACHE if k.startswith(prefix)]
        for k in keys_to_del:
            _CACHE.pop(k, None)


def cache_clear_all():
    with _CACHE_LOCK:
        _CACHE.clear()


def invalidate_quiz_cache(quiz_id: Optional[str] = None):
    """Invalidate cached quiz list and specific quiz detail."""
    cache_clear_key("quizzes_list")
    cache_clear_key("full_tree")
    if quiz_id:
        cache_clear_key(f"quiz_{quiz_id}")
    else:
        cache_clear_prefix("quiz_")


def invalidate_tree_cache():
    """Invalidate hierarchical tree and categorization caches."""
    cache_clear_key("full_tree")
    cache_clear_key("classes_list")
    cache_clear_key("subjects_list")
    cache_clear_prefix("semesters_")
    cache_clear_key("quizzes_list")


# ==============================================================================
# Database Connection with Performance PRAGMAs
# ==============================================================================
def get_connection():
    if TURSO_DATABASE_URL and HAS_LIBSQL:
        return libsql.connect(database=TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA temp_store = MEMORY;")
        conn.execute("PRAGMA cache_size = -10000;")
    except Exception:
        pass
    return conn


def row_to_dict(cursor, row) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    if hasattr(row, 'keys'):
        return dict(row)
    cols = [col[0] for col in cursor.description]
    return dict(zip(cols, row))


def rows_to_dicts(cursor, rows) -> List[Dict[str, Any]]:
    if not rows:
        return []
    if hasattr(rows[0], 'keys'):
        return [dict(r) for r in rows]
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, r)) for r in rows]


def init_db():
    """Create tables and performance indexes if not already existing."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        question_count INTEGER NOT NULL DEFAULT 0,
        subject_id TEXT DEFAULT '',
        semester_id TEXT DEFAULT '',
        class_id TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(quizzes)")
    quiz_columns = [col[1] for col in cursor.fetchall()]
    if 'subject_id' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN subject_id TEXT DEFAULT ''")
    if 'semester_id' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN semester_id TEXT DEFAULT ''")
    if 'class_id' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN class_id TEXT DEFAULT ''")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS semesters (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        semester_id TEXT DEFAULT '',
        class_id TEXT DEFAULT '',
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(subjects)")
    subj_cols = [col[1] for col in cursor.fetchall()]
    if 'semester_id' not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN semester_id TEXT DEFAULT ''")
    if 'class_id' not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN class_id TEXT DEFAULT ''")

    cursor.execute("""
    UPDATE quizzes 
    SET semester_id = (SELECT semester_id FROM subjects WHERE subjects.id = quizzes.subject_id),
        class_id = (SELECT class_id FROM subjects WHERE subjects.id = quizzes.subject_id)
    WHERE (quizzes.subject_id IS NOT NULL AND quizzes.subject_id != '')
      AND (quizzes.semester_id IS NULL OR quizzes.semester_id = '')
    """)

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

    # Performance Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_quiz_order ON questions(quiz_id, order_idx);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes(subject_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_semester_id ON quizzes(semester_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON quizzes(class_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subjects_semester_id ON subjects(semester_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON subjects(class_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_semesters_class_id ON semesters(class_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON attempts(quiz_id);")

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
    invalidate_quiz_cache()
    return quiz_id


def get_quizzes(conn=None) -> List[Dict[str, Any]]:
    """Retrieve list of all quizzes with in-memory caching."""
    cached = cache_get("quizzes_list")
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes ORDER BY created_at DESC")
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)
    if should_close:
        conn.close()

    cache_set("quizzes_list", result, ttl=180)
    return result


def get_quiz(quiz_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve quiz metadata and all questions with in-memory caching."""
    cached = cache_get(f"quiz_{quiz_id}")
    if cached is not None:
        return cached

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,))
    quiz_row = cursor.fetchone()
    if not quiz_row:
        conn.close()
        return None

    quiz_data = row_to_dict(cursor, quiz_row)
    cursor.execute("SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_idx ASC", (quiz_id,))
    q_rows = cursor.fetchall()
    q_dicts = rows_to_dicts(cursor, q_rows)
    conn.close()

    questions = []
    for d in q_dicts:
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
    cache_set(f"quiz_{quiz_id}", quiz_data, ttl=300)
    return quiz_data


def update_quiz_questions(quiz_id: str, questions: List[Dict[str, Any]], title: Optional[str] = None) -> bool:
    """Update quiz and replace questions with modified data from preview."""
    conn = get_connection()
    cursor = conn.cursor()

    if title:
        cursor.execute("UPDATE quizzes SET title = ?, question_count = ? WHERE id = ?", (title, len(questions), quiz_id))
    else:
        cursor.execute("UPDATE quizzes SET question_count = ? WHERE id = ?", (len(questions), quiz_id))

    cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))

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
    invalidate_quiz_cache(quiz_id)
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
    invalidate_quiz_cache(quiz_id)
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


def get_subjects(conn=None) -> List[Dict[str, Any]]:
    """Retrieve list of all subjects sorted by order_idx with caching."""
    cached = cache_get("subjects_list")
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects ORDER BY order_idx ASC, created_at ASC")
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)
    if should_close:
        conn.close()

    cache_set("subjects_list", result, ttl=180)
    return result


def create_subject(name: str, semester_id: Optional[str] = None, class_id: Optional[str] = None) -> Dict[str, Any]:
    """Create a new subject."""
    conn = get_connection()
    cursor = conn.cursor()
    subject_id = f"subj_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM subjects")
    next_order = cursor.fetchone()[0]
    sem_val = semester_id.strip() if semester_id else ''
    cls_val = class_id.strip() if class_id else ''
    if sem_val and not cls_val:
        cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_val,))
        r = cursor.fetchone()
        if r:
            cls_val = r['class_id'] or ''
    cursor.execute(
        "INSERT INTO subjects (id, name, semester_id, class_id, order_idx) VALUES (?, ?, ?, ?, ?)",
        (subject_id, name.strip(), sem_val, cls_val, next_order)
    )
    conn.commit()
    cursor.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()
    invalidate_tree_cache()
    return row


def get_subject(subject_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,))
    row = cursor.fetchone()
    res = row_to_dict(cursor, row) if row else None
    conn.close()
    return res


def update_subject(subject_id: str, name: str, semester_id: Optional[str] = None, class_id: Optional[str] = None) -> bool:
    """Update subject name and optional semester / class placement."""
    conn = get_connection()
    cursor = conn.cursor()
    if semester_id is not None or class_id is not None:
        sem_val = semester_id.strip() if semester_id else ''
        cls_val = class_id.strip() if class_id else ''
        if sem_val and not cls_val:
            cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_val,))
            r = cursor.fetchone()
            if r:
                cls_val = r['class_id'] or ''
        cursor.execute("UPDATE subjects SET name = ?, semester_id = ?, class_id = ? WHERE id = ?", (name.strip(), sem_val, cls_val, subject_id))
        cursor.execute("UPDATE quizzes SET semester_id = ?, class_id = ? WHERE subject_id = ?", (sem_val, cls_val, subject_id))
    else:
        cursor.execute("UPDATE subjects SET name = ? WHERE id = ?", (name.strip(), subject_id))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def move_subject(subject_id: str, semester_id: str, class_id: Optional[str] = None) -> bool:
    """Move a subject into a new semester (and its class), updating all its quizzes."""
    conn = get_connection()
    cursor = conn.cursor()
    sem_val = semester_id.strip() if semester_id else ''
    cls_val = class_id.strip() if class_id else ''
    if sem_val and not cls_val:
        cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_val,))
        r = cursor.fetchone()
        if r:
            cls_val = r['class_id'] or ''
    cursor.execute("UPDATE subjects SET semester_id = ?, class_id = ? WHERE id = ?", (sem_val, cls_val, subject_id))
    cursor.execute("UPDATE quizzes SET semester_id = ?, class_id = ? WHERE subject_id = ?", (sem_val, cls_val, subject_id))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def delete_subject(subject_id: str) -> bool:
    """Delete a subject and reset its quizzes to uncategorized."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET subject_id = '' WHERE subject_id = ?", (subject_id,))
    cursor.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def get_classes(conn=None) -> List[Dict[str, Any]]:
    cached = cache_get("classes_list")
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM classes ORDER BY order_idx ASC, created_at ASC")
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)
    if should_close:
        conn.close()

    cache_set("classes_list", result, ttl=180)
    return result


def create_class(name: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    class_id = f"cls_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM classes")
    next_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO classes (id, name, order_idx) VALUES (?, ?, ?)",
        (class_id, name.strip(), next_order)
    )
    conn.commit()
    cursor.execute("SELECT * FROM classes WHERE id = ?", (class_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()
    invalidate_tree_cache()
    return row


def update_class(class_id: str, name: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE classes SET name = ? WHERE id = ?", (name.strip(), class_id))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def delete_class(class_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET class_id = '', semester_id = '' WHERE class_id = ?", (class_id,))
    cursor.execute("UPDATE subjects SET class_id = '', semester_id = '' WHERE class_id = ?", (class_id,))
    cursor.execute("DELETE FROM semesters WHERE class_id = ?", (class_id,))
    cursor.execute("DELETE FROM classes WHERE id = ?", (class_id,))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def get_semesters(class_id: Optional[str] = None, conn=None) -> List[Dict[str, Any]]:
    cache_key = f"semesters_{class_id or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    if class_id:
        cursor.execute("SELECT * FROM semesters WHERE class_id = ? ORDER BY order_idx ASC, created_at ASC", (class_id,))
    else:
        cursor.execute("SELECT * FROM semesters ORDER BY order_idx ASC, created_at ASC")
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)
    if should_close:
        conn.close()

    cache_set(cache_key, result, ttl=180)
    return result


def create_semester(class_id: str, name: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    semester_id = f"sem_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM semesters WHERE class_id = ?", (class_id,))
    next_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO semesters (id, class_id, name, order_idx) VALUES (?, ?, ?, ?)",
        (semester_id, class_id, name.strip(), next_order)
    )
    conn.commit()
    cursor.execute("SELECT * FROM semesters WHERE id = ?", (semester_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()
    invalidate_tree_cache()
    return row


def update_semester(semester_id: str, name: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE semesters SET name = ? WHERE id = ?", (name.strip(), semester_id))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def delete_semester(semester_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET semester_id = '' WHERE semester_id = ?", (semester_id,))
    cursor.execute("UPDATE subjects SET semester_id = '' WHERE semester_id = ?", (semester_id,))
    cursor.execute("DELETE FROM semesters WHERE id = ?", (semester_id,))
    conn.commit()
    conn.close()
    invalidate_tree_cache()
    return True


def update_quiz_subject(quiz_id: str, subject_id: Optional[str] = None) -> bool:
    """Assign quiz to a subject or move it out to uncategorized."""
    return update_quiz_placement(quiz_id, subject_id=subject_id)


def update_quiz_placement(
    quiz_id: str,
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    class_id: Optional[str] = None
) -> bool:
    """Update placement of a quiz to a subject and/or semester and/or class."""
    conn = get_connection()
    cursor = conn.cursor()

    sub_id = subject_id.strip() if subject_id else ''
    sem_id = semester_id.strip() if semester_id else ''
    cls_id = class_id.strip() if class_id else ''

    if sub_id:
        cursor.execute("SELECT semester_id, class_id FROM subjects WHERE id = ?", (sub_id,))
        row = cursor.fetchone()
        if row:
            if not sem_id:
                sem_id = row['semester_id'] or ''
            if not cls_id:
                cls_id = row['class_id'] or ''

    if sem_id and not cls_id:
        cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_id,))
        row = cursor.fetchone()
        if row:
            cls_id = row['class_id'] or ''

    cursor.execute("""
    UPDATE quizzes
    SET subject_id = ?, semester_id = ?, class_id = ?
    WHERE id = ?
    """, (sub_id, sem_id, cls_id, quiz_id))
    conn.commit()
    conn.close()
    invalidate_quiz_cache(quiz_id)
    invalidate_tree_cache()
    return True


def get_full_tree() -> Dict[str, Any]:
    """Retrieve full hierarchical structure: Classes -> Semesters -> Subjects with Quiz counts."""
    cached = cache_get("full_tree")
    if cached is not None:
        return cached

    # Use a single shared connection for all queries
    conn = get_connection()
    classes = get_classes(conn=conn)
    semesters = get_semesters(conn=conn)
    subjects = get_subjects(conn=conn)
    quizzes = get_quizzes(conn=conn)
    conn.close()

    subject_quiz_counts = {}
    semester_quiz_counts = {}
    class_quiz_counts = {}
    uncategorized_quizzes = []

    for q in quizzes:
        sub_id = q.get('subject_id') or ''
        sem_id = q.get('semester_id') or ''
        cls_id = q.get('class_id') or ''

        if sub_id:
            subject_quiz_counts[sub_id] = subject_quiz_counts.get(sub_id, 0) + 1
        if sem_id:
            semester_quiz_counts[sem_id] = semester_quiz_counts.get(sem_id, 0) + 1
        if cls_id:
            class_quiz_counts[cls_id] = class_quiz_counts.get(cls_id, 0) + 1

        if not sub_id and not sem_id and not cls_id:
            uncategorized_quizzes.append(q)

    tree_classes = []
    for cls in classes:
        cls_id = cls['id']
        cls_semesters = []
        for sem in semesters:
            if sem['class_id'] == cls_id:
                sem_id = sem['id']
                sem_subjects = []
                for sub in subjects:
                    if sub.get('semester_id') == sem_id or (not sub.get('semester_id') and sub.get('class_id') == cls_id):
                        sem_subjects.append({
                            **sub,
                            "quiz_count": subject_quiz_counts.get(sub['id'], 0)
                        })
                cls_semesters.append({
                    **sem,
                    "subjects": sem_subjects,
                    "quiz_count": semester_quiz_counts.get(sem_id, 0)
                })
        tree_classes.append({
            **cls,
            "semesters": cls_semesters,
            "quiz_count": class_quiz_counts.get(cls_id, 0)
        })

    result = {
        "classes": tree_classes,
        "all_classes": classes,
        "all_semesters": semesters,
        "all_subjects": subjects,
        "total_quizzes": len(quizzes),
        "uncategorized_count": len(uncategorized_quizzes)
    }
    cache_set("full_tree", result, ttl=180)
    return result
