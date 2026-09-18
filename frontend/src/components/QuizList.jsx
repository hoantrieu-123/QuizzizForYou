import React, { useState, useEffect } from 'react';
import {
  Play, Edit3, Trash2, Calendar, HelpCircle,
  FileText, Folders, AddFolder, ChevronDown, ChevronRight,
  GripVertical, Plus, Check, X
} from './UIcons';
import { apiUrl } from '../apiConfig';

export const naturalCompareQuizzes = (a, b) => {
  const titleA = (a?.title || a?.filename || '').trim();
  const titleB = (b?.title || b?.filename || '').trim();
  const comp = titleA.localeCompare(titleB, 'vi', { numeric: true, sensitivity: 'base' });
  if (comp !== 0) return comp;
  const fileComp = (a?.filename || '').trim().localeCompare((b?.filename || '').trim(), 'vi', { numeric: true, sensitivity: 'base' });
  if (fileComp !== 0) return fileComp;
  return new Date(a?.created_at || 0) - new Date(b?.created_at || 0);
};

export default function QuizList({
  onSelectQuiz,
  onStartQuiz,
  refreshTrigger,
  selectedFilter,
  onClearFilter,
  onQuizPlacementChanged
}) {
  const [quizzes, setQuizzes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drag and Drop state
  const [draggingQuizId, setDraggingQuizId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  // Collapse state for subjects: { [subjectId]: boolean }
  // Mặc định: tất cả các mục môn học ở dạng thu gọn (true) khi mở website và khi load lại
  const [collapsedSubjects, setCollapsedSubjects] = useState({});

  const isSubjectCollapsed = (subjectId) => {
    return collapsedSubjects[subjectId] !== undefined ? collapsedSubjects[subjectId] : true;
  };

  // Toggle Collapse/Expand
  const toggleCollapse = (subjectId) => {
    setCollapsedSubjects(prev => {
      const current = prev[subjectId] !== undefined ? prev[subjectId] : true;
      return {
        ...prev,
        [subjectId]: !current
      };
    });
  };

  // Auto-expand when a specific subject or uncategorized is selected from sidebar tree
  useEffect(() => {
    if (selectedFilter?.type === 'subject') {
      setCollapsedSubjects(prev => ({ ...prev, [selectedFilter.id]: false }));
    } else if (selectedFilter?.type === 'uncategorized') {
      setCollapsedSubjects(prev => ({ ...prev, uncategorized: false }));
    }
  }, [selectedFilter]);

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

      const rawQuizzes = quizzesData.quizzes || [];
      rawQuizzes.sort(naturalCompareQuizzes);
      setQuizzes(rawQuizzes);
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

  // Delete Quiz
  const handleDeleteQuiz = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài kiểm tra này không?')) return;
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${id}`), { method: 'DELETE' });
      if (res.ok) {
        setQuizzes(prev => prev.filter(q => q.id !== id));
        onQuizPlacementChanged?.();
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
    const targetSub = subjects.find(s => s.id === normalizedSubjectId);

    // Check if unchanged
    const currentQuiz = quizzes.find(q => q.id === quizId);
    if (currentQuiz && (currentQuiz.subject_id || '') === normalizedSubjectId) {
      return;
    }

    // Optimistic UI update
    setQuizzes(prev => prev.map(q => q.id === quizId ? {
      ...q,
      subject_id: normalizedSubjectId,
      semester_id: targetSub ? targetSub.semester_id : '',
      class_id: targetSub ? targetSub.class_id : ''
    } : q));

    // Auto-expand destination subject so the quiz is immediately visible
    setCollapsedSubjects(prev => ({
      ...prev,
      [normalizedSubjectId || 'uncategorized']: false
    }));

    try {
      await fetch(apiUrl(`/api/quizzes/${quizId}/placement`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: normalizedSubjectId || null,
          semester_id: targetSub ? targetSub.semester_id : null,
          class_id: targetSub ? targetSub.class_id : null
        })
      });
      onQuizPlacementChanged?.();
    } catch (err) {
      console.error('Lỗi khi cập nhật môn học cho đề thi:', err);
      fetchData();
    }
  };

  // Quick Change Subject via Dropdown
  const handleSelectSubject = async (quizId, targetSubjectId) => {
    const normalizedSubjectId = targetSubjectId || '';
    const targetSub = subjects.find(s => s.id === normalizedSubjectId);

    setQuizzes(prev => prev.map(q => q.id === quizId ? {
      ...q,
      subject_id: normalizedSubjectId,
      semester_id: targetSub ? targetSub.semester_id : '',
      class_id: targetSub ? targetSub.class_id : ''
    } : q));

    setCollapsedSubjects(prev => ({
      ...prev,
      [normalizedSubjectId || 'uncategorized']: false
    }));

    try {
      await fetch(apiUrl(`/api/quizzes/${quizId}/placement`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: normalizedSubjectId || null,
          semester_id: targetSub ? targetSub.semester_id : null,
          class_id: targetSub ? targetSub.class_id : null
        })
      });
      onQuizPlacementChanged?.();
    } catch (err) {
      console.error('Lỗi khi chuyển môn học:', err);
      fetchData();
    }
  };

  // Create Subject
  const handleCreateSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    let semId = '';
    let clsId = '';
    if (selectedFilter?.type === 'semester') {
      semId = selectedFilter.id;
    } else if (selectedFilter?.type === 'class') {
      clsId = selectedFilter.id;
    }

    try {
      const res = await fetch(apiUrl('/api/subjects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          semester_id: semId || null,
          class_id: clsId || null
        })
      });
      const data = await res.json();
      if (data.subject) {
        setSubjects(prev => [...prev, data.subject]);
        setNewSubjectName('');
        setShowAddSubject(false);
        onQuizPlacementChanged?.();
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
      onQuizPlacementChanged?.();
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
        onQuizPlacementChanged?.();
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

  // Filter subjects and quizzes based on selectedFilter
  const validSubjectIds = new Set(subjects.map(s => s.id));
  let filteredSubjects = subjects;
  let showUncategorized = true;
  let filterContextTitle = null;

  if (selectedFilter && selectedFilter.type !== 'all') {
    if (selectedFilter.type === 'class') {
      filteredSubjects = subjects.filter(s => s.class_id === selectedFilter.id);
      showUncategorized = false;
      filterContextTitle = `Lớp: ${selectedFilter.name}`;
    } else if (selectedFilter.type === 'semester') {
      filteredSubjects = subjects.filter(s => s.semester_id === selectedFilter.id);
      showUncategorized = false;
      filterContextTitle = `Kỳ học: ${selectedFilter.name}`;
    } else if (selectedFilter.type === 'subject') {
      filteredSubjects = subjects.filter(s => s.id === selectedFilter.id);
      showUncategorized = false;
      filterContextTitle = `Môn: ${selectedFilter.name}`;
    } else if (selectedFilter.type === 'uncategorized') {
      filteredSubjects = [];
      showUncategorized = true;
      filterContextTitle = `Đề chưa phân loại`;
    }
  }

  // Quizzes not assigned to any existing subject
  const uncategorizedQuizzes = quizzes
    .filter(q => !q.subject_id || !validSubjectIds.has(q.subject_id))
    .sort(naturalCompareQuizzes);

  // Quizzes in semester but not in any specific subject
  const directSemesterQuizzes = (selectedFilter?.type === 'semester')
    ? quizzes.filter(q => q.semester_id === selectedFilter.id && (!q.subject_id || !validSubjectIds.has(q.subject_id))).sort(naturalCompareQuizzes)
    : [];

  // Quizzes in class but not in any specific subject
  const directClassQuizzes = (selectedFilter?.type === 'class')
    ? quizzes.filter(q => q.class_id === selectedFilter.id && (!q.subject_id || !validSubjectIds.has(q.subject_id))).sort(naturalCompareQuizzes)
    : [];

  // Calculate total quizzes currently displayed
  const displayedQuizzesCount = (() => {
    if (!selectedFilter || selectedFilter.type === 'all') return quizzes.length;
    if (selectedFilter.type === 'uncategorized') return uncategorizedQuizzes.length;
    if (selectedFilter.type === 'subject') return quizzes.filter(q => q.subject_id === selectedFilter.id).length;
    if (selectedFilter.type === 'semester') {
      const semSubIds = new Set(filteredSubjects.map(s => s.id));
      return quizzes.filter(q => q.semester_id === selectedFilter.id || semSubIds.has(q.subject_id)).length;
    }
    if (selectedFilter.type === 'class') {
      const clsSubIds = new Set(filteredSubjects.map(s => s.id));
      return quizzes.filter(q => q.class_id === selectedFilter.id || clsSubIds.has(q.subject_id)).length;
    }
    return quizzes.length;
  })();

  // Check collapse state across all subjects + uncategorized
  const allSubjectIds = [...filteredSubjects.map(s => s.id), ...(showUncategorized ? ['uncategorized'] : [])];
  const areAllCollapsed = allSubjectIds.length > 0 && allSubjectIds.every(id => isSubjectCollapsed(id));

  const toggleAllCollapse = () => {
    const nextState = !areAllCollapsed;
    const next = {};
    allSubjectIds.forEach(id => {
      next[id] = nextState;
    });
    setCollapsedSubjects(next);
  };

  return (
    <div>
      {/* Filter Breadcrumb Bar */}
      {selectedFilter && selectedFilter.type !== 'all' && (
        <div className="filter-breadcrumb-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700 }}>Đang xem:</span>
            <button
              type="button"
              className="breadcrumb-chip root"
              onClick={onClearFilter}
              title="Xem tất cả đề thi"
            >
              Tất cả
            </button>
            {(selectedFilter.path || [selectedFilter.name]).map((crumb, idx, arr) => (
              <React.Fragment key={idx}>
                <ChevronRight size={13} style={{ color: '#94a3b8' }} />
                <span className={`breadcrumb-chip ${idx === arr.length - 1 ? 'active' : ''}`}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
          <button
            type="button"
            className="btn-clear-filter"
            onClick={onClearFilter}
            title="Xóa bộ lọc"
          >
            <X size={13} /> Xem tất cả
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Folders size={22} style={{ color: '#7c3aed' }} />
            {filterContextTitle ? filterContextTitle : 'Danh sách đề thi theo môn'} ({displayedQuizzesCount} đề thi)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0' }}>
            Kéo thả các đề thi trắc nghiệm vào từng môn hoặc cây bên trái để phân loại.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {filteredSubjects.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={toggleAllCollapse}
              style={{
                padding: '0.5rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: '#ffffff',
                borderColor: '#e2e8f0',
                color: '#475569'
              }}
              title={areAllCollapsed ? 'Mở rộng tất cả các mục môn học' : 'Thu gọn tất cả các mục môn học'}
            >
              {areAllCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              {areAllCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
            </button>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddSubject(true)}
            style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            title="Tạo thêm thư mục môn học mới"
          >
            <AddFolder size={17} /> + Thêm môn học
          </button>
        </div>
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
      {filteredSubjects.map((subject) => {
        const subjectQuizzes = quizzes
          .filter(q => q.subject_id === subject.id)
          .sort(naturalCompareQuizzes);
        const isCollapsed = isSubjectCollapsed(subject.id);
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
              style={{ borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0' }}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
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

      {/* Section for quizzes assigned to semester directly without a specific subject */}
      {directSemesterQuizzes.length > 0 && (
        <div className="subject-section" style={{ border: '1.5px dashed #f59e0b', background: '#ffffff', marginBottom: '0.75rem' }}>
          <div className="subject-header" style={{ background: '#fffbeb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
                Đề thi gán trong kỳ này (chưa phân vào môn cụ thể)
              </h4>
              <span className="badge badge-purple" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.75rem' }}>
                {directSemesterQuizzes.length} đề thi
              </span>
            </div>
          </div>
          <div className="subject-dropzone">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
              {directSemesterQuizzes.map((quiz) => (
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
          </div>
        </div>
      )}

      {/* Section for quizzes assigned to class directly without a specific subject */}
      {directClassQuizzes.length > 0 && (
        <div className="subject-section" style={{ border: '1.5px dashed #6366f1', background: '#ffffff', marginBottom: '0.75rem' }}>
          <div className="subject-header" style={{ background: '#eef2ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={16} />
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3730a3', margin: 0 }}>
                Đề thi chung của lớp (chưa phân vào môn cụ thể)
              </h4>
              <span className="badge badge-blue" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}>
                {directClassQuizzes.length} đề thi
              </span>
            </div>
          </div>
          <div className="subject-dropzone">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
              {directClassQuizzes.map((quiz) => (
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
          </div>
        </div>
      )}

      {/* Empty State when current filtered view has no subjects or quizzes */}
      {filteredSubjects.length === 0 && !showUncategorized && directSemesterQuizzes.length === 0 && directClassQuizzes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#fafafa', border: '1.5px dashed #cbd5e1', borderRadius: '12px', margin: '1rem 0' }}>
          <Folders size={36} style={{ color: '#cbd5e1', marginBottom: '0.6rem' }} />
          <h4 style={{ fontWeight: 700, color: '#475569', margin: '0 0 0.4rem' }}>Chưa có môn học hoặc đề thi trong mục này</h4>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem' }}>
            Bạn có thể tạo môn học mới bên dưới hoặc kéo thả đề thi vào mục này từ cây thư mục bên trái.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddSubject(true)}
            style={{ fontWeight: 700 }}
          >
            <AddFolder size={16} /> + Thêm môn học
          </button>
        </div>
      )}

      {/* Section for Uncategorized / Outside Quizzes */}
      {showUncategorized && (() => {
        const isUncategorizedCollapsed = isSubjectCollapsed('uncategorized');
        return (
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
              style={{ background: '#f8fafc', borderBottom: isUncategorizedCollapsed ? 'none' : '1px solid #cbd5e1' }}
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
                  {isUncategorizedCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
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
                  background: '#f1f5f9',
                  color: '#64748b',
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
            {!isUncategorizedCollapsed && (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
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
    );
  })()}
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
        border: '1px solid #e2e8f0',
        padding: '0.55rem 0.7rem',
        borderRadius: '8px',
        position: 'relative',
        background: '#ffffff',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        transition: 'all 0.15s ease'
      }}
    >
      <div>
        {/* Card Header: Grip handle + Question count + Date + Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
            <span
              style={{
                color: '#94a3b8',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                padding: '1px'
              }}
              title="Nắm kéo thả đề thi này vào môn khác hoặc ra ngoài mục"
            >
              <GripVertical size={13} />
            </span>

            <span
              className="badge badge-blue"
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              {quiz.question_count} câu
            </span>

            <span
              style={{
                fontSize: '0.65rem',
                color: '#94a3b8',
                whiteSpace: 'nowrap'
              }}
              title={`Ngày tạo: ${new Date(quiz.created_at).toLocaleDateString('vi-VN')}`}
            >
              • {new Date(quiz.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>

          <button
            onClick={(e) => onDeleteQuiz(quiz.id, e)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Xóa bài thi này"
            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Title */}
        <h4
          style={{
            fontSize: '0.835rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.25rem',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
          title={quiz.title}
        >
          {quiz.title}
        </h4>

        {/* Word Filename */}
        <p
          style={{
            fontSize: '0.68rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginBottom: '0.35rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={quiz.filename}
        >
          <FileText size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {quiz.filename}
          </span>
        </p>

        {/* Quick Subject Select Dropdown */}
        <div
          style={{ marginBottom: '0.4rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value={quiz.subject_id || ''}
            onChange={(e) => onSelectSubject(quiz.id, e.target.value)}
            style={{
              width: '100%',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              background: quiz.subject_id ? '#f5f3ff' : '#f8fafc',
              color: quiz.subject_id ? '#7c3aed' : '#64748b',
              cursor: 'pointer',
              outline: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              height: '21px'
            }}
            title="Chuyển mục môn học"
          >
            <option value="">-- Ngoài mục (Chưa phân loại) --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>📁 {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Card Footer: Action Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        paddingTop: '0.35rem',
        borderTop: '1px solid #f1f5f9'
      }}>
        <button
          className="btn btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            onStartQuiz(quiz.id);
          }}
          style={{
            flex: 1,
            padding: '0.26rem 0.4rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem'
          }}
          title="Bắt đầu làm bài thi ngay"
        >
          <Play size={11} /> Làm bài
        </button>

        <button
          className="btn btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onSelectQuiz(quiz.id);
          }}
          style={{
            background: '#f5f3ff',
            borderColor: '#ddd6fe',
            color: '#7c3aed',
            fontWeight: 700,
            padding: '0.26rem 0.45rem',
            fontSize: '0.74rem',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.2rem'
          }}
          title="Chỉnh sửa câu hỏi, thêm đáp án trước khi làm bài"
        >
          <Edit3 size={11} /> Sửa
        </button>
      </div>
    </div>
  );
}
