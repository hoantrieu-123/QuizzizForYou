"""
FastAPI Server for Word Docx Quiz Application
Handles file upload, XML highlight parsing, quiz editing, interactive quiz taking, and grading.
"""
import os
import io
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.word_parser import parse_docx_bytes
from backend.question_detector import detect_questions_from_elements
from backend.database import (
    init_db, save_quiz, get_quizzes, get_quiz,
    update_quiz_questions, delete_quiz, save_attempt,
    get_subjects, create_subject, update_subject, delete_subject, update_quiz_subject
)
from backend.grading import grade_submission
from backend.sample_generator import create_sample_docx

app = FastAPI(title="Docx Quiz Generator & Player API", version="1.0.0")

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


class CreateSubjectRequest(BaseModel):
    name: str


class UpdateSubjectRequest(BaseModel):
    name: str


class UpdateQuizSubjectRequest(BaseModel):
    subject_id: Optional[str] = None



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


@app.get("/api/subjects")
def list_subjects():
    return {"subjects": get_subjects()}


@app.post("/api/subjects")
def add_subject(payload: CreateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    subj = create_subject(payload.name)
    return {"success": True, "subject": subj}


@app.put("/api/subjects/{subject_id}")
def edit_subject(subject_id: str, payload: UpdateSubjectRequest):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên môn học không được để trống")
    update_subject(subject_id, payload.name)
    return {"success": True, "message": "Cập nhật môn học thành công"}


@app.delete("/api/subjects/{subject_id}")
def remove_subject(subject_id: str):
    delete_subject(subject_id)
    return {"success": True, "message": "Xóa môn học thành công"}


@app.put("/api/quizzes/{quiz_id}/subject")
def change_quiz_subject(quiz_id: str, payload: UpdateQuizSubjectRequest):
    existing = get_quiz(quiz_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    update_quiz_subject(quiz_id, payload.subject_id)
    return {"success": True, "message": "Cập nhật môn học cho đề thi thành công"}



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

