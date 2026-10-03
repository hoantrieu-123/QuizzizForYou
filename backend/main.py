"""
FastAPI Server for Word Docx Quiz Application
Handles file upload, XML highlight parsing, quiz editing, interactive quiz taking, and grading.
"""
import os
import io
import json
import uuid
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.word_parser import parse_docx_bytes
from backend.question_detector import detect_questions_from_elements
import asyncio
import time
from threading import Lock
from backend.database import (
    init_db, save_quiz, get_quizzes, get_quiz,
    update_quiz_questions, delete_quiz, save_attempt,
    get_subjects, create_subject, update_subject, delete_subject, update_quiz_subject,
    get_classes, create_class, update_class, delete_class,
    get_semesters, create_semester, update_semester, delete_semester,
    update_quiz_placement, get_full_tree, get_subject, move_subject,
    create_document, get_documents, get_document, update_document, delete_document,
    create_document_folder, get_document_folders, get_document_folders_tree,
    get_document_folder, get_folder_breadcrumbs, update_document_folder, delete_document_folder,
    log_visitor, get_visitor_logs, clear_visitor_logs,
    get_admin_pin, set_admin_pin, verify_admin_pin,
    get_super_admin_ips, add_super_admin_ip, remove_super_admin_ip, is_super_admin_ip,
    restore_document, permanent_delete_document, restore_quiz, permanent_delete_quiz,
    get_trash_items, restore_all_trash, clear_trash_permanently
)
from fastapi.middleware.gzip import GZipMiddleware
from backend.grading import grade_submission
from backend.sample_generator import create_sample_docx
from starlette.requests import Request

app = FastAPI(title="Docx Quiz Generator & Player API", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_client_ip(request: Request) -> str:
    """Extract real client IP address from Cloudflare, reverse proxy, or direct connection."""
    # 1. Cloudflare header (highest priority, guaranteed client IP when proxied by Cloudflare)
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()
    
    # 2. True-Client-IP (Cloudflare Enterprise / CDN)
    true_ip = request.headers.get("true-client-ip")
    if true_ip and true_ip.strip():
        return true_ip.strip()
        
    # 3. X-Forwarded-For (client, proxy1, proxy2... first one is origin)
    x_forwarded = request.headers.get("x-forwarded-for")
    if x_forwarded:
        parts = [p.strip() for p in x_forwarded.split(",") if p.strip()]
        if parts:
            return parts[0]
            
    # 4. X-Real-IP
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
        
    # 5. Direct socket client
    if request.client and request.client.host:
        return request.client.host
        
    return "127.0.0.1"


def is_request_admin(request: Request) -> bool:
    """Return True if request is from a Super Admin IP OR provides a valid admin PIN."""
    client_ip = get_client_ip(request)
    if is_super_admin_ip(client_ip):
        return True
    pin = request.headers.get("x-admin-pin") or request.query_params.get("admin_pin")
    if pin and verify_admin_pin(pin):
        return True
    return False


def require_admin(request: Request):
    """Verify admin privilege from either Super Admin IP or valid Admin PIN. Raise HTTP 403 if invalid."""
    if not is_request_admin(request):
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền IP cao nhất hoặc mã PIN Quản trị viên chính xác!"
        )


def check_item_edit_permission(request: Request, item: Optional[Dict[str, Any]], item_type: str = "mục này"):
    """
    Check if the requester has permission to edit this item.
    - Super Admin or valid admin PIN: always allowed.
    - Guest IP: only allowed if item was created/imported by this exact IP.
    """
    if is_request_admin(request):
        return
    if not item:
        return
    client_ip = get_client_ip(request)
    created_ip = (item.get("created_ip") or "").strip()
    if not created_ip or created_ip != client_ip:
        raise HTTPException(
            status_code=403,
            detail=f"Bạn không có quyền chỉnh sửa {item_type} này. Chỉ IP đã import vào website hoặc Quản trị viên cấp cao mới có quyền sửa!"
        )


class VerifyPinRequest(BaseModel):
    pin: str


class ChangePinRequest(BaseModel):
    old_pin: str
    new_pin: str


class GrantIpRequest(BaseModel):
    ip: str
    pin: Optional[str] = None



_LAST_LOGGED_IPS: Dict[str, float] = {}
_LOG_LOCK = Lock()


@app.middleware("http")
async def visitor_logger_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method
    
    # Fast path: Skip static assets, vite internals, assets, favicon, visit endpoint, and admin log endpoints
    is_static = (
        path.startswith("/assets") or
        path.startswith("/@") or
        path.startswith("/node_modules") or
        path.startswith("/favicon") or
        path == "/api/admin/visitor-logs" or
        path == "/api/visit" or
        path.endswith(".js") or
        path.endswith(".css") or
        path.endswith(".png") or
        path.endswith(".jpg") or
        path.endswith(".svg") or
        path.endswith(".ico") or
        path.endswith(".map")
    )
    
    response = await call_next(request)
    
    if not is_static:
        client_ip = get_client_ip(request)
        
        # Determine whether to log this request:
        # 1. Modifying requests (POST, PUT, DELETE) are always logged.
        # 2. GET requests (page visits or frontend API requests) are debounced per IP (once every 15s per IP)
        #    This ensures visitor IPs are always captured while preventing concurrent write collisions.
        should_log = False
        if method in ["POST", "PUT", "DELETE"]:
            should_log = True
        elif method == "GET":
            now = time.time()
            with _LOG_LOCK:
                last_time = _LAST_LOGGED_IPS.get(client_ip, 0)
                if now - last_time >= 15:
                    _LAST_LOGGED_IPS[client_ip] = now
                    should_log = True
                    if len(_LAST_LOGGED_IPS) > 2000:
                        expired = [ip for ip, t in _LAST_LOGGED_IPS.items() if now - t > 3600]
                        for ip in expired:
                            _LAST_LOGGED_IPS.pop(ip, None)
                            
        if should_log:
            country = request.headers.get("cf-ipcountry", "")
            city = request.headers.get("cf-ipcity", "")
            user_agent = request.headers.get("user-agent", "")
            status_code = response.status_code
            
            # Async non-blocking execution in background thread
            try:
                asyncio.create_task(
                    asyncio.to_thread(
                        log_visitor,
                        ip_address=client_ip,
                        country=country,
                        city=city,
                        method=method,
                        path=path,
                        user_agent=user_agent[:255] if user_agent else "",
                        status_code=status_code
                    )
                )
            except Exception:
                pass
        
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    err_msg = str(exc)
    if "sqlite_busy" in err_msg.lower() or "stream was idle" in err_msg.lower():
        clean_msg = "Cơ sở dữ liệu đang bận xử lý (SQLITE_BUSY). Vui lòng thử lại sau giây lát!"
    else:
        clean_msg = f"Server Error: {err_msg}"
    return JSONResponse(
        status_code=500,
        content={"detail": clean_msg},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.on_event("startup")
def startup_event():
    init_db()
    sample_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_quiz_highlighted.docx")
    if not os.path.exists(sample_path):
        create_sample_docx(sample_path)


class UpdateQuizRequest(BaseModel):
    title: Optional[str] = None
    questions: List[Dict[str, Any]]


class SubmitQuizRequest(BaseModel):
    answers: Dict[str, Any]
    questions: Optional[List[Dict[str, Any]]] = None


class CreateClassRequest(BaseModel):
    name: str


class UpdateClassRequest(BaseModel):
    name: str


class CreateSemesterRequest(BaseModel):
    class_id: str
    name: str


class UpdateSemesterRequest(BaseModel):
    name: str


class CreateSubjectRequest(BaseModel):
    name: str
    semester_id: Optional[str] = None
    class_id: Optional[str] = None


class UpdateSubjectRequest(BaseModel):
    name: str
    semester_id: Optional[str] = None
    class_id: Optional[str] = None


class MoveSubjectRequest(BaseModel):
    semester_id: str
    class_id: Optional[str] = None


class UpdateQuizSubjectRequest(BaseModel):
    subject_id: Optional[str] = None


class UpdateQuizPlacementRequest(BaseModel):
    subject_id: Optional[str] = None
    semester_id: Optional[str] = None
    class_id: Optional[str] = None


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    subject_id: Optional[str] = None
    semester_id: Optional[str] = None
    class_id: Optional[str] = None
    folder_path: Optional[str] = None


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: Optional[str] = ''
    subject_id: Optional[str] = ''
    semester_id: Optional[str] = ''
    class_id: Optional[str] = ''


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None


DOCUMENTS_DIR = os.path.join(os.path.dirname(__file__), "uploads", "documents")
os.makedirs(DOCUMENTS_DIR, exist_ok=True)



@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Docx Quiz API is running"}


@app.get("/api/sample-file")
def download_sample():
    """Download pre-generated sample Word file containing all 6 question types with highlights."""
    sample_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Mau_De_Thi_Tat_Ca_Dinh_Dang.docx")
    if not os.path.exists(sample_path):
        create_sample_docx(sample_path)
    return FileResponse(
        sample_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="Mau_De_Thi_Tat_Ca_Dinh_Dang.docx"
    )



@app.post("/api/upload")
async def upload_docx(request: Request, file: UploadFile = File(...)):
    """Upload a .docx file, parse XML runs and highlights, detect questions, and save to database."""
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file định dạng Word (.docx)")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File tải lên rỗng")

    try:
        elements = parse_docx_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể đọc file Word: {str(e)}")

    questions = detect_questions_from_elements(elements)
    if not questions:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy câu hỏi hợp lệ nào trong file Word. Vui lòng kiểm tra định dạng câu hỏi (Ví dụ: 'Câu 1:', 'Question 1:', v.v.)"
        )

    clean_name = os.path.splitext(file.filename)[0]
    title = clean_name.replace("_", " ").strip()
    client_ip = get_client_ip(request)

    quiz_id = save_quiz(title, file.filename, questions, created_ip=client_ip)
    saved_quiz = get_quiz(quiz_id)

    return {
        "success": True,
        "message": f"Phân tích thành công {len(questions)} câu hỏi từ file '{file.filename}'",
        "quiz": saved_quiz
    }


@app.get("/api/quizzes")
def list_quizzes():
    return {"quizzes": get_quizzes()}


@app.get("/api/quizzes/{quiz_id}")
def get_quiz_detail(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    return {"quiz": quiz}


@app.put("/api/quizzes/{quiz_id}")
def update_quiz_data(request: Request, quiz_id: str, payload: UpdateQuizRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    check_item_edit_permission(request, existing, "đề thi")

    success = update_quiz_questions(quiz_id, payload.questions, payload.title)
    updated_quiz = get_quiz(quiz_id)
    return {
        "success": success,
        "message": "Cập nhật câu hỏi thành công",
        "quiz": updated_quiz
    }


@app.delete("/api/quizzes/{quiz_id}")
def remove_quiz(request: Request, quiz_id: str):
    require_admin(request)
    success = delete_quiz(quiz_id)
    return {"success": success, "message": "Xóa bài thi thành công"}


@app.post("/api/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, payload: SubmitQuizRequest):
    quiz = get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    questions_to_grade = payload.questions if (payload.questions and len(payload.questions) > 0) else quiz["questions"]
    result = grade_submission(questions_to_grade, payload.answers)
    attempt_id = save_attempt(quiz_id, result["earned_score"], result["total_score"], result)

    result["attempt_id"] = attempt_id

    return {
        "success": True,
        "result": result
    }


@app.get("/api/tree")
def get_tree_route():
    return get_full_tree()


@app.get("/api/classes")
def list_classes_route():
    return {"classes": get_classes()}


@app.post("/api/classes")
def add_class_route(request: Request, payload: CreateClassRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên lớp không được để trống")
    client_ip = get_client_ip(request)
    cls = create_class(payload.name, created_ip=client_ip)
    return {"success": True, "class": cls}


@app.put("/api/classes/{class_id}")
def edit_class_route(request: Request, class_id: str, payload: UpdateClassRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên lớp không được để trống")
    if not is_request_admin(request):
        classes = get_classes()
        cls = next((c for c in classes if c['id'] == class_id), None)
        check_item_edit_permission(request, cls, "lớp học")
    update_class(class_id, payload.name)
    return {"success": True, "message": "Cập nhật lớp thành công"}


@app.delete("/api/classes/{class_id}")
def remove_class_route(request: Request, class_id: str):
    require_admin(request)
    delete_class(class_id)
    return {"success": True, "message": "Xóa lớp thành công"}


@app.get("/api/semesters")
def list_semesters_route(class_id: Optional[str] = None):
    return {"semesters": get_semesters(class_id)}


@app.post("/api/semesters")
def add_semester_route(request: Request, payload: CreateSemesterRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên kỳ học không được để trống")
    client_ip = get_client_ip(request)
    sem = create_semester(payload.class_id, payload.name, created_ip=client_ip)
    return {"success": True, "semester": sem}


@app.put("/api/semesters/{semester_id}")
def edit_semester_route(request: Request, semester_id: str, payload: UpdateSemesterRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên kỳ học không được để trống")
    if not is_request_admin(request):
        sems = get_semesters()
        sem = next((s for s in sems if s['id'] == semester_id), None)
        check_item_edit_permission(request, sem, "kỳ học")
    update_semester(semester_id, payload.name)
    return {"success": True, "message": "Cập nhật kỳ học thành công"}


@app.delete("/api/semesters/{semester_id}")
def remove_semester_route(request: Request, semester_id: str):
    require_admin(request)
    delete_semester(semester_id)
    return {"success": True, "message": "Xóa kỳ học thành công"}


@app.get("/api/subjects")
def list_subjects():
    return {"subjects": get_subjects()}


@app.post("/api/subjects")
def add_subject(request: Request, payload: CreateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    client_ip = get_client_ip(request)
    subj = create_subject(payload.name, semester_id=payload.semester_id, class_id=payload.class_id, created_ip=client_ip)
    return {"success": True, "subject": subj}


@app.put("/api/subjects/{subject_id}")
def edit_subject(request: Request, subject_id: str, payload: UpdateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    if not is_request_admin(request):
        subj = get_subject(subject_id)
        check_item_edit_permission(request, subj, "môn học")
    update_subject(subject_id, payload.name, semester_id=payload.semester_id, class_id=payload.class_id)
    return {"success": True, "message": "Cập nhật môn học thành công"}


@app.delete("/api/subjects/{subject_id}")
def remove_subject(request: Request, subject_id: str):
    require_admin(request)
    delete_subject(subject_id)
    return {"success": True, "message": "Xóa môn học thành công"}


@app.put("/api/subjects/{subject_id}/move")
def move_subject_route(request: Request, subject_id: str, payload: MoveSubjectRequest):
    existing = get_subject(subject_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    check_item_edit_permission(request, existing, "môn học")
    move_subject(subject_id, payload.semester_id, payload.class_id)
    return {"success": True, "message": "Chuyển môn học vào kỳ thành công"}


@app.put("/api/quizzes/{quiz_id}/subject")
def change_quiz_subject(request: Request, quiz_id: str, payload: UpdateQuizSubjectRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    check_item_edit_permission(request, existing, "đề thi")
    update_quiz_subject(quiz_id, payload.subject_id)
    return {"success": True, "message": "Cập nhật môn học cho đề thi thành công"}


@app.put("/api/quizzes/{quiz_id}/placement")
def place_quiz_route(request: Request, quiz_id: str, payload: UpdateQuizPlacementRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    check_item_edit_permission(request, existing, "đề thi")
    update_quiz_placement(quiz_id, subject_id=payload.subject_id, semester_id=payload.semester_id, class_id=payload.class_id)
    return {"success": True, "message": "Cập nhật vị trí bài thi thành công"}


# ==============================================================================
# Document Folder Management Endpoints
# ==============================================================================
@app.get("/api/document-folders/tree")
def list_document_folders_tree(
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    class_id: Optional[str] = None
):
    folders = get_document_folders_tree(
        subject_id=subject_id,
        semester_id=semester_id,
        class_id=class_id
    )
    return {"folders": folders}


@app.get("/api/document-folders/breadcrumbs/{folder_id}")
def get_breadcrumbs(folder_id: str):
    crumbs = get_folder_breadcrumbs(folder_id)
    return {"breadcrumbs": crumbs}


@app.post("/api/document-folders")
def create_folder(request: Request, payload: CreateFolderRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên thư mục không được để trống")
    try:
        client_ip = get_client_ip(request)
        folder = create_document_folder(
            name=payload.name.strip(),
            parent_id=payload.parent_id or '',
            subject_id=payload.subject_id or '',
            semester_id=payload.semester_id or '',
            class_id=payload.class_id or '',
            created_ip=client_ip
        )
        return {"success": True, "folder": folder}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi tạo thư mục: {str(e)}")


@app.put("/api/document-folders/{folder_id}")
def edit_folder(request: Request, folder_id: str, payload: UpdateFolderRequest):
    existing = get_document_folder(folder_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")
    check_item_edit_permission(request, existing, "thư mục")

    if payload.name is not None and not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên thư mục không được để trống")

    try:
        updated = update_document_folder(
            folder_id,
            name=payload.name.strip() if payload.name is not None else None,
            parent_id=payload.parent_id
        )
        return {"success": True, "folder": updated}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi đổi tên thư mục: {str(e)}")


@app.delete("/api/document-folders/{folder_id}")
def remove_folder(request: Request, folder_id: str):
    require_admin(request)
    existing = get_document_folder(folder_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")

    try:
        # Delete folder and all descendants recursively, returns files to delete
        files_to_delete = delete_document_folder(folder_id)
        for fpath in files_to_delete:
            if fpath and os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception as e:
                    print(f"Lỗi xóa file {fpath}: {e}")

        return {"success": True, "message": "Xóa thư mục thành công"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi xóa thư mục: {str(e)}")


# ==============================================================================
# Document Management Endpoints (Word & PDF)
# ==============================================================================
@app.post("/api/documents/upload")
async def upload_documents(
    request: Request,
    files: List[UploadFile] = File(...),
    subject_id: Optional[str] = Form(None),
    semester_id: Optional[str] = Form(None),
    class_id: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    folder_paths: Optional[str] = Form(None)
):
    """
    Upload one or multiple documents (.docx, .doc, .pdf) or an entire directory.
    folder_paths is an optional JSON string list of relative paths matching files list.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Không có file nào được tải lên")

    client_ip = get_client_ip(request)

    try:
        parsed_paths = []
        if folder_paths:
            try:
                parsed_paths = json.loads(folder_paths)
            except Exception:
                parsed_paths = []

        uploaded_docs = []
        errors = []
        folder_cache = {}

        for idx, f in enumerate(files):
            raw_filename = (f.filename or "untitled").replace("\\", "/")
            filename = os.path.basename(raw_filename) or "untitled"
            # Determine extension
            ext = os.path.splitext(filename)[1].lower()
            if ext not in [".docx", ".doc", ".pdf"]:
                errors.append(f"{filename}: Định dạng không được hỗ trợ (chỉ nhận .docx, .doc, .pdf)")
                continue

            file_type = ext.replace(".", "")
            content = await f.read()
            file_size = len(content)

            if file_size == 0:
                errors.append(f"{filename}: File rỗng (0 bytes)")
                continue

            # Safe unique storage filename
            unique_prefix = uuid.uuid4().hex[:8]
            safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
            disk_filename = f"{unique_prefix}_{safe_filename}"
            disk_path = os.path.join(DOCUMENTS_DIR, disk_filename)

            with open(disk_path, "wb") as out_f:
                out_f.write(content)

            relative_folder = ""
            target_folder_id = folder_id or ''

            rel_source = ""
            if idx < len(parsed_paths) and parsed_paths[idx]:
                rel_source = str(parsed_paths[idx]).replace("\\", "/")
            elif "/" in raw_filename:
                rel_source = raw_filename

            if rel_source:
                rel_dir = os.path.dirname(rel_source)
                relative_folder = rel_dir
                if rel_dir:
                    parts = [p.strip() for p in rel_dir.split('/') if p.strip()]
                    current_parent = folder_id or ''
                    for part in parts:
                        cache_key = (current_parent, part)
                        if cache_key in folder_cache:
                            current_parent = folder_cache[cache_key]
                        else:
                            existing_folders = get_document_folders(parent_id=current_parent, subject_id=subject_id or '')
                            match = next((fol for fol in existing_folders if fol['name'].lower() == part.lower()), None)
                            if match:
                                f_id = match['id']
                            else:
                                new_f = create_document_folder(
                                    name=part,
                                    parent_id=current_parent,
                                    subject_id=subject_id or '',
                                    semester_id=semester_id or '',
                                    class_id=class_id or '',
                                    created_ip=client_ip
                                )
                                f_id = new_f['id']
                            folder_cache[cache_key] = f_id
                            current_parent = f_id
                    target_folder_id = current_parent

            title = os.path.splitext(filename)[0]

            doc = create_document(
                title=title,
                filename=filename,
                file_path=disk_path,
                file_size=file_size,
                file_type=file_type,
                folder_id=target_folder_id,
                subject_id=subject_id or '',
                semester_id=semester_id or '',
                class_id=class_id or '',
                folder_path=relative_folder,
                created_ip=client_ip
            )
            uploaded_docs.append(doc)

        return {
            "success": True,
            "count": len(uploaded_docs),
            "documents": uploaded_docs,
            "errors": errors
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi tải lên tài liệu: {str(e)}")


@app.get("/api/documents")
def list_documents(
    class_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    file_type: Optional[str] = None
):
    docs = get_documents(
        class_id=class_id,
        semester_id=semester_id,
        subject_id=subject_id,
        folder_id=folder_id,
        search=search,
        file_type=file_type
    )
    return {"documents": docs, "total": len(docs)}


def get_document_actual_path(doc: Dict[str, Any]) -> Optional[str]:
    """Find the valid physical file for a document, resolving relative or shifted paths."""
    if not doc:
        return None
    raw_path = doc.get('file_path') or ''
    # 1. Direct path check
    if raw_path and os.path.exists(raw_path):
        return raw_path

    # 2. Check if disk base name exists in current DOCUMENTS_DIR
    if raw_path:
        base_name = os.path.basename(raw_path)
        p1 = os.path.join(DOCUMENTS_DIR, base_name)
        if os.path.exists(p1):
            try:
                update_document(doc['id'], file_path=p1)
            except Exception:
                pass
            return p1

    # 3. Check by doc['filename'] clean basename in DOCUMENTS_DIR
    raw_fname = doc.get('filename') or ''
    clean_fname = os.path.basename(raw_fname.replace('\\', '/'))
    if clean_fname:
        p2 = os.path.join(DOCUMENTS_DIR, clean_fname)
        if os.path.exists(p2):
            try:
                update_document(doc['id'], file_path=p2)
            except Exception:
                pass
            return p2

        # 4. Search DOCUMENTS_DIR for any file matching clean_fname or base_name
        if os.path.exists(DOCUMENTS_DIR):
            for candidate in os.listdir(DOCUMENTS_DIR):
                if candidate.endswith(clean_fname) or (raw_path and os.path.basename(raw_path) in candidate):
                    p3 = os.path.join(DOCUMENTS_DIR, candidate)
                    if os.path.exists(p3):
                        try:
                            update_document(doc['id'], file_path=p3)
                        except Exception:
                            pass
                        return p3
    return None


@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    actual_path = get_document_actual_path(doc)
    if not actual_path or not os.path.exists(actual_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file tài liệu trên hệ thống")

    raw_filename = doc.get('filename') or os.path.basename(actual_path)
    clean_filename = os.path.basename(raw_filename.replace('\\', '/'))
    if not clean_filename or clean_filename == "untitled":
        clean_filename = f"{doc.get('title', 'document')}.{doc.get('file_type', 'docx')}"

    media_type = "application/octet-stream"
    if doc.get('file_type') == 'pdf':
        media_type = "application/pdf"
    elif doc.get('file_type') == 'docx':
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif doc.get('file_type') == 'doc':
        media_type = "application/msword"

    return FileResponse(
        actual_path,
        media_type=media_type,
        filename=clean_filename
    )


@app.get("/api/documents/{doc_id}/view")
def view_document_inline(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    actual_path = get_document_actual_path(doc)
    if not actual_path or not os.path.exists(actual_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file tài liệu trên hệ thống")

    clean_filename = os.path.basename((doc.get('filename') or 'document').replace('\\', '/'))
    media_type = "application/octet-stream"
    if doc.get('file_type') == 'pdf':
        media_type = "application/pdf"
    elif doc.get('file_type') == 'docx':
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    headers = {
        "Content-Disposition": f'inline; filename="{clean_filename}"'
    }
    return FileResponse(actual_path, media_type=media_type, headers=headers)


@app.delete("/api/documents/{doc_id}")
def remove_document(request: Request, doc_id: str):
    require_admin(request)
    doc = delete_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return {"success": True, "message": "Xóa tài liệu thành công"}


@app.put("/api/documents/{doc_id}")
def edit_document(request: Request, doc_id: str, payload: UpdateDocumentRequest):
    existing = get_document(doc_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    check_item_edit_permission(request, existing, "tài liệu")

    # Ensure clean title without directory slashes
    clean_title = payload.title
    if clean_title:
        clean_title = os.path.basename(clean_title.replace('\\', '/'))

    update_document(
        doc_id=doc_id,
        title=clean_title,
        folder_id=payload.folder_id,
        subject_id=payload.subject_id,
        semester_id=payload.semester_id,
        class_id=payload.class_id,
        folder_path=payload.folder_path
    )
    updated = get_document(doc_id)
    return {"success": True, "document": updated}


@app.post("/api/documents/{doc_id}/create-quiz")
def convert_document_to_quiz(request: Request, doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    actual_path = get_document_actual_path(doc)
    if not actual_path or not os.path.exists(actual_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file tài liệu trên hệ thống")

    if doc.get('file_type') != 'docx':
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tạo đề thi từ file Word (.docx)")

    with open(actual_path, "rb") as f:
        content = f.read()

    elements = parse_docx_bytes(content)
    detected_questions = detect_questions_from_elements(elements)
    if not detected_questions:
        raise HTTPException(status_code=422, detail="Không tìm thấy câu hỏi hoặc highlight hợp lệ trong file này")

    raw_filename = doc.get('filename') or os.path.basename(actual_path)
    clean_filename = os.path.basename(raw_filename.replace('\\', '/'))
    clean_title = os.path.basename((doc.get('title') or clean_filename).replace('\\', '/'))

    client_ip = get_client_ip(request)
    quiz_id = save_quiz(
        title=clean_title,
        filename=clean_filename,
        questions=detected_questions,
        created_ip=client_ip
    )
    if doc.get('subject_id'):
        update_quiz_placement(
            quiz_id,
            subject_id=doc.get('subject_id'),
            semester_id=doc.get('semester_id'),
            class_id=doc.get('class_id')
        )

    created_quiz = get_quiz(quiz_id)
    return {"success": True, "quiz": created_quiz}


# ==============================================================================
# Trash & Document/Quiz Recovery API (Thùng rác & Khôi phục)
# ==============================================================================
@app.get("/api/trash")
def api_get_trash():
    """Retrieve all soft-deleted documents and quizzes."""
    return get_trash_items()


@app.post("/api/documents/{doc_id}/restore")
def api_restore_document(doc_id: str):
    """Restore a soft-deleted document."""
    doc = restore_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu để khôi phục")
    return {"success": True, "message": "Khôi phục tài liệu thành công", "document": doc}


@app.post("/api/quizzes/{quiz_id}/restore")
def api_restore_quiz(quiz_id: str):
    """Restore a soft-deleted quiz."""
    success = restore_quiz(quiz_id)
    return {"success": success, "message": "Khôi phục bài thi thành công"}


@app.post("/api/trash/restore-all")
def api_restore_all_trash():
    """Restore all soft-deleted items."""
    return restore_all_trash()


@app.delete("/api/trash/clear")
def api_clear_trash(request: Request):
    """Permanently delete all items currently in trash. Requires admin."""
    require_admin(request)
    result = clear_trash_permanently()
    for fpath in result.get("files_to_remove", []):
        if fpath and os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception:
                pass
    return {"success": True, "message": "Đã xóa vĩnh viễn thùng rác"}


@app.delete("/api/documents/{doc_id}/permanent")
def api_permanent_delete_document(request: Request, doc_id: str):
    """Permanently delete document from database and disk. Requires admin."""
    require_admin(request)
    doc = permanent_delete_document(doc_id)
    if doc:
        actual_path = get_document_actual_path(doc)
        if actual_path and os.path.exists(actual_path):
            try:
                os.remove(actual_path)
            except Exception:
                pass
    return {"success": True, "message": "Đã xóa vĩnh viễn tài liệu"}


@app.delete("/api/quizzes/{quiz_id}/permanent")
def api_permanent_delete_quiz(request: Request, quiz_id: str):
    """Permanently delete quiz from database. Requires admin."""
    require_admin(request)
    permanent_delete_quiz(quiz_id)
    return {"success": True, "message": "Đã xóa vĩnh viễn bài thi"}


# ==============================================================================
# Visitor IP & Access Logs API (Cloudflare + Turso)
# ==============================================================================
@app.get("/api/admin/visitor-logs")
def api_get_visitor_logs(request: Request, limit: int = 100, offset: int = 0, search: str = ""):
    """Retrieve visitor logs with total count, unique IP count, and caller's IP."""
    my_ip = get_client_ip(request)
    data = get_visitor_logs(limit=limit, offset=offset, search=search)
    data["my_ip"] = my_ip
    return data


@app.delete("/api/admin/visitor-logs")
def api_clear_visitor_logs():
    """Clear all visitor logs."""
    clear_visitor_logs()
    return {"success": True, "message": "Đã xóa toàn bộ nhật ký truy cập"}


@app.post("/api/admin/verify-pin")
def api_verify_pin(payload: VerifyPinRequest):
    """Verify administrator PIN."""
    if not verify_admin_pin(payload.pin):
        raise HTTPException(status_code=403, detail="Mã PIN không chính xác!")
    return {"valid": True, "message": "Xác thực mã PIN Quản trị viên thành công"}


@app.post("/api/admin/change-pin")
def api_change_pin(payload: ChangePinRequest):
    """Change administrator PIN in database."""
    if not verify_admin_pin(payload.old_pin):
        raise HTTPException(status_code=403, detail="Mã PIN hiện tại không chính xác!")
    clean_new = payload.new_pin.strip()
    if len(clean_new) < 4:
        raise HTTPException(status_code=400, detail="Mã PIN mới phải có ít nhất 4 ký tự!")
    set_admin_pin(clean_new)
    return {"success": True, "message": "Đã đổi mã PIN Quản trị viên thành công!"}


@app.get("/api/admin/check-auth")
def api_check_auth(request: Request):
    """Check if provided PIN is valid."""
    pin = request.headers.get("x-admin-pin") or request.query_params.get("admin_pin")
    return {"authenticated": verify_admin_pin(pin)}


@app.get("/api/admin/my-ip")
def api_get_my_ip(request: Request):
    """Return the client's current IP and detected country."""
    return {
        "ip": get_client_ip(request),
        "country": request.headers.get("cf-ipcountry", "VN"),
        "city": request.headers.get("cf-ipcity", ""),
        "user_agent": request.headers.get("user-agent", "")
    }


@app.get("/api/client/permissions")
def api_get_client_permissions(request: Request):
    """Return permissions of the current client IP."""
    client_ip = get_client_ip(request)
    is_super = is_super_admin_ip(client_ip)
    pin = request.headers.get("x-admin-pin") or request.query_params.get("admin_pin")
    pin_valid = verify_admin_pin(pin) if pin else False
    is_admin = is_super or pin_valid
    super_ips = get_super_admin_ips()
    return {
        "client_ip": client_ip,
        "is_super_admin": is_super,
        "is_admin": is_admin,
        "can_delete": is_admin,
        "super_admin_ips": super_ips if is_admin else []
    }


@app.get("/api/admin/super-ips")
def api_get_super_ips(request: Request):
    """List all super admin IPs."""
    require_admin(request)
    return {
        "super_admin_ips": get_super_admin_ips(),
        "my_ip": get_client_ip(request)
    }


@app.post("/api/admin/grant-super-ip")
def api_grant_super_ip(request: Request, payload: GrantIpRequest):
    """Grant Super Admin status to an IP address. Requires either existing Super Admin IP or valid Admin PIN."""
    client_ip = get_client_ip(request)
    is_super = is_super_admin_ip(client_ip)
    pin = payload.pin or request.headers.get("x-admin-pin") or request.query_params.get("admin_pin")
    pin_valid = verify_admin_pin(pin) if pin else False

    if not (is_super or pin_valid):
        raise HTTPException(
            status_code=403,
            detail="Cần quyền IP Cao Nhất hoặc mã PIN Quản trị viên chính xác để cấp quyền!"
        )

    target_ip = (payload.ip or "").strip()
    if not target_ip:
        raise HTTPException(status_code=400, detail="Địa chỉ IP không được để trống")

    updated_ips = add_super_admin_ip(target_ip)
    return {
        "success": True,
        "message": f"Đã cấp quyền IP Cao Nhất (toàn quyền Xóa/Sửa) cho IP: {target_ip}",
        "super_admin_ips": updated_ips
    }


@app.post("/api/admin/revoke-super-ip")
def api_revoke_super_ip(request: Request, payload: GrantIpRequest):
    """Revoke Super Admin status from an IP address. Requires Super Admin IP or valid Admin PIN."""
    client_ip = get_client_ip(request)
    is_super = is_super_admin_ip(client_ip)
    pin = payload.pin or request.headers.get("x-admin-pin") or request.query_params.get("admin_pin")
    pin_valid = verify_admin_pin(pin) if pin else False

    if not (is_super or pin_valid):
        raise HTTPException(
            status_code=403,
            detail="Cần quyền IP Cao Nhất hoặc mã PIN Quản trị viên chính xác để hủy quyền!"
        )

    target_ip = (payload.ip or "").strip()
    if not target_ip:
        raise HTTPException(status_code=400, detail="Địa chỉ IP không được để trống")

    updated_ips = remove_super_admin_ip(target_ip)
    return {
        "success": True,
        "message": f"Đã hủy quyền IP Cao Nhất của IP: {target_ip}",
        "super_admin_ips": updated_ips
    }


class VisitRequest(BaseModel):
    page: Optional[str] = None
    referrer: Optional[str] = None


@app.post("/api/visit")
def api_record_visit(request: Request, payload: Optional[VisitRequest] = None):
    """Explicitly record a website visit from the frontend."""
    client_ip = get_client_ip(request)
    country = request.headers.get("cf-ipcountry", "")
    city = request.headers.get("cf-ipcity", "")
    user_agent = request.headers.get("user-agent", "")

    display_path = (payload.page if payload and payload.page else "") or request.headers.get("referer", "/") or "/"
    if "://" in display_path:
        display_path = display_path.split("://", 1)[1]

    try:
        log_visitor(
            ip_address=client_ip,
            country=country,
            city=city,
            method="VISIT",
            path=display_path[:120],
            user_agent=user_agent[:255] if user_agent else "",
            status_code=200
        )
    except Exception as e:
        print(f"Error recording visit: {e}")
    return {"status": "ok", "ip": client_ip}


# Root route for Render health checks and browser navigation
@app.get("/")
def api_root():
    if os.path.exists(frontend_dist):
        return FileResponse(
            os.path.join(frontend_dist, "index.html"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )
    return {
        "status": "online",
        "service": "QuizzizForYou Backend API",
        "version": "1.0.0",
        "health": "/api/health"
    }


# Serve frontend build if dist folder exists
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(
            os.path.join(frontend_dist, "index.html"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  Docx Quiz App Server running at: http://127.0.0.1:8000")
    print("=" * 60)
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

