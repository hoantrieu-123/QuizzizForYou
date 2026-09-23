import React, { useState, useEffect } from 'react';
import {
  Folders, AddFolder, ChevronDown, ChevronRight,
  Plus, Edit3, Trash2, Check, X, Calendar, Layers, GripVertical, FileText
} from './UIcons';
import { apiUrl } from '../apiConfig';

export default function SidebarTree({
  selectedFilter,
  onSelectFilter,
  refreshTrigger,
  onTreeUpdated
}) {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Expand/collapse state for classes and semesters: { [id]: boolean }
  // By default, expand all classes and semesters so they are readily visible
  const [expandedNodes, setExpandedNodes] = useState({});

  // Drag over target tracking
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [draggingSubjectId, setDraggingSubjectId] = useState(null);

  // Inline forms for adding / editing
  // addingType: null | 'class' | { type: 'semester', classId: string } | { type: 'subject', semesterId: string, classId: string }
  const [addingState, setAddingState] = useState(null);
  const [addingName, setAddingName] = useState('');

  // editingState: null | { type: 'class'|'semester'|'subject', id: string, name: string }
  const [editingState, setEditingState] = useState(null);

  const fetchTree = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/tree'));
      const data = await res.json();
      setTreeData(data);

      // Default expand all if not set yet
      setExpandedNodes(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initialExpanded = {};
        (data.classes || []).forEach(cls => {
          initialExpanded[`class_${cls.id}`] = true;
          (cls.semesters || []).forEach(sem => {
            initialExpanded[`semester_${sem.id}`] = true;
          });
        });
        return initialExpanded;
      });
    } catch (err) {
      console.error('Lỗi khi tải cây cấu trúc:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [refreshTrigger]);

  const toggleNode = (nodeKey, e) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: prev[nodeKey] !== undefined ? !prev[nodeKey] : false
    }));
  };

  // Drag & Drop onto Tree Nodes
  const handleDragOver = (e, targetKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget !== targetKey) {
      setDragOverTarget(targetKey);
    }
  };

  const handleDragLeave = (e, targetKey) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverTarget === targetKey) {
        setDragOverTarget(null);
      }
    }
  };

  const handleDrop = async (e, targetType, targetId, extraMeta = {}) => {
    e.preventDefault();
    setDragOverTarget(null);
    setDraggingSubjectId(null);

    const plainData = e.dataTransfer.getData('text/plain') || '';
    let jsonData = null;
    try {
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) jsonData = JSON.parse(rawJson);
    } catch (err) {}

    // CASE 1: Dropping a SUBJECT onto a Semester
    if ((jsonData && jsonData.type === 'subject') || plainData.startsWith('subject:')) {
      const subjectId = jsonData?.id || plainData.replace('subject:', '');
      if (targetType === 'semester') {
        try {
          const res = await fetch(apiUrl(`/api/subjects/${subjectId}/move`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              semester_id: targetId,
              class_id: extraMeta.class_id || null
            })
          });
          if (res.ok) {
            // Auto expand destination semester
            setExpandedNodes(prev => ({ ...prev, [`semester_${targetId}`]: true }));
            await fetchTree();
            if (onTreeUpdated) onTreeUpdated();
          } else {
            const data = await res.json().catch(() => ({}));
            alert(data.detail || 'Không thể chuyển môn vào kỳ học này');
          }
        } catch (err) {
          console.error('Lỗi khi chuyển môn vào kỳ học:', err);
          alert('Không thể chuyển môn vào kỳ: ' + err.message);
        }
      }
      return;
    }

    // CASE 2: Dropping a QUIZ
    const quizId = plainData;
    if (!quizId) return;

    let payload = {};
    if (targetType === 'subject') {
      payload = {
        subject_id: targetId,
        semester_id: extraMeta.semester_id || null,
        class_id: extraMeta.class_id || null
      };
    } else if (targetType === 'semester') {
      payload = {
        subject_id: null,
        semester_id: targetId,
        class_id: extraMeta.class_id || null
      };
    } else if (targetType === 'uncategorized') {
      payload = {
        subject_id: null,
        semester_id: null,
        class_id: null
      };
    }

    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}/placement`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật vị trí đề thi:', err);
    }
  };

  // CRUD for Classes
  const handleCreateClass = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addingName.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/classes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addingName.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddingState(null);
        setAddingName('');
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể tạo lớp mới');
      }
    } catch (err) {
      alert('Không thể tạo lớp: ' + err.message);
    }
  };

  const handleSaveEditClass = async (classId) => {
    if (!editingState?.name.trim()) return;
    try {
      const res = await fetch(apiUrl(`/api/classes/${classId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingState.name.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingState(null);
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể cập nhật lớp');
      }
    } catch (err) {
      alert('Không thể cập nhật lớp: ' + err.message);
    }
  };

  const handleDeleteClass = async (classId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa Lớp này? Các kỳ học, môn học và đề thi sẽ không bị xóa mà chuyển ra ngoài.')) return;
    try {
      const res = await fetch(apiUrl(`/api/classes/${classId}`), { method: 'DELETE' });
      if (res.ok) {
        if (selectedFilter?.id === classId) {
          onSelectFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] });
        }
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      }
    } catch (err) {
      alert('Không thể xóa lớp: ' + err.message);
    }
  };

  // CRUD for Semesters
  const handleCreateSemester = async (e, classId) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addingName.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/semesters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addingName.trim(), class_id: classId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddingState(null);
        setAddingName('');
        // Make sure class is expanded to see new semester
        setExpandedNodes(prev => ({ ...prev, [`class_${classId}`]: true }));
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể tạo kỳ học');
      }
    } catch (err) {
      alert('Không thể tạo kỳ học: ' + err.message);
    }
  };

  const handleSaveEditSemester = async (semesterId) => {
    if (!editingState?.name.trim()) return;
    try {
      const res = await fetch(apiUrl(`/api/semesters/${semesterId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingState.name.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingState(null);
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể cập nhật kỳ học');
      }
    } catch (err) {
      alert('Không thể cập nhật kỳ học: ' + err.message);
    }
  };

  const handleDeleteSemester = async (semesterId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa Kỳ học này? Các môn và đề thi sẽ được giữ lại an toàn.')) return;
    try {
      const res = await fetch(apiUrl(`/api/semesters/${semesterId}`), { method: 'DELETE' });
      if (res.ok) {
        if (selectedFilter?.id === semesterId) {
          onSelectFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] });
        }
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      }
    } catch (err) {
      alert('Không thể xóa kỳ học: ' + err.message);
    }
  };

  // CRUD for Subjects
  const handleCreateSubject = async (e, semesterId, classId) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addingName.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/subjects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addingName.trim(),
          semester_id: semesterId,
          class_id: classId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddingState(null);
        setAddingName('');
        // Make sure semester is expanded
        setExpandedNodes(prev => ({ ...prev, [`semester_${semesterId}`]: true }));
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể tạo môn học');
      }
    } catch (err) {
      alert('Không thể tạo môn học: ' + err.message);
    }
  };

  const handleSaveEditSubject = async (subjectId) => {
    if (!editingState?.name.trim()) return;
    try {
      const res = await fetch(apiUrl(`/api/subjects/${subjectId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingState.name.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingState(null);
        await fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      } else {
        alert(data.detail || 'Không thể cập nhật tên môn');
      }
    } catch (err) {
      alert('Không thể cập nhật tên môn: ' + err.message);
    }
  };

  const handleDeleteSubject = async (subjectId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa Môn học này? Các đề thi bên trong sẽ được chuyển ra ngoài.')) return;
    try {
      const res = await fetch(apiUrl(`/api/subjects/${subjectId}`), { method: 'DELETE' });
      if (res.ok) {
        if (selectedFilter?.id === subjectId) {
          onSelectFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] });
        }
        fetchTree();
        if (onTreeUpdated) onTreeUpdated();
      }
    } catch (err) {
      alert('Không thể xóa môn học: ' + err.message);
    }
  };

  const isSelected = (type, id) => {
    if (!selectedFilter) return type === 'all';
    return selectedFilter.type === type && selectedFilter.id === id;
  };

  if (loading && !treeData) {
    return (
      <div className="sidebar-tree-container" style={{ padding: '1.25rem', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
        Đang tải cây đào tạo...
      </div>
    );
  }

  const classes = treeData?.classes || [];
  const totalQuizzes = treeData?.total_quizzes || 0;
  const uncategorizedCount = treeData?.uncategorized_count || 0;

  return (
    <aside className="sidebar-tree-container">
      {/* Top CTA: Import Word */}
      <div style={{ marginBottom: '0.65rem' }}>
        <a
          href="#import-word-hero"
          className="sidebar-cta-btn"
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById('import-word-hero');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          title="Kéo thả file Word để tạo bài thi"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Import Word (.docx)</span>
          </div>
        </a>
      </div>

      {/* Quick Navigation Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '0.5rem', paddingBottom: '0.65rem', borderBottom: '1px solid #eeeeee' }}>
        <div
          className={`sidebar-nav-item ${selectedFilter?.type === 'all' ? 'active' : ''}`}
          onClick={() => onSelectFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] })}
        >
          <span>Tất cả đề thi</span>
        </div>
        <div
          className={`sidebar-nav-item ${selectedFilter?.type === 'uncategorized' ? 'active' : ''}`}
          onClick={() => onSelectFilter({ type: 'uncategorized', id: 'uncategorized', name: 'Chưa phân loại', path: ['Chưa phân loại'] })}
        >
          <span>Đề chưa phân loại</span>
          {uncategorizedCount > 0 && <span className="tree-badge" style={{ marginLeft: 'auto' }}>{uncategorizedCount}</span>}
        </div>
      </div>

      {/* Sidebar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.25rem 0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={16} style={{ color: '#222222' }} />
          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#222222' }}>
            Cấu trúc đào tạo
          </span>
        </div>

        <button
          type="button"
          className="btn-tree-action"
          title="Thêm Lớp học mới"
          onClick={() => {
            setAddingState('class');
            setAddingName('');
          }}
          style={{
            background: '#ffffff',
            color: '#222222',
            border: '1px solid #eeeeee',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer'
          }}
        >
          <Plus size={13} /> Lớp
        </button>
      </div>

      {/* Inline Form: Add Class */}
      {addingState === 'class' && (
        <form onSubmit={handleCreateClass} className="tree-inline-form">
          <input
            type="text"
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateClass(e);
              if (e.key === 'Escape') setAddingState(null);
            }}
            placeholder="Tên lớp (VD: Lớp CNTT K21)..."
            autoFocus
            className="tree-inline-input"
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={handleCreateClass} className="btn-inline-save" title="Lưu">
              <Check size={13} />
            </button>
            <button type="button" className="btn-inline-cancel" title="Hủy" onClick={() => setAddingState(null)}>
              <X size={13} />
            </button>
          </div>
        </form>
      )}

      {/* Tree Content */}
      <div className="sidebar-tree-content">
        {/* ROOT ITEM 1: All Quizzes */}
        <div
          className={`tree-node tree-node-root ${isSelected('all', 'all') ? 'active' : ''}`}
          onClick={() => onSelectFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] })}
        >
          <div className="tree-node-left">
            <div className="tree-node-icon" style={{ background: '#ffffff', color: '#222222', border: '1px solid #eeeeee' }}>
              <Folders size={14} />
            </div>
            <span className="tree-node-title">Tất cả đề thi</span>
          </div>
          <span className="tree-badge">{totalQuizzes}</span>
        </div>

        {/* CLASS NODES */}
        {classes.length === 0 && (
          <div className="tree-empty-hint" style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: '#94a3b8' }}>
            Chưa có lớp nào. Bấm nút <strong style={{ color: '#222222' }}>[+ Lớp]</strong> ở trên để bắt đầu tạo.
          </div>
        )}
        {classes.map((cls) => {
          const isClassExpanded = expandedNodes[`class_${cls.id}`] ?? true;
          const isClassActive = isSelected('class', cls.id);
          const isClassEditing = editingState?.type === 'class' && editingState?.id === cls.id;

          return (
            <div key={cls.id} className="tree-branch-class">
              {/* Class Node Item */}
              <div
                className={`tree-node tree-node-class ${isClassActive ? 'active' : ''}`}
                onClick={() => onSelectFilter({
                  type: 'class',
                  id: cls.id,
                  name: cls.name,
                  path: [cls.name]
                })}
              >
                <div className="tree-node-left">
                  <button
                    type="button"
                    className="tree-expand-btn"
                    onClick={(e) => toggleNode(`class_${cls.id}`, e)}
                    title={isClassExpanded ? 'Thu gọn' : 'Mở rộng'}
                  >
                    {isClassExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div className="tree-node-icon" style={{ background: '#ffffff', color: '#222222', border: '1px solid #eeeeee' }}>
                    <Layers size={13} />
                  </div>

                  {isClassEditing ? (
                    <div className="tree-inline-edit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingState.name}
                        onChange={(e) => setEditingState({ ...editingState, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditClass(cls.id);
                          if (e.key === 'Escape') setEditingState(null);
                        }}
                        autoFocus
                        className="tree-inline-input-sm"
                      />
                      <button type="button" className="btn-inline-save-sm" onClick={() => handleSaveEditClass(cls.id)}><Check size={12} /></button>
                      <button type="button" className="btn-inline-cancel-sm" onClick={() => setEditingState(null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <span className="tree-node-title font-semibold" title={cls.name}>
                      {cls.name}
                    </span>
                  )}
                </div>

                <div className="tree-node-right">
                  {!isClassEditing && (
                    <div className="tree-hover-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="tree-hover-btn"
                        title="Thêm Kỳ học vào lớp này"
                        onClick={() => {
                          setAddingState({ type: 'semester', classId: cls.id });
                          setAddingName('');
                        }}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        className="tree-hover-btn"
                        title="Đổi tên lớp"
                        onClick={() => setEditingState({ type: 'class', id: cls.id, name: cls.name })}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        className="tree-hover-btn btn-danger-hover"
                        title="Xóa lớp"
                        onClick={(e) => handleDeleteClass(cls.id, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                  <span className="tree-badge">{cls.quiz_count || 0}</span>
                </div>
              </div>

              {/* Inline Form: Add Semester under this Class */}
              {addingState?.type === 'semester' && addingState.classId === cls.id && (
                <form
                  onSubmit={(e) => handleCreateSemester(e, cls.id)}
                  className="tree-inline-form ml-tree-1"
                >
                  <input
                    type="text"
                    value={addingName}
                    onChange={(e) => setAddingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSemester(e, cls.id);
                      if (e.key === 'Escape') setAddingState(null);
                    }}
                    placeholder="Tên kỳ (VD: Học kỳ 1)..."
                    autoFocus
                    className="tree-inline-input"
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => handleCreateSemester(e, cls.id)}
                      className="btn-inline-save"
                      title="Lưu"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-inline-cancel"
                      title="Hủy"
                      onClick={() => setAddingState(null)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </form>
              )}

              {/* SEMESTERS UNDER CLASS */}
              {isClassExpanded && (
                <div className="tree-branch-semesters ml-tree-1">
                  {cls.semesters && cls.semesters.length === 0 && (
                    <div className="tree-empty-hint">
                      Chưa có kỳ học. Bấm [+] để thêm kỳ.
                    </div>
                  )}

                  {(cls.semesters || []).map((sem) => {
                    const isSemExpanded = expandedNodes[`semester_${sem.id}`] ?? true;
                    const isSemActive = isSelected('semester', sem.id);
                    const isSemEditing = editingState?.type === 'semester' && editingState?.id === sem.id;
                    const isSemDragOver = dragOverTarget === `sem_${sem.id}`;

                    return (
                      <div key={sem.id} className="tree-branch-semester">
                        {/* Semester Node Item (Also Drop Zone!) */}
                        <div
                          className={`tree-node tree-node-semester ${isSemActive ? 'active' : ''} ${isSemDragOver ? 'drag-over' : ''}`}
                          onClick={() => onSelectFilter({
                            type: 'semester',
                            id: sem.id,
                            name: sem.name,
                            path: [cls.name, sem.name]
                          })}
                          onDragOver={(e) => handleDragOver(e, `sem_${sem.id}`)}
                          onDragLeave={(e) => handleDragLeave(e, `sem_${sem.id}`)}
                          onDrop={(e) => handleDrop(e, 'semester', sem.id, { class_id: cls.id })}
                          title={`Kéo thả môn học hoặc đề thi vào đây để gán vào kỳ ${sem.name}`}
                        >
                          <div className="tree-node-left">
                            <button
                              type="button"
                              className="tree-expand-btn"
                              onClick={(e) => toggleNode(`semester_${sem.id}`, e)}
                              title={isSemExpanded ? 'Thu gọn' : 'Mở rộng'}
                            >
                              {isSemExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>

                            <div className="tree-node-icon" style={{ background: '#ffffff', color: '#222222', border: '1px solid #eeeeee' }}>
                              <Calendar size={12} />
                            </div>

                            {isSemEditing ? (
                              <div className="tree-inline-edit" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingState.name}
                                  onChange={(e) => setEditingState({ ...editingState, name: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditSemester(sem.id);
                                    if (e.key === 'Escape') setEditingState(null);
                                  }}
                                  autoFocus
                                  className="tree-inline-input-sm"
                                />
                                <button type="button" className="btn-inline-save-sm" onClick={() => handleSaveEditSemester(sem.id)}><Check size={12} /></button>
                                <button type="button" className="btn-inline-cancel-sm" onClick={() => setEditingState(null)}><X size={12} /></button>
                              </div>
                            ) : (
                              <span className="tree-node-title" title={sem.name}>
                                {sem.name}
                              </span>
                            )}
                          </div>

                          <div className="tree-node-right">
                            {!isSemEditing && (
                              <div className="tree-hover-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="tree-hover-btn"
                                  title="Thêm Môn học vào kỳ này"
                                  onClick={() => {
                                    setAddingState({ type: 'subject', semesterId: sem.id, classId: cls.id });
                                    setAddingName('');
                                  }}
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="tree-hover-btn"
                                  title="Đổi tên kỳ"
                                  onClick={() => setEditingState({ type: 'semester', id: sem.id, name: sem.name })}
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="tree-hover-btn btn-danger-hover"
                                  title="Xóa kỳ học"
                                  onClick={(e) => handleDeleteSemester(sem.id, e)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                            <span className="tree-badge">{sem.quiz_count || 0}</span>
                          </div>
                        </div>

                        {/* Inline Form: Add Subject under Semester */}
                        {addingState?.type === 'subject' && addingState.semesterId === sem.id && (
                          <form
                            onSubmit={(e) => handleCreateSubject(e, sem.id, cls.id)}
                            className="tree-inline-form ml-tree-2"
                          >
                            <input
                              type="text"
                              value={addingName}
                              onChange={(e) => setAddingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateSubject(e, sem.id, cls.id);
                                if (e.key === 'Escape') setAddingState(null);
                              }}
                              placeholder="Tên môn học (VD: Lập trình C++)..."
                              autoFocus
                              className="tree-inline-input"
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={(e) => handleCreateSubject(e, sem.id, cls.id)}
                                className="btn-inline-save"
                                title="Lưu"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-inline-cancel"
                                title="Hủy"
                                onClick={() => setAddingState(null)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </form>
                        )}

                        {/* SUBJECTS UNDER SEMESTER */}
                        {isSemExpanded && (
                          <div className="tree-branch-subjects ml-tree-2">
                            {sem.subjects && sem.subjects.length === 0 && (
                              <div className="tree-empty-hint">
                                Chưa có môn. Bấm [+] để thêm môn hoặc kéo môn vào kỳ.
                              </div>
                            )}

                            {(sem.subjects || []).map((sub) => {
                              const isSubActive = isSelected('subject', sub.id);
                              const isSubEditing = editingState?.type === 'subject' && editingState?.id === sub.id;
                              const isSubDragOver = dragOverTarget === `sub_${sub.id}`;

                              return (
                                <div
                                  key={sub.id}
                                  className={`tree-node tree-node-subject ${isSubActive ? 'active' : ''} ${isSubDragOver ? 'drag-over' : ''} ${draggingSubjectId === sub.id ? 'is-dragging' : ''}`}
                                  draggable={!isSubEditing}
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('text/plain', `subject:${sub.id}`);
                                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subject', id: sub.id, name: sub.name }));
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggingSubjectId(sub.id);
                                  }}
                                  onDragEnd={() => setDraggingSubjectId(null)}
                                  onClick={() => onSelectFilter({
                                    type: 'subject',
                                    id: sub.id,
                                    name: sub.name,
                                    path: [cls.name, sem.name, sub.name]
                                  })}
                                  onDragOver={(e) => handleDragOver(e, `sub_${sub.id}`)}
                                  onDragLeave={(e) => handleDragLeave(e, `sub_${sub.id}`)}
                                  onDrop={(e) => handleDrop(e, 'subject', sub.id, { semester_id: sem.id, class_id: cls.id })}
                                  title={`Nắm kéo để chuyển môn sang kỳ khác, hoặc thả đề thi vào môn "${sub.name}"`}
                                >
                                  <div className="tree-node-left">
                                    <span
                                      style={{ color: '#94a3b8', cursor: 'grab', display: 'inline-flex', alignItems: 'center' }}
                                      title="Nắm kéo môn này thả vào kỳ học khác"
                                    >
                                      <GripVertical size={11} />
                                    </span>

                                    <div className="tree-node-icon" style={{ background: '#ffffff', color: '#222222', border: '1px solid #eeeeee' }}>
                                      <Folders size={12} />
                                    </div>

                                    {isSubEditing ? (
                                      <div className="tree-inline-edit" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={editingState.name}
                                          onChange={(e) => setEditingState({ ...editingState, name: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveEditSubject(sub.id);
                                            if (e.key === 'Escape') setEditingState(null);
                                          }}
                                          autoFocus
                                          className="tree-inline-input-sm"
                                        />
                                        <button type="button" className="btn-inline-save-sm" onClick={() => handleSaveEditSubject(sub.id)}><Check size={12} /></button>
                                        <button type="button" className="btn-inline-cancel-sm" onClick={() => setEditingState(null)}><X size={12} /></button>
                                      </div>
                                    ) : (
                                      <span className="tree-node-title" title={sub.name}>
                                        {sub.name}
                                      </span>
                                    )}
                                  </div>

                                  <div className="tree-node-right">
                                    {!isSubEditing && (
                                      <div className="tree-hover-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="tree-hover-btn"
                                          title="Đổi tên môn"
                                          onClick={() => setEditingState({ type: 'subject', id: sub.id, name: sub.name })}
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="tree-hover-btn btn-danger-hover"
                                          title="Xóa môn học"
                                          onClick={(e) => handleDeleteSubject(sub.id, e)}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                    <span className="tree-badge">{sub.quiz_count || 0}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* BOTTOM ITEM: Uncategorized / Outside Quizzes */}
        <div
          className={`tree-node tree-node-uncategorized ${isSelected('uncategorized', 'uncategorized') ? 'active' : ''} ${dragOverTarget === 'uncategorized' ? 'drag-over' : ''}`}
          onClick={() => onSelectFilter({
            type: 'uncategorized',
            id: 'uncategorized',
            name: 'Đề chưa phân loại',
            path: ['Chưa phân loại']
          })}
          onDragOver={(e) => handleDragOver(e, 'uncategorized')}
          onDragLeave={(e) => handleDragLeave(e, 'uncategorized')}
          onDrop={(e) => handleDrop(e, 'uncategorized', null)}
          title="Kéo thả đề thi vào đây để gỡ ra khỏi mục"
        >
          <div className="tree-node-left">
            <div className="tree-node-icon" style={{ background: '#ffffff', color: '#222222', border: '1px solid #eeeeee' }}>
              <FileText size={12} />
            </div>
            <span className="tree-node-title" style={{ color: '#555555' }}>
              Đề chưa phân loại
            </span>
          </div>
          <span className="tree-badge" style={{ background: '#ffffff', color: '#555555', border: '1px solid #eeeeee' }}>
            {uncategorizedCount}
          </span>
        </div>
      </div>
    </aside>
  );
}

