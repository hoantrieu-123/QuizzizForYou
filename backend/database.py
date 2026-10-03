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


def invalidate_doc_cache(doc_id: Optional[str] = None):
    """Invalidate cached documents and tree."""
    cache_clear_prefix("documents_")
    cache_clear_prefix("doc_folders_")
    cache_clear_key("full_tree")
    if doc_id:
        cache_clear_key(f"doc_{doc_id}")


def invalidate_tree_cache():
    """Invalidate hierarchical tree and categorization caches."""
    cache_clear_key("full_tree")
    cache_clear_key("classes_list")
    cache_clear_key("subjects_list")
    cache_clear_prefix("semesters_")
    cache_clear_key("quizzes_list")
    cache_clear_prefix("documents_")
    cache_clear_prefix("doc_folders_")


# ==============================================================================
# Database Connection with Resilience & Auto-Retry for Turso Hrana
# ==============================================================================
class ResilientCursor:
    def __init__(self, cursor, conn_wrapper):
        self._cursor = cursor
        self._conn_wrapper = conn_wrapper

    def execute(self, sql, params=()):
        for attempt in range(4):
            try:
                if params:
                    return self._cursor.execute(sql, params)
                return self._cursor.execute(sql)
            except Exception as e:
                err = str(e).lower()
                if ('sqlite_busy' in err or 'stream was idle' in err or 'retry the transaction' in err) and attempt < 3:
                    time.sleep(0.15 * (attempt + 1))
                    self._conn_wrapper.reconnect()
                    self._cursor = self._conn_wrapper._raw_conn.cursor()
                    continue
                raise

    def executemany(self, sql, seq_of_params):
        for attempt in range(4):
            try:
                return self._cursor.executemany(sql, seq_of_params)
            except Exception as e:
                err = str(e).lower()
                if ('sqlite_busy' in err or 'stream was idle' in err or 'retry the transaction' in err) and attempt < 3:
                    time.sleep(0.15 * (attempt + 1))
                    self._conn_wrapper.reconnect()
                    self._cursor = self._conn_wrapper._raw_conn.cursor()
                    continue
                raise

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()

    def __iter__(self):
        return iter(self._cursor)

    @property
    def description(self):
        return self._cursor.description

    @property
    def rowcount(self):
        return getattr(self._cursor, 'rowcount', -1)


class ResilientConnection:
    def __init__(self, create_raw_conn_fn):
        self._create_raw_conn_fn = create_raw_conn_fn
        self._raw_conn = create_raw_conn_fn()

    def reconnect(self):
        try:
            self._raw_conn.close()
        except Exception:
            pass
        self._raw_conn = self._create_raw_conn_fn()

    def cursor(self):
        return ResilientCursor(self._raw_conn.cursor(), self)

    def execute(self, sql, params=()):
        c = self.cursor()
        c.execute(sql, params)
        return c

    def commit(self):
        try:
            return self._raw_conn.commit()
        except Exception as e:
            err = str(e).lower()
            if 'sqlite_busy' in err or 'stream was idle' in err or 'retry the transaction' in err:
                pass  # With autocommit=True, already committed
            else:
                raise

    def rollback(self):
        try:
            return self._raw_conn.rollback()
        except Exception:
            pass

    def close(self):
        try:
            self._raw_conn.close()
        except Exception:
            pass

    @property
    def row_factory(self):
        return getattr(self._raw_conn, 'row_factory', None)

    @row_factory.setter
    def row_factory(self, val):
        self._raw_conn.row_factory = val


def get_raw_connection():
    if TURSO_DATABASE_URL and HAS_LIBSQL:
        url = TURSO_DATABASE_URL
        if url.startswith("libsql://"):
            url = "https://" + url[len("libsql://"):]
        try:
            return libsql.connect(database=url, auth_token=TURSO_AUTH_TOKEN, autocommit=True)
        except Exception as e:
            print(f"Warning: Connecting to Turso via https failed ({e}), falling back to direct URL: {TURSO_DATABASE_URL}")
            return libsql.connect(database=TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN, autocommit=True)

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


def get_connection():
    return ResilientConnection(get_raw_connection)


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


_DB_INITIALIZED = False

def init_db():
    """Create tables and performance indexes if not already existing."""
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
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
    if 'is_deleted' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN is_deleted INTEGER DEFAULT 0")
    if 'deleted_at' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN deleted_at TIMESTAMP")
    if 'created_ip' not in quiz_columns:
        cursor.execute("ALTER TABLE quizzes ADD COLUMN created_ip TEXT DEFAULT ''")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(classes)")
    class_cols = [col[1] for col in cursor.fetchall()]
    if 'created_ip' not in class_cols:
        cursor.execute("ALTER TABLE classes ADD COLUMN created_ip TEXT DEFAULT ''")

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

    cursor.execute("PRAGMA table_info(semesters)")
    sem_cols = [col[1] for col in cursor.fetchall()]
    if 'created_ip' not in sem_cols:
        cursor.execute("ALTER TABLE semesters ADD COLUMN created_ip TEXT DEFAULT ''")

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
    if 'created_ip' not in subj_cols:
        cursor.execute("ALTER TABLE subjects ADD COLUMN created_ip TEXT DEFAULT ''")

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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT DEFAULT NULL,
        subject_id TEXT DEFAULT '',
        semester_id TEXT DEFAULT '',
        class_id TEXT DEFAULT '',
        order_idx INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        file_type TEXT NOT NULL,
        folder_id TEXT DEFAULT '',
        subject_id TEXT DEFAULT '',
        semester_id TEXT DEFAULT '',
        class_id TEXT DEFAULT '',
        folder_path TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(documents)")
    doc_cols = [col[1] for col in cursor.fetchall()]
    if 'folder_id' not in doc_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN folder_id TEXT DEFAULT ''")
    if 'is_deleted' not in doc_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN is_deleted INTEGER DEFAULT 0")
    if 'deleted_at' not in doc_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMP")
    if 'created_ip' not in doc_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN created_ip TEXT DEFAULT ''")

    cursor.execute("PRAGMA table_info(document_folders)")
    folder_cols = [col[1] for col in cursor.fetchall()]
    if 'created_ip' not in folder_cols:
        cursor.execute("ALTER TABLE document_folders ADD COLUMN created_ip TEXT DEFAULT ''")

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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_subject_id ON documents(subject_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_semester_id ON documents(semester_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_class_id ON documents(class_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_folders_parent_id ON document_folders(parent_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_folders_subject_id ON document_folders(subject_id);")

    # Visitor Access Logs (Cloudflare + Turso Permanent Logging)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS visitor_logs (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        country TEXT DEFAULT '',
        city TEXT DEFAULT '',
        method TEXT DEFAULT 'GET',
        path TEXT NOT NULL,
        user_agent TEXT DEFAULT '',
        status_code INTEGER DEFAULT 200,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_visitor_logs_created_at ON visitor_logs(created_at DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_visitor_logs_ip ON visitor_logs(ip_address);")

    # System Settings Table (Admin PIN, etc.)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()

# Auto-initialize database tables on module load
init_db()


def save_quiz(title: str, filename: str, questions: List[Dict[str, Any]], created_ip: str = "") -> str:
    """Save parsed quiz and all questions into SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    quiz_id = f"quiz_{uuid.uuid4().hex[:10]}"

    cursor.execute(
        "INSERT INTO quizzes (id, title, filename, question_count, created_ip) VALUES (?, ?, ?, ?, ?)",
        (quiz_id, title, filename, len(questions), created_ip or '')
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


def get_quizzes(conn=None, include_deleted=False) -> List[Dict[str, Any]]:
    """Retrieve list of all active quizzes with in-memory caching."""
    cache_key = "quizzes_list_all" if include_deleted else "quizzes_list"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    if include_deleted:
        cursor.execute("SELECT * FROM quizzes ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM quizzes WHERE COALESCE(is_deleted, 0) = 0 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)
    if should_close:
        conn.close()

    cache_set(cache_key, result, ttl=180)
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
    """Soft delete a quiz (movable to trash bin)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (quiz_id,))
    conn.commit()
    conn.close()
    invalidate_quiz_cache(quiz_id)
    return True


def restore_quiz(quiz_id: str) -> bool:
    """Restore a soft-deleted quiz."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quizzes SET is_deleted = 0, deleted_at = NULL WHERE id = ?", (quiz_id,))
    conn.commit()
    conn.close()
    invalidate_quiz_cache(quiz_id)
    return True


def permanent_delete_quiz(quiz_id: str) -> bool:
    """Permanently delete a quiz, its questions, and its attempts."""
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


def create_subject(name: str, semester_id: Optional[str] = None, class_id: Optional[str] = None, created_ip: str = "") -> Dict[str, Any]:
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
        r = row_to_dict(cursor, cursor.fetchone())
        if r:
            cls_val = r.get('class_id') or ''
    cursor.execute(
        "INSERT INTO subjects (id, name, semester_id, class_id, order_idx, created_ip) VALUES (?, ?, ?, ?, ?, ?)",
        (subject_id, name.strip(), sem_val, cls_val, next_order, created_ip or '')
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
            r = row_to_dict(cursor, cursor.fetchone())
            if r:
                cls_val = r.get('class_id') or ''
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
        r = row_to_dict(cursor, cursor.fetchone())
        if r:
            cls_val = r.get('class_id') or ''
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


def create_class(name: str, created_ip: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    class_id = f"cls_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM classes")
    next_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO classes (id, name, order_idx, created_ip) VALUES (?, ?, ?, ?)",
        (class_id, name.strip(), next_order, created_ip or '')
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


def create_semester(class_id: str, name: str, created_ip: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    semester_id = f"sem_{uuid.uuid4().hex[:8]}"
    cursor.execute("SELECT COALESCE(MAX(order_idx), 0) + 1 FROM semesters WHERE class_id = ?", (class_id,))
    next_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO semesters (id, class_id, name, order_idx, created_ip) VALUES (?, ?, ?, ?, ?)",
        (semester_id, class_id, name.strip(), next_order, created_ip or '')
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
        row = row_to_dict(cursor, cursor.fetchone())
        if row:
            if not sem_id:
                sem_id = row.get('semester_id') or ''
            if not cls_id:
                cls_id = row.get('class_id') or ''

    if sem_id and not cls_id:
        cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_id,))
        row = row_to_dict(cursor, cursor.fetchone())
        if row:
            cls_id = row.get('class_id') or ''

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


# ==============================================================================
# Document Management Functions
# ==============================================================================
# Document Folders (Tree Structure)
# ==============================================================================
def create_document_folder(
    name: str,
    parent_id: Optional[str] = None,
    subject_id: str = '',
    semester_id: str = '',
    class_id: str = '',
    created_ip: str = ''
) -> Dict[str, Any]:
    """Create a new folder or subfolder for documents."""
    conn = get_connection()
    cursor = conn.cursor()
    folder_id = f"folder_{uuid.uuid4().hex[:10]}"

    clean_parent = parent_id.strip() if parent_id and parent_id.strip() else None

    # Inherit subject_id, semester_id, class_id from parent folder if not provided
    if clean_parent and not subject_id:
        cursor.execute("SELECT subject_id, semester_id, class_id FROM document_folders WHERE id = ?", (clean_parent,))
        p_row = row_to_dict(cursor, cursor.fetchone())
        if p_row:
            subject_id = p_row.get('subject_id') or ''
            semester_id = p_row.get('semester_id') or ''
            class_id = p_row.get('class_id') or ''

    cursor.execute("""
    INSERT INTO document_folders (
        id, name, parent_id, subject_id, semester_id, class_id, created_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        folder_id, name.strip(), clean_parent,
        subject_id or '', semester_id or '', class_id or '',
        created_ip or ''
    ))
    conn.commit()

    cursor.execute("SELECT * FROM document_folders WHERE id = ?", (folder_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()
    invalidate_doc_cache()
    return row


def get_document_folder(folder_id: str, conn = None) -> Optional[Dict[str, Any]]:
    """Retrieve single folder metadata."""
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM document_folders WHERE id = ?", (folder_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    if should_close:
        conn.close()
    return row


def get_document_folders(
    parent_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    conn = None
) -> List[Dict[str, Any]]:
    """Retrieve list of folders with optional parent_id filter."""
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    query = "SELECT * FROM document_folders WHERE 1=1"
    params = []

    if parent_id is not None:
        if parent_id == 'root' or parent_id == '':
            query += " AND (parent_id IS NULL OR parent_id = '')"
        else:
            query += " AND parent_id = ?"
            params.append(parent_id)

    if subject_id:
        query += " AND subject_id = ?"
        params.append(subject_id)

    query += " ORDER BY order_idx ASC, name ASC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)

    if should_close:
        conn.close()
    return result


def get_document_folders_tree(
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    class_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve complete hierarchical tree of folders with document counts."""
    cache_key = f"doc_folders_tree_{class_id or ''}_{semester_id or ''}_{subject_id or ''}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    conn = get_connection()
    cursor = conn.cursor()

    # Query all folders
    query = "SELECT * FROM document_folders WHERE 1=1"
    params = []
    if subject_id:
        query += " AND subject_id = ?"
        params.append(subject_id)
    elif semester_id:
        query += " AND semester_id = ?"
        params.append(semester_id)
    elif class_id:
        query += " AND class_id = ?"
        params.append(class_id)

    query += " ORDER BY order_idx ASC, name ASC"
    cursor.execute(query, tuple(params))
    all_folders = rows_to_dicts(cursor, cursor.fetchall())

    # Query document counts grouped by folder_id
    cursor.execute("SELECT folder_id, COUNT(*) as cnt FROM documents GROUP BY folder_id")
    folder_doc_counts = {}
    for r in rows_to_dicts(cursor, cursor.fetchall()):
        if r.get('folder_id'):
            folder_doc_counts[r['folder_id']] = r.get('cnt', 0)
    conn.close()

    # Build folder lookup and hierarchy
    folder_map = {}
    for f in all_folders:
        folder_map[f['id']] = {
            **f,
            "children": [],
            "direct_doc_count": folder_doc_counts.get(f['id'], 0),
            "doc_count": folder_doc_counts.get(f['id'], 0)
        }

    root_folders = []
    for f in all_folders:
        p_id = f.get('parent_id')
        if p_id and p_id in folder_map:
            folder_map[p_id]["children"].append(folder_map[f['id']])
        else:
            root_folders.append(folder_map[f['id']])

    # Compute total doc_count including all subfolders
    def compute_total_docs(node):
        total = node["direct_doc_count"]
        for child in node["children"]:
            total += compute_total_docs(child)
        node["doc_count"] = total
        return total

    for rf in root_folders:
        compute_total_docs(rf)

    cache_set(cache_key, root_folders, ttl=180)
    return root_folders


def get_folder_breadcrumbs(folder_id: str) -> List[Dict[str, Any]]:
    """Retrieve breadcrumb trail from root to the given folder."""
    if not folder_id:
        return []

    conn = get_connection()
    cursor = conn.cursor()
    trail = []
    curr_id = folder_id

    while curr_id:
        cursor.execute("SELECT id, name, parent_id FROM document_folders WHERE id = ?", (curr_id,))
        row = row_to_dict(cursor, cursor.fetchone())
        if not row:
            break
        trail.append({"id": row['id'], "name": row['name']})
        curr_id = row.get('parent_id')

    conn.close()
    trail.reverse()
    return trail


def update_document_folder(
    folder_id: str,
    name: Optional[str] = None,
    parent_id: Optional[str] = None
) -> bool:
    """Update name or move folder to new parent."""
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name.strip())

    if parent_id is not None:
        clean_p = parent_id.strip() if parent_id.strip() else None
        # Avoid circular parent assignment
        if clean_p != folder_id:
            updates.append("parent_id = ?")
            params.append(clean_p)

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(folder_id)

    query = f"UPDATE document_folders SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

    invalidate_doc_cache()
    return True


def delete_document_folder(folder_id: str) -> List[str]:
    """
    Delete folder and all its subfolders recursively.
    Returns list of file_paths of documents that need to be deleted from disk.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Find all descendant folder IDs recursively
    to_check = [folder_id]
    all_folder_ids = []

    while to_check:
        curr = to_check.pop(0)
        all_folder_ids.append(curr)
        cursor.execute("SELECT id FROM document_folders WHERE parent_id = ?", (curr,))
        children = [r[0] for r in cursor.fetchall()]
        to_check.extend(children)

    # Collect physical file paths of documents in these folders
    file_paths_to_delete = []
    placeholders = ', '.join(['?'] * len(all_folder_ids))
    cursor.execute(f"SELECT file_path FROM documents WHERE folder_id IN ({placeholders})", tuple(all_folder_ids))
    for r in cursor.fetchall():
        if r[0]:
            file_paths_to_delete.append(r[0])

    # Delete documents in these folders
    cursor.execute(f"DELETE FROM documents WHERE folder_id IN ({placeholders})", tuple(all_folder_ids))

    # Delete the folders
    cursor.execute(f"DELETE FROM document_folders WHERE id IN ({placeholders})", tuple(all_folder_ids))

    conn.commit()
    conn.close()

    invalidate_doc_cache()
    return file_paths_to_delete


# ==============================================================================
# Document Management Functions
# ==============================================================================
def create_document(
    title: str,
    filename: str,
    file_path: str,
    file_size: int,
    file_type: str,
    folder_id: str = '',
    subject_id: str = '',
    semester_id: str = '',
    class_id: str = '',
    folder_path: str = '',
    created_ip: str = ''
) -> Dict[str, Any]:
    """Create a new document entry in database."""
    conn = get_connection()
    cursor = conn.cursor()
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"

    clean_folder_id = folder_id.strip() if folder_id else ''
    sub_id = subject_id.strip() if subject_id else ''
    sem_id = semester_id.strip() if semester_id else ''
    cls_id = class_id.strip() if class_id else ''

    # If folder_id provided and no subject_id, inherit from folder
    if clean_folder_id and (not sub_id or not sem_id or not cls_id):
        cursor.execute("SELECT subject_id, semester_id, class_id FROM document_folders WHERE id = ?", (clean_folder_id,))
        f_row = row_to_dict(cursor, cursor.fetchone())
        if f_row:
            if not sub_id: sub_id = f_row.get('subject_id') or ''
            if not sem_id: sem_id = f_row.get('semester_id') or ''
            if not cls_id: cls_id = f_row.get('class_id') or ''

    # Auto-resolve semester_id and class_id if subject_id is supplied
    if sub_id and (not sem_id or not cls_id):
        cursor.execute("SELECT semester_id, class_id FROM subjects WHERE id = ?", (sub_id,))
        row = row_to_dict(cursor, cursor.fetchone())
        if row:
            if not sem_id:
                sem_id = row.get('semester_id') or ''
            if not cls_id:
                cls_id = row.get('class_id') or ''

    if sem_id and not cls_id:
        cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_id,))
        row = row_to_dict(cursor, cursor.fetchone())
        if row:
            cls_id = row.get('class_id') or ''

    cursor.execute("""
    INSERT INTO documents (
        id, title, filename, file_path, file_size, file_type, folder_id,
        subject_id, semester_id, class_id, folder_path, created_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        doc_id, title.strip(), filename.strip(), file_path, file_size, file_type.lower(),
        clean_folder_id, sub_id, sem_id, cls_id, folder_path or '', created_ip or ''
    ))
    conn.commit()

    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()
    invalidate_doc_cache(doc_id)
    return row


def get_documents(
    class_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    include_deleted: bool = False,
    conn = None
) -> List[Dict[str, Any]]:
    """Retrieve list of documents filtered by class, semester, subject, folder, or search term."""
    cache_key = f"documents_{class_id or ''}_{semester_id or ''}_{subject_id or ''}_{folder_id or ''}_{file_type or ''}_{search or ''}_{include_deleted}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    query = "SELECT * FROM documents WHERE 1=1"
    if not include_deleted:
        query += " AND COALESCE(is_deleted, 0) = 0"
    params = []

    if folder_id is not None:
        if folder_id == 'root':
            query += " AND (folder_id IS NULL OR folder_id = '')"
        elif folder_id:
            query += " AND folder_id = ?"
            params.append(folder_id)

    if subject_id:
        query += " AND subject_id = ?"
        params.append(subject_id)
    elif semester_id:
        query += " AND semester_id = ?"
        params.append(semester_id)
    elif class_id:
        query += " AND class_id = ?"
        params.append(class_id)

    if file_type:
        query += " AND file_type = ?"
        params.append(file_type.lower())

    if search:
        query += " AND (title LIKE ? OR filename LIKE ? OR folder_path LIKE ?)"
        term = f"%{search.strip()}%"
        params.extend([term, term, term])

    query += " ORDER BY created_at DESC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    result = rows_to_dicts(cursor, rows)

    if should_close:
        conn.close()

    cache_set(cache_key, result, ttl=180)
    return result


def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Get single document by ID."""
    cached = cache_get(f"doc_{doc_id}")
    if cached is not None:
        return cached

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    conn.close()

    if row:
        cache_set(f"doc_{doc_id}", row, ttl=300)
    return row


def update_document(
    doc_id: str,
    title: Optional[str] = None,
    filename: Optional[str] = None,
    file_path: Optional[str] = None,
    folder_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    class_id: Optional[str] = None,
    folder_path: Optional[str] = None
) -> bool:
    """Update title, filename, file_path and/or placement of a document."""
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if title is not None:
        updates.append("title = ?")
        params.append(title.strip())

    if filename is not None:
        updates.append("filename = ?")
        params.append(filename.strip())

    if file_path is not None:
        updates.append("file_path = ?")
        params.append(file_path.strip())

    if folder_id is not None:
        updates.append("folder_id = ?")
        params.append(folder_id.strip())

    if subject_id is not None:
        sub_id = subject_id.strip() if subject_id else ''
        sem_id = semester_id.strip() if semester_id else ''
        cls_id = class_id.strip() if class_id else ''

        if sub_id and (not sem_id or not cls_id):
            cursor.execute("SELECT semester_id, class_id FROM subjects WHERE id = ?", (sub_id,))
            s_row = row_to_dict(cursor, cursor.fetchone())
            if s_row:
                if not sem_id:
                    sem_id = s_row.get('semester_id') or ''
                if not cls_id:
                    cls_id = s_row.get('class_id') or ''

        if sem_id and not cls_id:
            cursor.execute("SELECT class_id FROM semesters WHERE id = ?", (sem_id,))
            c_row = row_to_dict(cursor, cursor.fetchone())
            if c_row:
                cls_id = c_row.get('class_id') or ''

        updates.extend(["subject_id = ?", "semester_id = ?", "class_id = ?"])
        params.extend([sub_id, sem_id, cls_id])

    if folder_path is not None:
        updates.append("folder_path = ?")
        params.append(folder_path.strip())

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(doc_id)

    query = f"UPDATE documents SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

    invalidate_doc_cache(doc_id)
    return True


def delete_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Soft delete document from database without removing physical file from disk."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    if not row:
        conn.close()
        return None

    cursor.execute("UPDATE documents SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    invalidate_doc_cache(doc_id)
    return row


def restore_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Restore a soft-deleted document."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    if not row:
        conn.close()
        return None

    cursor.execute("UPDATE documents SET is_deleted = 0, deleted_at = NULL WHERE id = ?", (doc_id,))
    conn.commit()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    restored = row_to_dict(cursor, cursor.fetchone())
    conn.close()

    invalidate_doc_cache(doc_id)
    return restored


def permanent_delete_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Permanently delete document from database and return its metadata so file can be removed from disk."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = row_to_dict(cursor, cursor.fetchone())
    if not row:
        conn.close()
        return None

    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    invalidate_doc_cache(doc_id)
    return row


def get_trash_items() -> Dict[str, Any]:
    """Retrieve all soft-deleted documents and quizzes."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE COALESCE(is_deleted, 0) = 1 ORDER BY deleted_at DESC")
    deleted_docs = rows_to_dicts(cursor, cursor.fetchall())

    cursor.execute("SELECT * FROM quizzes WHERE COALESCE(is_deleted, 0) = 1 ORDER BY deleted_at DESC")
    deleted_quizzes = rows_to_dicts(cursor, cursor.fetchall())

    conn.close()
    return {
        "documents": deleted_docs,
        "quizzes": deleted_quizzes,
        "total": len(deleted_docs) + len(deleted_quizzes)
    }


def restore_all_trash() -> Dict[str, Any]:
    """Restore all soft-deleted documents and quizzes in one action."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM documents WHERE COALESCE(is_deleted, 0) = 1")
    doc_row = cursor.fetchone()
    doc_count = doc_row[0] if doc_row else 0
    cursor.execute("UPDATE documents SET is_deleted = 0, deleted_at = NULL WHERE COALESCE(is_deleted, 0) = 1")

    cursor.execute("SELECT COUNT(*) FROM quizzes WHERE COALESCE(is_deleted, 0) = 1")
    quiz_row = cursor.fetchone()
    quiz_count = quiz_row[0] if quiz_row else 0
    cursor.execute("UPDATE quizzes SET is_deleted = 0, deleted_at = NULL WHERE COALESCE(is_deleted, 0) = 1")

    conn.commit()
    conn.close()

    cache_clear_all()
    return {
        "success": True,
        "restored_docs": doc_count,
        "restored_quizzes": quiz_count,
        "message": f"Đã khôi phục thành công {doc_count} tài liệu và {quiz_count} đề thi!"
    }


def clear_trash_permanently() -> Dict[str, Any]:
    """Permanently delete all soft-deleted documents and quizzes."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT file_path FROM documents WHERE COALESCE(is_deleted, 0) = 1")
    doc_files = [r[0] for r in cursor.fetchall() if r[0]]

    cursor.execute("DELETE FROM documents WHERE COALESCE(is_deleted, 0) = 1")

    cursor.execute("SELECT id FROM quizzes WHERE COALESCE(is_deleted, 0) = 1")
    quiz_ids = [r[0] for r in cursor.fetchall()]
    for qid in quiz_ids:
        cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (qid,))
        cursor.execute("DELETE FROM attempts WHERE quiz_id = ?", (qid,))
    cursor.execute("DELETE FROM quizzes WHERE COALESCE(is_deleted, 0) = 1")

    conn.commit()
    conn.close()

    cache_clear_all()
    return {
        "files_to_remove": doc_files,
        "deleted_docs": len(doc_files),
        "deleted_quizzes": len(quiz_ids)
    }


def get_full_tree() -> Dict[str, Any]:
    """Retrieve full hierarchical structure: Classes -> Semesters -> Subjects with Quiz and Document counts."""
    cached = cache_get("full_tree")
    if cached is not None:
        return cached

    # Use a single shared connection for all queries
    conn = get_connection()
    classes = get_classes(conn=conn)
    semesters = get_semesters(conn=conn)
    subjects = get_subjects(conn=conn)
    quizzes = get_quizzes(conn=conn)
    documents = get_documents(conn=conn)
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

    subject_doc_counts = {}
    semester_doc_counts = {}
    class_doc_counts = {}
    uncategorized_docs = []

    for d in documents:
        sub_id = d.get('subject_id') or ''
        sem_id = d.get('semester_id') or ''
        cls_id = d.get('class_id') or ''

        if sub_id:
            subject_doc_counts[sub_id] = subject_doc_counts.get(sub_id, 0) + 1
        if sem_id:
            semester_doc_counts[sem_id] = semester_doc_counts.get(sem_id, 0) + 1
        if cls_id:
            class_doc_counts[cls_id] = class_doc_counts.get(cls_id, 0) + 1

        if not sub_id and not sem_id and not cls_id:
            uncategorized_docs.append(d)

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
                            "quiz_count": subject_quiz_counts.get(sub['id'], 0),
                            "doc_count": subject_doc_counts.get(sub['id'], 0)
                        })
                cls_semesters.append({
                    **sem,
                    "subjects": sem_subjects,
                    "quiz_count": semester_quiz_counts.get(sem_id, 0),
                    "doc_count": semester_doc_counts.get(sem_id, 0)
                })
        tree_classes.append({
            **cls,
            "semesters": cls_semesters,
            "quiz_count": class_quiz_counts.get(cls_id, 0),
            "doc_count": class_doc_counts.get(cls_id, 0)
        })

    result = {
        "classes": tree_classes,
        "all_classes": classes,
        "all_semesters": semesters,
        "all_subjects": subjects,
        "total_quizzes": len(quizzes),
        "total_documents": len(documents),
        "uncategorized_count": len(uncategorized_quizzes),
        "uncategorized_doc_count": len(uncategorized_docs)
    }
    cache_set("full_tree", result, ttl=180)
    return result


# ==============================================================================
# Visitor Access Logs (Cloudflare + Turso IP Tracking)
# ==============================================================================
def log_visitor(ip_address: str, country: str = '', city: str = '', method: str = 'GET', path: str = '', user_agent: str = '', status_code: int = 200):
    """Log an incoming HTTP request/visitor to SQLite or Cloud Turso."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        log_id = f"log_{uuid.uuid4().hex[:12]}"
        cursor.execute(
            """INSERT INTO visitor_logs (id, ip_address, country, city, method, path, user_agent, status_code)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (log_id, ip_address, country or '', city or '', method or 'GET', path or '', user_agent or '', status_code or 200)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging visitor: {e}")


def get_visitor_logs(limit: int = 100, offset: int = 0, search: str = '') -> Dict[str, Any]:
    """Retrieve visitor logs with total count, unique IP count, and optional search filter."""
    conn = get_connection()
    cursor = conn.cursor()

    where_clause = ""
    params: List[Any] = []
    if search and search.strip():
        s = f"%{search.strip()}%"
        where_clause = "WHERE ip_address LIKE ? OR country LIKE ? OR path LIKE ? OR user_agent LIKE ?"
        params = [s, s, s, s]

    cursor.execute(f"SELECT COUNT(*) FROM visitor_logs {where_clause}", params)
    total_row = cursor.fetchone()
    total = total_row[0] if total_row else 0

    cursor.execute(f"SELECT COUNT(DISTINCT ip_address) FROM visitor_logs {where_clause}", params)
    unique_row = cursor.fetchone()
    unique_ips = unique_row[0] if unique_row else 0

    query = f"""SELECT id, ip_address, country, city, method, path, user_agent, status_code, created_at 
               FROM visitor_logs {where_clause} 
               ORDER BY created_at DESC 
               LIMIT ? OFFSET ?"""
    cursor.execute(query, params + [limit, offset])
    rows = cursor.fetchall()
    logs = rows_to_dicts(cursor, rows)
    conn.close()

    return {
        "total": total,
        "unique_ips": unique_ips,
        "logs": logs
    }


def clear_visitor_logs() -> bool:
    """Clear all visitor logs."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM visitor_logs")
    conn.commit()
    conn.close()
    return True


# ==============================================================================
# System Settings & Admin Authentication Management
# ==============================================================================
def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Retrieve a setting value by key from system_settings table."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return row[0] if isinstance(row, (tuple, list)) else row["value"]
    except Exception as e:
        print(f"Error reading setting {key}: {e}")
    return default


def set_setting(key: str, value: str):
    """Store or update a setting value by key."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO system_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (key, value))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error writing setting {key}: {e}")
        raise e


def get_admin_pin() -> str:
    """Get the current admin PIN from database, environment variable, or default ('1234')."""
    try:
        db_pin = get_setting("admin_pin")
        if db_pin and str(db_pin).strip():
            return str(db_pin).strip()
    except Exception:
        pass

    env_pin = os.environ.get("ADMIN_PIN")
    if env_pin and str(env_pin).strip():
        return str(env_pin).strip()

    return "1234"


def set_admin_pin(new_pin: str):
    """Update admin PIN in the database."""
    clean_pin = str(new_pin).strip()
    if not clean_pin or len(clean_pin) < 4:
        raise ValueError("Mã PIN phải có ít nhất 4 ký tự")
    set_setting("admin_pin", clean_pin)


def verify_admin_pin(pin: Optional[str]) -> bool:
    """Verify if the provided PIN matches the admin PIN."""
    if not pin:
        return False
    return str(pin).strip() == get_admin_pin()


# ==============================================================================
# Super Admin IP Management (Quyền IP cao nhất)
# ==============================================================================
def get_super_admin_ips() -> List[str]:
    """Get list of authorized super admin IPs from database and environment."""
    ips_set = set()
    # 1. Read from system_settings
    try:
        raw = get_setting("super_admin_ips")
        if raw:
            loaded = json.loads(raw)
            if isinstance(loaded, list):
                for ip in loaded:
                    if ip and str(ip).strip():
                        ips_set.add(str(ip).strip())
    except Exception as e:
        print(f"Error loading super_admin_ips: {e}")

    # 2. Check environment variable SUPER_ADMIN_IPS
    env_ips = os.environ.get("SUPER_ADMIN_IPS", "")
    if env_ips:
        for ip in env_ips.split(","):
            if ip.strip():
                ips_set.add(ip.strip())

    return sorted(list(ips_set))


def set_super_admin_ips(ips: List[str]):
    """Save list of super admin IPs to database."""
    clean_ips = []
    for ip in ips:
        clean = str(ip).strip()
        if clean and clean not in clean_ips:
            clean_ips.append(clean)
    set_setting("super_admin_ips", json.dumps(clean_ips))


def add_super_admin_ip(ip: str) -> List[str]:
    """Grant super admin rights to an IP address."""
    clean = str(ip).strip()
    if not clean:
        raise ValueError("Địa chỉ IP không được để trống")
    current = get_super_admin_ips()
    if clean not in current:
        current.append(clean)
        set_super_admin_ips(current)
    return current


def remove_super_admin_ip(ip: str) -> List[str]:
    """Revoke super admin rights from an IP address."""
    clean = str(ip).strip()
    current = get_super_admin_ips()
    if clean in current:
        current.remove(clean)
        set_super_admin_ips(current)
    return current


def is_super_admin_ip(ip: Optional[str]) -> bool:
    """Check if an IP address has super admin privileges."""
    if not ip:
        return False
    clean = str(ip).strip()
    return clean in get_super_admin_ips()



