import React, { useState, useEffect } from 'react';
import {
  Play, Edit3, Trash2, Calendar, HelpCircle,
  FileText, Folders, AddFolder, ChevronDown, ChevronRight,
  GripVertical, Plus, Check, X
} from './UIcons';
import { apiUrl } from '../apiConfig';

export default function QuizList({ onSelectQuiz, onStartQuiz, refreshTrigger }) {
  const [quizzes, setQuizzes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drag and Drop state
  const [draggingQuizId, setDraggingQuizId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  // Collapse state for subjects: { [subjectId]: boolean }
  const [collapsedSubjects, setCollapsedSubjects] = useState({});

  // Subject management state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [quizzesRes, subjectsRes] = await Promise.all([
        fetch(apiUrl('/api/quizzes')),
        fetch(apiUrl('/api/subjects'))
      ]);

      const quizzesData = await quizzesRes.json();
      const subjectsData = await subjectsRes.json();

      setQuizzes(quizzesData.quizzes || []);
      setSubjects(subjectsData.subjects || []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu bài kiểm tra & môn học:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  // Toggle Collapse/Expand
  const toggleCollapse = (subjectId) => {
    setCollapsedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  // Delete Quiz
  const handleDeleteQuiz = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài kiểm tra này không?')) return;
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${id}`), { method: 'DELETE' });
      if (res.ok) {
        setQuizzes(prev => prev.filter(q => q.id !== id));
      }
    } catch (err) {
      alert('Không thể xóa bài thi');
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, quizId) => {
    e.dataTransfer.setData('text/plain', quizId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingQuizId(quizId);
  };

  const handleDragEnd = () => {
    setDraggingQuizId(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget !== targetId) {
      setDragOverTarget(targetId);
    }
  };

  const handleDragLeave = (e, targetId) => {
    // Only reset if truly leaving the element boundary
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverTarget === targetId) {
        setDragOverTarget(null);
      }
    }
  };

  const handleDropQuiz = async (e, targetSubjectId) => {
    e.preventDefault();
    const quizId = e.dataTransfer.getData('text/plain') || draggingQuizId;
    setDraggingQuizId(null);
    setDragOverTarget(null);

    if (!quizId) return;

    const normalizedSubjectId = targetSubjectId || '';

    // Check if unchanged
    const currentQuiz = quizzes.find(q => q.id === quizId);
    if (currentQuiz && (currentQuiz.subject_id || '') === normalizedSubjectId) {
      return;
    }

    // Optimistic UI update
    setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, subject_id: normalizedSubjectId } : q));

    try {
      await fetch(apiUrl(`/api/quizzes/${quizId}/subject`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: normalizedSubjectId || null })
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật môn học cho đề thi:', err);
      fetchData();
    }
  };

  // Quick Change Subject via Dropdown
  const handleSelectSubject = async (quizId, targetSubjectId) => {
    const normalizedSubjectId = targetSubjectId || '';
    setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, subject_id: normalizedSubjectId } : q));

    try {
      await fetch(apiUrl(`/api/quizzes/${quizId}/subject`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: normalizedSubjectId || null })
      });
    } catch (err) {
      console.error('Lỗi khi chuyển môn học:', err);
      fetchData();
    }
  };

  // Create Subject
  const handleCreateSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const res = await fetch(apiUrl('/api/subjects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubjectName.trim() })
      });
      const data = await res.json();
      if (data.subject) {
        setSubjects(prev => [...prev, data.subject]);
        setNewSubjectName('');
        setShowAddSubject(false);
      }
    } catch (err) {
      alert('Không thể tạo môn học mới');
    }
  };

  // Rename Subject
  const handleStartEditSubject = (subject, e) => {
    e.stopPropagation();
    setEditingSubjectId(subject.id);
    setEditingSubjectName(subject.name);
  };

  const handleSaveEditSubject = async (subjectId) => {
    if (!editingSubjectName.trim()) {
      setEditingSubjectId(null);
      return;
    }
    try {
      await fetch(apiUrl(`/api/subjects/${subjectId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSubjectName.trim() })
      });
      setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, name: editingSubjectName.trim() } : s));
      setEditingSubjectId(null);
    } catch (err) {
      alert('Không thể cập nhật tên môn');
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (subjectId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa mục môn này? Các bài thi bên trong sẽ được chuyển an toàn về "Đề thi ngoài mục / Chưa phân loại".')) return;

    try {
      const res = await fetch(apiUrl(`/api/subjects/${subjectId}`), { method: 'DELETE' });
      if (res.ok) {
        setSubjects(prev => prev.filter(s => s.id !== subjectId));
        setQuizzes(prev => prev.map(q => q.subject_id === subjectId ? { ...q, subject_id: '' } : q));
      }
    } catch (err) {
      alert('Không thể xóa môn học');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem', color: '#7c3aed', fontWeight: 600 }}>
        Đang tải danh sách bài kiểm tra & phân loại môn học...
      </div>
    );
  }

  // Quizzes not assigned to any existing subject
  const validSubjectIds = new Set(subjects.map(s => s.id));
  const uncategorizedQuizzes = quizzes.filter(q => !q.subject_id || !validSubjectIds.has(q.subject_id));

  return (
    <div>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Folders size={22} style={{ color: '#7c3aed' }} />
            Danh sách đề thi theo môn ({quizzes.length} đề thi)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0' }}>
            Kéo thả các đề thi trắc nghiệm vào từng môn để phân loại hoặc kéo ra ngoài mục.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddSubject(true)}
          style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          title="Tạo thêm thư mục môn học mới"
        >
          <AddFolder size={17} /> + Thêm môn học
        </button>
      </div>

      {/* Add Subject Modal / Inline Form */}
      {showAddSubject && (
        <form
          onSubmit={handleCreateSubjectSubmit}
          style={{
            background: '#f5f3ff',
            border: '1.5px solid #ddd6fe',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Folders size={20} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.9rem' }}>
            Tạo mục môn học mới:
          </span>
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Nhập tên môn học (ví dụ: Môn Lịch sử, Tin học, Đề thi Học kì 1...)"
            autoFocus
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1.5px solid #ddd6fe',
              outline: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: '#ffffff'
            }}
          />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
              <Check size={15} /> Lưu môn
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowAddSubject(false);
                setNewSubjectName('');
              }}
            >
              <X size={15} /> Hủy
            </button>
          </div>
        </form>
      )}

      {/* Subject Sections */}
      {subjects.map((subject) => {
        const subjectQuizzes = quizzes.filter(q => q.subject_id === subject.id);
        const isCollapsed = Boolean(collapsedSubjects[subject.id]);
        const isDragOver = dragOverTarget === subject.id;
        const isEditing = editingSubjectId === subject.id;

        return (
          <div
            key={subject.id}
            className={`subject-section ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, subject.id)}
            onDragLeave={(e) => handleDragLeave(e, subject.id)}
            onDrop={(e) => handleDropQuiz(e, subject.id)}
          >
            {/* Subject Header */}
            <div
              className="subject-header"
              onClick={() => toggleCollapse(subject.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#7c3aed',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title={isCollapsed ? 'Mở rộng mục môn này' : 'Thu gọn mục môn này'}
                >
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>

                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c3aed'
                }}>
                  <Folders size={17} />
                </div>

                {isEditing ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editingSubjectName}
                      onChange={(e) => setEditingSubjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditSubject(subject.id);
                        if (e.key === 'Escape') setEditingSubjectId(null);
                      }}
                      autoFocus
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1.5px solid #7c3aed',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '3px 8px' }}
                      onClick={() => handleSaveEditSubject(subject.id)}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px' }}
                      onClick={() => setEditingSubjectId(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <h4
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem'
                    }}
                    title="Bấm nút bút chì bên cạnh để đổi tên môn học"
                  >
                    {subject.name}
                  </h4>
                )}

                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  border: '1px solid #ddd6fe',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {subjectQuizzes.length} đề thi
                </span>
              </div>

              {/* Actions on Subject Header */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                {!isEditing && (
                  <button
                    type="button"
                    onClick={(e) => handleStartEditSubject(subject, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title="Đổi tên môn học này"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#7c3aed'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    <Edit3 size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => handleDeleteSubject(subject.id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title="Xóa mục môn này (đề thi sẽ được chuyển ra ngoài)"
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Subject Content / Dropzone Area */}
            {!isCollapsed && (
              <div className="subject-dropzone">
                {subjectQuizzes.length === 0 ? (
                  <div className="empty-zone">
                    <Folders size={32} style={{ color: '#ddd6fe', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#64748b' }}>
                      Chưa có đề thi trong mục "{subject.name}"
                    </p>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      Nắm kéo thả đề thi từ bên ngoài hoặc từ môn khác vào đây
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {subjectQuizzes.map((quiz) => (
                      <QuizCardItem
                        key={quiz.id}
                        quiz={quiz}
                        subjects={subjects}
                        isDragging={draggingQuizId === quiz.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onSelectSubject={handleSelectSubject}
                        onSelectQuiz={onSelectQuiz}
                        onStartQuiz={onStartQuiz}
                        onDeleteQuiz={handleDeleteQuiz}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Section for Uncategorized / Outside Quizzes */}
      <div
        className={`subject-section ${dragOverTarget === 'uncategorized' ? 'drag-over' : ''}`}
        style={{
          border: '1.5px dashed #cbd5e1',
          background: '#ffffff'
        }}
        onDragOver={(e) => handleDragOver(e, 'uncategorized')}
        onDragLeave={(e) => handleDragLeave(e, 'uncategorized')}
        onDrop={(e) => handleDropQuiz(e, '')}
      >
        {/* Uncategorized Header */}
        <div
          className="subject-header"
          style={{ background: '#f8fafc' }}
          onClick={() => toggleCollapse('uncategorized')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0
              }}
            >
              {collapsedSubjects['uncategorized'] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            </button>

            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b'
            }}>
              <FileText size={17} />
            </div>

            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', margin: 0 }}>
              Đề thi ngoài mục (Chưa phân loại môn)
            </h4>

            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {uncategorizedQuizzes.length} đề thi
            </span>
          </div>

          <span style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>
            Thả đề thi vào đây để kéo ra ngoài mục
          </span>
        </div>

        {/* Uncategorized Dropzone Area */}
        {!collapsedSubjects['uncategorized'] && (
          <div className="subject-dropzone">
            {uncategorizedQuizzes.length === 0 ? (
              <div className="empty-zone">
                <Check size={28} style={{ color: '#10b981', marginBottom: '0.4rem' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#10b981' }}>
                  Tất cả các đề thi đã được phân loại vào các mục môn học!
                </p>
                <span style={{ fontSize: '0.775rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Nếu muốn gỡ bài thi ra khỏi môn, bạn chỉ cần nắm kéo thẻ bài thi thả vào khu vực này.
                </span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {uncategorizedQuizzes.map((quiz) => (
                  <QuizCardItem
                    key={quiz.id}
                    quiz={quiz}
                    subjects={subjects}
                    isDragging={draggingQuizId === quiz.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSelectSubject={handleSelectSubject}
                    onSelectQuiz={onSelectQuiz}
                    onStartQuiz={onStartQuiz}
                    onDeleteQuiz={handleDeleteQuiz}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Single Quiz Card Component with Drag Handle, Quick Folder Selector, and Action Buttons
 */
function QuizCardItem({
  quiz,
  subjects,
  isDragging,
  onDragStart,
  onDragEnd,
  onSelectSubject,
  onSelectQuiz,
  onStartQuiz,
  onDeleteQuiz
}) {
  return (
    <div
      className={`card quiz-card-draggable ${isDragging ? 'is-dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, quiz.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelectQuiz(quiz.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid #e4e4e7',
        padding: '1.25rem',
        borderRadius: '12px',
        position: 'relative',
        background: '#ffffff'
      }}
    >
      <div>
        {/* Card Header: Grip handle + Question count + Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span
              style={{
                color: '#94a3b8',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '4px'
              }}
              title="Nắm kéo thả đề thi này vào môn khác hoặc ra ngoài mục"
            >
              <GripVertical size={16} />
            </span>

            <span className="badge badge-blue" style={{ fontSize: '0.75rem', fontWeight: 800 }}>
              <HelpCircle size={13} /> {quiz.question_count} câu hỏi
            </span>
          </div>

          <button
            onClick={(e) => onDeleteQuiz(quiz.id, e)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px'
            }}
            title="Xóa bài thi này"
            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Title */}
        <h4 style={{
          fontSize: '1.05rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '0.4rem',
          lineHeight: 1.35
        }}>
          {quiz.title}
        </h4>

        {/* Word Filename */}
        <p style={{
          fontSize: '0.8rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          marginBottom: '0.85rem',
          wordBreak: 'break-all'
        }}>
          <FileText size={14} style={{ flexShrink: 0 }} /> {quiz.filename}
        </p>

        {/* Quick Subject Select Dropdown */}
        <div
          style={{ marginBottom: '0.75rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
              Mục:
            </span>
            <select
              value={quiz.subject_id || ''}
              onChange={(e) => onSelectSubject(quiz.id, e.target.value)}
              style={{
                flex: 1,
                fontSize: '0.775rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #ddd6fe',
                background: quiz.subject_id ? '#f5f3ff' : '#ffffff',
                color: quiz.subject_id ? '#7c3aed' : '#475569',
                cursor: 'pointer',
                outline: 'none'
              }}
              title="Bấm để chuyển nhanh sang mục môn khác hoặc đưa ra ngoài"
            >
              <option value="">-- Ngoài mục (Chưa phân loại) --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>📁 {s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card Footer: Date + Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.85rem',
        borderTop: '1px solid #f1f5f9',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Calendar size={13} />
          {new Date(quiz.created_at).toLocaleDateString('vi-VN')}
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectQuiz(quiz.id);
            }}
            style={{
              background: '#f5f3ff',
              borderColor: '#ddd6fe',
              color: '#7c3aed',
              fontWeight: 700
            }}
            title="Chỉnh sửa câu hỏi, thêm đáp án trước khi làm bài"
          >
            <Edit3 size={15} /> Sửa câu & đáp án
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onStartQuiz(quiz.id);
            }}
            title="Bắt đầu làm bài thi ngay"
          >
            <Play size={14} /> Làm bài
          </button>
        </div>
      </div>
    </div>
  );
}
