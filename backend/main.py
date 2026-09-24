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
from backend.database import (
    init_db, save_quiz, get_quizzes, get_quiz,
    update_quiz_questions, delete_quiz, save_attempt,
    get_subjects, create_subject, update_subject, delete_subject, update_quiz_subject,
    get_classes, create_class, update_class, delete_class,
    get_semesters, create_semester, update_semester, delete_semester,
    update_quiz_placement, get_full_tree, get_subject, move_subject,
    create_document, get_documents, get_document, update_document, delete_document,
    create_document_folder, get_document_folders, get_document_folders_tree,
    get_document_folder, get_folder_breadcrumbs, update_document_folder, delete_document_folder
)
from fastapi.middleware.gzip import GZipMiddleware
from backend.grading import grade_submission
from backend.sample_generator import create_sample_docx

app = FastAPI(title="Docx Quiz Generator & Player API", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
async def upload_docx(file: UploadFile = File(...)):
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

    quiz_id = save_quiz(title, file.filename, questions)
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
def update_quiz_data(quiz_id: str, payload: UpdateQuizRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    success = update_quiz_questions(quiz_id, payload.questions, payload.title)
    updated_quiz = get_quiz(quiz_id)
    return {
        "success": success,
        "message": "Cập nhật câu hỏi thành công",
        "quiz": updated_quiz
    }


@app.delete("/api/quizzes/{quiz_id}")
def remove_quiz(quiz_id: str):
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
def add_class_route(payload: CreateClassRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên lớp không được để trống")
    cls = create_class(payload.name)
    return {"success": True, "class": cls}


@app.put("/api/classes/{class_id}")
def edit_class_route(class_id: str, payload: UpdateClassRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên lớp không được để trống")
    update_class(class_id, payload.name)
    return {"success": True, "message": "Cập nhật lớp thành công"}


@app.delete("/api/classes/{class_id}")
def remove_class_route(class_id: str):
    delete_class(class_id)
    return {"success": True, "message": "Xóa lớp thành công"}


@app.get("/api/semesters")
def list_semesters_route(class_id: Optional[str] = None):
    return {"semesters": get_semesters(class_id)}


@app.post("/api/semesters")
def add_semester_route(payload: CreateSemesterRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên kỳ học không được để trống")
    sem = create_semester(payload.class_id, payload.name)
    return {"success": True, "semester": sem}


@app.put("/api/semesters/{semester_id}")
def edit_semester_route(semester_id: str, payload: UpdateSemesterRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên kỳ học không được để trống")
    update_semester(semester_id, payload.name)
    return {"success": True, "message": "Cập nhật kỳ học thành công"}


@app.delete("/api/semesters/{semester_id}")
def remove_semester_route(semester_id: str):
    delete_semester(semester_id)
    return {"success": True, "message": "Xóa kỳ học thành công"}


@app.get("/api/subjects")
def list_subjects():
    return {"subjects": get_subjects()}


@app.post("/api/subjects")
def add_subject(payload: CreateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    subj = create_subject(payload.name, semester_id=payload.semester_id, class_id=payload.class_id)
    return {"success": True, "subject": subj}


@app.put("/api/subjects/{subject_id}")
def edit_subject(subject_id: str, payload: UpdateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    update_subject(subject_id, payload.name, semester_id=payload.semester_id, class_id=payload.class_id)
    return {"success": True, "message": "Cập nhật môn học thành công"}


@app.delete("/api/subjects/{subject_id}")
def remove_subject(subject_id: str):
    delete_subject(subject_id)
    return {"success": True, "message": "Xóa môn học thành công"}


@app.put("/api/subjects/{subject_id}/move")
def move_subject_route(subject_id: str, payload: MoveSubjectRequest):
    existing = get_subject(subject_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")
    move_subject(subject_id, payload.semester_id, payload.class_id)
    return {"success": True, "message": "Chuyển môn học vào kỳ thành công"}


@app.put("/api/quizzes/{quiz_id}/subject")
def change_quiz_subject(quiz_id: str, payload: UpdateQuizSubjectRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    update_quiz_subject(quiz_id, payload.subject_id)
    return {"success": True, "message": "Cập nhật môn học cho đề thi thành công"}


@app.put("/api/quizzes/{quiz_id}/placement")
def place_quiz_route(quiz_id: str, payload: UpdateQuizPlacementRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
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
def create_folder(payload: CreateFolderRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên thư mục không được để trống")
    folder = create_document_folder(
        name=payload.name.strip(),
        parent_id=payload.parent_id or '',
        subject_id=payload.subject_id or '',
        semester_id=payload.semester_id or '',
        class_id=payload.class_id or ''
    )
    return {"success": True, "folder": folder}


@app.put("/api/document-folders/{folder_id}")
def edit_folder(folder_id: str, payload: UpdateFolderRequest):
    existing = get_document_folder(folder_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")

    if payload.name is not None and not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên thư mục không được để trống")

    updated = update_document_folder(
        folder_id,
        name=payload.name.strip() if payload.name is not None else None,
        parent_id=payload.parent_id
    )
    return {"success": True, "folder": updated}


@app.delete("/api/document-folders/{folder_id}")
def remove_folder(folder_id: str):
    existing = get_document_folder(folder_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy thư mục")

    # Delete folder and all descendants recursively, returns files to delete
    files_to_delete = delete_document_folder(folder_id)
    for fpath in files_to_delete:
        if fpath and os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception as e:
                print(f"Lỗi xóa file {fpath}: {e}")

    return {"success": True, "message": "Xóa thư mục thành công"}


# ==============================================================================
# Document Management Endpoints (Word & PDF)
# ==============================================================================
@app.post("/api/documents/upload")
async def upload_documents(
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
        filename = f.filename or "untitled"
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

        if idx < len(parsed_paths) and parsed_paths[idx]:
            rel_path = str(parsed_paths[idx]).replace("\\", "/")
            rel_dir = os.path.dirname(rel_path)
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
                                class_id=class_id or ''
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
            folder_path=relative_folder
        )
        uploaded_docs.append(doc)

    return {
        "success": True,
        "count": len(uploaded_docs),
        "documents": uploaded_docs,
        "errors": errors
    }


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


@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: str):
    doc = get_document(doc_id)
    if not doc or not os.path.exists(doc['file_path']):
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    media_type = "application/octet-stream"
    if doc['file_type'] == 'pdf':
        media_type = "application/pdf"
    elif doc['file_type'] == 'docx':
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif doc['file_type'] == 'doc':
        media_type = "application/msword"

    return FileResponse(
        doc['file_path'],
        media_type=media_type,
        filename=doc['filename']
    )


@app.get("/api/documents/{doc_id}/view")
def view_document_inline(doc_id: str):
    doc = get_document(doc_id)
    if not doc or not os.path.exists(doc['file_path']):
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    media_type = "application/octet-stream"
    if doc['file_type'] == 'pdf':
        media_type = "application/pdf"
    elif doc['file_type'] == 'docx':
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    headers = {
        "Content-Disposition": f'inline; filename="{doc["filename"]}"'
    }
    return FileResponse(doc['file_path'], media_type=media_type, headers=headers)


@app.delete("/api/documents/{doc_id}")
def remove_document(doc_id: str):
    doc = delete_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    # Delete physical file
    if doc.get('file_path') and os.path.exists(doc['file_path']):
        try:
            os.remove(doc['file_path'])
        except Exception as e:
            print(f"Lỗi xóa file vật lý: {e}")

    return {"success": True, "message": "Xóa tài liệu thành công"}


@app.put("/api/documents/{doc_id}")
def edit_document(doc_id: str, payload: UpdateDocumentRequest):
    existing = get_document(doc_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    update_document(
        doc_id=doc_id,
        title=payload.title,
        folder_id=payload.folder_id,
        subject_id=payload.subject_id,
        semester_id=payload.semester_id,
        class_id=payload.class_id,
        folder_path=payload.folder_path
    )
    updated = get_document(doc_id)
    return {"success": True, "document": updated}


@app.post("/api/documents/{doc_id}/create-quiz")
def convert_document_to_quiz(doc_id: str):
    doc = get_document(doc_id)
    if not doc or not os.path.exists(doc['file_path']):
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")

    if doc['file_type'] != 'docx':
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tạo đề thi từ file Word (.docx)")

    with open(doc['file_path'], "rb") as f:
        content = f.read()

    elements = parse_docx_bytes(content)
    detected_questions = detect_questions_from_elements(elements)
    if not detected_questions:
        raise HTTPException(status_code=422, detail="Không tìm thấy câu hỏi hoặc highlight hợp lệ trong file này")

    quiz_id = save_quiz(
        title=doc['title'] or doc['filename'],
        filename=doc['filename'],
        questions=detected_questions
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

