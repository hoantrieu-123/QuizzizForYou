import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText, Download, UploadCloud, Plus, Trash2, Edit3, Check, X,
  Folders, Play, Loader2, ChevronRight, ChevronDown, AddFolder, Home, Clock, Calendar
} from './UIcons';
import { apiUrl } from '../apiConfig';

export default function DocumentList({
  selectedFilter,
  onClearFilter,
  searchQuery = '',
  onConvertDocToQuiz,
  onTreeUpdated,
  refreshTrigger = 0
}) {
  const [documents, setDocuments] = useState([]);
  const [folderTree, setFolderTree] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null: all, 'root': root, string: folder_id
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0 });
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'docx' | 'pdf'
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [previewDoc, setPreviewDoc] = useState(null); // Document object for PDF viewer
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [convertingDocId, setConvertingDocId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);

  // Folder Modal state: null | { type: 'create'|'rename'|'delete', parentId?: string, folderId?: string, currentName?: string, docCount?: number }
  const [modalState, setModalState] = useState(null);
  const [modalInputName, setModalInputName] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --------------------------------------------------------------------------
  // 1. Fetch Folder Tree
  // --------------------------------------------------------------------------
  const fetchFolderTree = async () => {
    try {
      setLoadingTree(true);
      const params = new URLSearchParams();
      if (selectedFilter && selectedFilter.type !== 'all' && selectedFilter.type !== 'documents') {
        if (selectedFilter.type === 'class') params.append('class_id', selectedFilter.id);
        if (selectedFilter.type === 'semester') params.append('semester_id', selectedFilter.id);
        if (selectedFilter.type === 'subject') params.append('subject_id', selectedFilter.id);
      }

      const res = await fetch(apiUrl(`/api/document-folders/tree?${params.toString()}`));
      const data = await res.json();
      const tree = data.folders || [];
      setFolderTree(tree);

      // Keep folders closed by default on initial load
      setExpandedFolders(prev => prev);
    } catch (err) {
      console.error('Lỗi tải cây thư mục:', err);
    } finally {
      setLoadingTree(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. Fetch Breadcrumbs
  // --------------------------------------------------------------------------
  const updateBreadcrumbs = async (folderId) => {
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Tất cả tài liệu' }]);
      return;
    }
    if (folderId === 'root' || folderId === '') {
      setBreadcrumbs([{ id: 'root', name: 'Thư mục gốc' }]);
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/document-folders/breadcrumbs/${folderId}`));
      const data = await res.json();
      setBreadcrumbs(data.breadcrumbs || []);
    } catch (err) {
      console.error('Lỗi tải breadcrumbs:', err);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Fetch Documents
  // --------------------------------------------------------------------------
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedFilter && selectedFilter.type !== 'all' && selectedFilter.type !== 'documents') {
        if (selectedFilter.type === 'class') params.append('class_id', selectedFilter.id);
        if (selectedFilter.type === 'semester') params.append('semester_id', selectedFilter.id);
        if (selectedFilter.type === 'subject') params.append('subject_id', selectedFilter.id);
      }

      // Folder filtering
      if (currentFolderId !== null) {
        params.append('folder_id', currentFolderId);
      }

      const activeSearch = searchQuery || localSearch;
      if (activeSearch) params.append('search', activeSearch);
      if (selectedType !== 'all') params.append('file_type', selectedType);

      const res = await fetch(apiUrl(`/api/documents?${params.toString()}`));
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách tài liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial and reactive effects
  useEffect(() => {
    fetchFolderTree();
  }, [selectedFilter, refreshTrigger]);

  useEffect(() => {
    updateBreadcrumbs(currentFolderId);
    fetchDocuments();
  }, [currentFolderId, selectedFilter, searchQuery, selectedType, refreshTrigger]);

  // --------------------------------------------------------------------------
  // Helper to find folder in tree
  // --------------------------------------------------------------------------
  const findFolderInTree = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findFolderInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Direct subfolders of the current view
  const currentSubfolders = useMemo(() => {
    if (currentFolderId === null || currentFolderId === 'root') {
      return folderTree;
    }
    const currentFolder = findFolderInTree(folderTree, currentFolderId);
    return currentFolder ? currentFolder.children || [] : [];
  }, [folderTree, currentFolderId]);

  // Active folder name
  const currentFolderName = useMemo(() => {
    if (currentFolderId === null) return 'Tất cả tài liệu';
    if (currentFolderId === 'root') return 'Thư mục gốc';
    const folder = findFolderInTree(folderTree, currentFolderId);
    return folder ? folder.name : 'Thư mục';
  }, [folderTree, currentFolderId]);

  // --------------------------------------------------------------------------
  // Toggle tree node expand/collapse
  // --------------------------------------------------------------------------
  const toggleExpand = (folderId, e) => {
    if (e) e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // --------------------------------------------------------------------------
  // Folder CRUD Handlers
  // --------------------------------------------------------------------------
  const openCreateFolderModal = (parentId = '') => {
    let parentName = 'Thư mục gốc';
    if (parentId && parentId !== 'root') {
      const parent = findFolderInTree(folderTree, parentId);
      if (parent) parentName = parent.name;
    }
    setModalState({
      type: 'create',
      parentId: parentId === 'root' ? '' : parentId,
      parentName
    });
    setModalInputName('');
  };

  const openRenameFolderModal = (folder) => {
    setModalState({
      type: 'rename',
      folderId: folder.id,
      currentName: folder.name
    });
    setModalInputName(folder.name);
  };

  const openDeleteFolderModal = (folder) => {
    setModalState({
      type: 'delete',
      folderId: folder.id,
      folderName: folder.name,
      docCount: folder.doc_count || 0
    });
  };

  const handleModalSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!modalState) return;

    try {
      if (modalState.type === 'create') {
        const trimmed = modalInputName.trim();
        if (!trimmed) {
          alert('Vui lòng nhập tên thư mục');
          return;
        }

        const payload = {
          name: trimmed,
          parent_id: modalState.parentId || '',
          subject_id: selectedFilter?.type === 'subject' ? selectedFilter.id : '',
          semester_id: selectedFilter?.type === 'semester' ? selectedFilter.id : '',
          class_id: selectedFilter?.type === 'class' ? selectedFilter.id : ''
        };

        const res = await fetch(apiUrl('/api/document-folders'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail;
          const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : (detail ? JSON.stringify(detail) : 'Lỗi tạo thư mục'));
          throw new Error(msg);
        }

        showToast(`Đã tạo thư mục "${data.folder.name}" thành công!`);
        if (modalState.parentId) {
          setExpandedFolders(prev => ({ ...prev, [modalState.parentId]: true }));
        }
        await fetchFolderTree();
        onTreeUpdated?.();
      } else if (modalState.type === 'rename') {
        const trimmed = modalInputName.trim();
        if (!trimmed) {
          alert('Tên thư mục không được để trống');
          return;
        }

        const res = await fetch(apiUrl(`/api/document-folders/${modalState.folderId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail;
          const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : (detail ? JSON.stringify(detail) : 'Lỗi đổi tên thư mục'));
          throw new Error(msg);
        }

        showToast(`Đã đổi tên thành "${data.folder.name}"!`);
        await fetchFolderTree();
        updateBreadcrumbs(currentFolderId);
        onTreeUpdated?.();
      } else if (modalState.type === 'delete') {
        const res = await fetch(apiUrl(`/api/document-folders/${modalState.folderId}`), {
          method: 'DELETE'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail;
          const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : (detail ? JSON.stringify(detail) : 'Lỗi xóa thư mục'));
          throw new Error(msg);
        }

        showToast('Đã xóa thư mục và các tệp bên trong thành công!');
        if (currentFolderId === modalState.folderId) {
          setCurrentFolderId(null);
        }
        await fetchFolderTree();
        await fetchDocuments();
        onTreeUpdated?.();
      }
    } catch (err) {
      const displayMsg = err.message === 'Failed to fetch'
        ? 'Không thể kết nối đến máy chủ backend (Failed to fetch). Vui lòng kiểm tra lại dịch vụ backend hoặc thử lại.'
        : err.message;
      alert(displayMsg);
    } finally {
      setModalState(null);
      setModalInputName('');
    }
  };

  // --------------------------------------------------------------------------
  // File Upload Handlers (with folder_id support)
  // --------------------------------------------------------------------------
  const handleUploadFiles = async (fileList, isFolder = false) => {
    if (!fileList || fileList.length === 0) return;

    // Filter valid files: .docx, .doc, .pdf
    const validFiles = Array.from(fileList).filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return ['.docx', '.doc', '.pdf'].includes(ext);
    });

    if (validFiles.length === 0) {
      alert('Không tìm thấy file hợp lệ (.docx, .doc, .pdf) để tải lên.');
      return;
    }

    try {
      setUploading(true);
      setUploadStats({ current: 0, total: validFiles.length });

      const targetFolder = currentFolderId && currentFolderId !== 'root' ? currentFolderId : '';
      const CHUNK_SIZE = 8;
      let totalImported = 0;
      let uploadErrors = [];

      for (let i = 0; i < validFiles.length; i += CHUNK_SIZE) {
        const chunk = validFiles.slice(i, i + CHUNK_SIZE);
        const formData = new FormData();
        const relativePaths = [];

        chunk.forEach(f => {
          formData.append('files', f);
          relativePaths.push(f.webkitRelativePath || '');
        });

        formData.append('folder_paths', JSON.stringify(relativePaths));
        if (targetFolder) {
          formData.append('folder_id', targetFolder);
        }

        // Append filter context if selected
        if (selectedFilter) {
          if (selectedFilter.type === 'class') formData.append('class_id', selectedFilter.id);
          if (selectedFilter.type === 'semester') formData.append('semester_id', selectedFilter.id);
          if (selectedFilter.type === 'subject') formData.append('subject_id', selectedFilter.id);
        }

        const res = await fetch(apiUrl('/api/documents/upload'), {
          method: 'POST',
          body: formData
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail;
          const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : (detail ? JSON.stringify(detail) : 'Lỗi tải lên tài liệu'));
          throw new Error(msg);
        }

        totalImported += (data.count || 0);
        if (data.errors && data.errors.length > 0) {
          uploadErrors = uploadErrors.concat(data.errors);
        }

        setUploadStats({ current: Math.min(i + CHUNK_SIZE, validFiles.length), total: validFiles.length });
      }

      let toastMsg = `Đã import thành công ${totalImported} tài liệu!`;
      if (uploadErrors.length > 0) {
        toastMsg += ` (${uploadErrors.length} file bị bỏ qua do lỗi)`;
      }
      showToast(toastMsg);
      await fetchFolderTree();
      await fetchDocuments();
      onTreeUpdated?.();
    } catch (err) {
      const displayMsg = err.message === 'Failed to fetch'
        ? 'Không thể kết nối đến máy chủ backend (Failed to fetch). Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.'
        : err.message;
      alert('Lỗi tải tài liệu: ' + displayMsg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const getCleanFileName = (name) => {
    if (!name) return '';
    return name.replace(/\\/g, '/').split('/').pop();
  };

  const handleDeleteDoc = async (doc) => {
    const displayName = getCleanFileName(doc.title || doc.filename);
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${displayName}"?`)) return;
    try {
      const res = await fetch(apiUrl(`/api/documents/${doc.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Không thể xóa tài liệu');
      showToast('Đã xóa tài liệu thành công');
      await fetchDocuments();
      await fetchFolderTree();
      onTreeUpdated?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartRenameDoc = (doc) => {
    setEditingDocId(doc.id);
    setEditingTitle(getCleanFileName(doc.title || doc.filename));
  };

  const handleSaveRenameDoc = async (docId) => {
    const cleanTitle = getCleanFileName(editingTitle.trim());
    if (!cleanTitle) return;
    try {
      const res = await fetch(apiUrl(`/api/documents/${docId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle })
      });
      if (!res.ok) throw new Error('Lỗi đổi tên');
      setEditingDocId(null);
      fetchDocuments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConvertToQuiz = async (doc) => {
    if (doc.file_type !== 'docx') {
      alert('Chỉ hỗ trợ bóc tách trắc nghiệm từ file Word (.docx)');
      return;
    }
    try {
      setConvertingDocId(doc.id);
      const res = await fetch(apiUrl(`/api/documents/${doc.id}/create-quiz`), {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi tạo đề thi từ tài liệu');

      showToast(`Đã tạo thành công bài thi "${data.quiz?.title}"!`);
      onTreeUpdated?.();
      onConvertDocToQuiz?.(data.quiz);
    } catch (err) {
      alert(err.message);
    } finally {
      setConvertingDocId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Filtered documents by search
  const displayedDocs = documents.filter(doc => {
    if (!localSearch) return true;
    const term = localSearch.toLowerCase();
    return (
      (doc.title && doc.title.toLowerCase().includes(term)) ||
      (doc.filename && doc.filename.toLowerCase().includes(term)) ||
      (doc.folder_path && doc.folder_path.toLowerCase().includes(term))
    );
  });

  // --------------------------------------------------------------------------
  // Recursive Folder Tree Node Component
  // --------------------------------------------------------------------------
  const renderTreeNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedFolders[node.id];
    const isSelected = currentFolderId === node.id;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => setCurrentFolderId(node.id)}
          className={`doc-folder-item ${isSelected ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.5rem',
            paddingLeft: `${8 + level * 14}px`,
            borderRadius: '6px',
            cursor: 'pointer',
            background: isSelected ? '#f4f4f5' : 'transparent',
            border: isSelected ? '1px solid #eeeeee' : '1px solid transparent',
            color: '#333333',
            fontSize: '0.825rem',
            fontWeight: 400,
            transition: 'background 0.15s ease',
            position: 'relative',
            userSelect: 'none'
          }}
          title={node.name}
        >
          {/* Expand/Collapse Chevron */}
          <button
            type="button"
            onClick={(e) => toggleExpand(node.id, e)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              visibility: hasChildren ? 'visible' : 'hidden',
              color: '#666666'
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Folder Icon */}
          <Folders size={15} style={{ color: '#333333', flexShrink: 0 }} />

          {/* Folder Name */}
          <span style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {node.name}
          </span>

          {/* Document count badge */}
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 400,
            color: '#666666',
            background: '#ffffff',
            border: '1px solid #eeeeee',
            padding: '1px 6px',
            borderRadius: '4px',
            flexShrink: 0
          }}>
            {node.doc_count || 0}
          </span>

          {/* Hover Actions */}
          <div
            className="doc-folder-actions"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'none', alignItems: 'center', gap: '2px' }}
          >
            <button
              type="button"
              onClick={() => openCreateFolderModal(node.id)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '2px 4px', height: '20px', minWidth: '20px' }}
              title="Thêm thư mục con"
            >
              <Plus size={11} />
            </button>
            <button
              type="button"
              onClick={() => openRenameFolderModal(node)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '2px 4px', height: '20px', minWidth: '20px' }}
              title="Đổi tên"
            >
              <Edit3 size={11} />
            </button>
            <button
              type="button"
              onClick={() => openDeleteFolderModal(node)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '2px 4px', height: '20px', minWidth: '20px' }}
              title="Xóa thư mục"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Nested Children */}
        {hasChildren && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#ffffff',
          color: '#333333',
          border: '1px solid #eeeeee',
          borderRadius: '8px',
          padding: '0.85rem 1.4rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 400
        }}>
          <Check size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".docx,.doc,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleUploadFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleUploadFiles(e.target.files, true)}
      />

      {/* Top Header Bar */}
      <div className="card" style={{
        padding: '1.15rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        border: '1px solid #eeeeee',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 400, color: '#333333' }}>
              Kho tài liệu học tập
            </span>
            <span className="badge">
              {documents.length} tài liệu
            </span>
          </div>

          {/* Breadcrumb Path */}
          <div style={{ fontSize: '0.8rem', color: '#666666', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span
              onClick={() => setCurrentFolderId(null)}
              style={{ cursor: 'pointer', color: currentFolderId === null ? '#333333' : '#666666', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Folders size={15} style={{ color: '#333333' }} />
              <span>Tài liệu</span>
            </span>
            {selectedFilter?.path?.length > 0 && selectedFilter.path.map((segment, idx) => (
              <React.Fragment key={`filter_${idx}`}>
                <span>›</span>
                <span style={{ fontWeight: 400, color: '#333333', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Folders size={13} style={{ color: '#555555' }} />
                  <span>{segment}</span>
                </span>
              </React.Fragment>
            ))}
            {breadcrumbs.length > 0 && breadcrumbs.map((crumb, idx) => (
              crumb.name !== 'Tất cả tài liệu' && (
                <React.Fragment key={`crumb_${idx}`}>
                  <span>›</span>
                  <span
                    onClick={() => setCurrentFolderId(crumb.id)}
                    style={{
                      cursor: 'pointer',
                      fontWeight: 400,
                      color: idx === breadcrumbs.length - 1 ? '#333333' : '#666666',
                      textDecoration: idx === breadcrumbs.length - 1 ? 'none' : 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Folders size={13} style={{ color: '#555555' }} />
                    <span>{crumb.name}</span>
                  </span>
                </React.Fragment>
              )
            ))}
            {selectedFilter?.type !== 'all' && selectedFilter?.type !== 'documents' && (
              <button
                type="button"
                onClick={onClearFilter}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666666',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.78rem',
                  marginLeft: '0.5rem'
                }}
              >
                (Xem tất cả)
              </button>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openCreateFolderModal(currentFolderId || '')}
            style={{
              padding: '0.55rem 0.95rem',
              fontSize: '0.825rem',
              fontWeight: 400,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title={currentFolderId ? `Tạo thư mục con trong "${currentFolderName}"` : 'Tạo thư mục mới'}
          >
            <AddFolder size={16} />
            <span>{currentFolderId && currentFolderId !== 'root' ? '+ Thư mục con' : '+ Thư mục mới'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.825rem',
              fontWeight: 400,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Tải lên nguyên cả thư mục từ máy tính (tự động phân nhánh thư mục con)"
          >
            <Folders size={16} />
            <span>Tải cả thư mục</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.825rem',
              fontWeight: 400,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Chọn nhiều file Word và PDF để tải lên cùng lúc"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Đang tải lên...</span>
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                <span>+ Tải lên file (.docx, .pdf)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animated Upload Progress Bar */}
      {uploading && (
        <div style={{ marginBottom: '1rem' }} className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.8rem', color: '#555555' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Loader2 size={14} className="spin" />
              <span>Đang tải lên tài liệu vào hệ thống...</span>
            </span>
            <span style={{ fontWeight: 400 }}>{uploadStats.current} / {uploadStats.total}</span>
          </div>
          <div className="indeterminate-progress-container">
            <div className="indeterminate-progress-bar" />
          </div>
        </div>
      )}

      {/* Main Dual-Pane Container: Left Folder Tree & Right Documents View */}
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* LEFT PANE: Folder Tree Explorer */}
        {!isTreeCollapsed && (
          <aside className="card" style={{
            width: '270px',
            flexShrink: 0,
            padding: '1rem',
            border: '1px solid #eeeeee',
            borderRadius: '8px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}>
            {/* Tree Pane Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #eeeeee'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Folders size={17} style={{ color: '#333333' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#333333' }}>
                  Thư mục tài liệu
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => openCreateFolderModal('')}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 6px', fontSize: '0.75rem', fontWeight: 400}}
                  title="Tạo thư mục mới ở gốc"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Tree Navigation Root Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Item: Tất cả tài liệu */}
              <div
                onClick={() => setCurrentFolderId(null)}
                className={`doc-folder-item ${currentFolderId === null ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: currentFolderId === null ? '#f4f4f5' : 'transparent',
                  border: currentFolderId === null ? '1px solid #eeeeee' : '1px solid transparent',
                  color: '#333333',
                  fontSize: '0.825rem',
                  fontWeight: 400
                }}
              >
                <FileText size={15} />
                <span style={{ flex: 1 }}>Tất cả tài liệu</span>
              </div>

              {/* Item: Thư mục gốc */}
              <div
                onClick={() => setCurrentFolderId('root')}
                className={`doc-folder-item ${currentFolderId === 'root' ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: currentFolderId === 'root' ? '#f4f4f5' : 'transparent',
                  border: currentFolderId === 'root' ? '1px solid #eeeeee' : '1px solid transparent',
                  color: '#333333',
                  fontSize: '0.825rem',
                  fontWeight: 400
                }}
              >
                <Home size={15} />
                <span style={{ flex: 1 }}>Thư mục gốc</span>
              </div>
            </div>

            {/* Recursive Folder Tree List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 280px)',
              paddingTop: '0.35rem',
              borderTop: '1px solid #eeeeee'
            }}>
              {loadingTree ? (
                <div style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="skeleton" style={{ width: '85%', height: '24px' }} />
                  <div className="skeleton" style={{ width: '70%', height: '22px', marginLeft: '12px' }} />
                  <div className="skeleton" style={{ width: '78%', height: '22px', marginLeft: '12px' }} />
                  <div className="skeleton" style={{ width: '88%', height: '24px' }} />
                </div>
              ) : folderTree.length === 0 ? (
                <div style={{ padding: '1rem 0.5rem', textAlign: 'center', color: '#888888', fontSize: '0.78rem' }}>
                  <span>Chưa có thư mục nào. Bấm nút "+" ở trên để tạo thư mục.</span>
                </div>
              ) : (
                folderTree.map(node => renderTreeNode(node, 0))
              )}
            </div>
          </aside>
        )}

        {/* RIGHT PANE: Explorer / Content Area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Toggle tree button & Current folder status banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsTreeCollapsed(prev => !prev)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                title={isTreeCollapsed ? 'Mở thanh cây thư mục' : 'Thu gọn thanh cây thư mục'}
              >
                <Folders size={13} />
                <span>{isTreeCollapsed ? 'Hiện thư mục' : 'Ẩn thư mục'}</span>
              </button>

              <span style={{ fontSize: '0.95rem', fontWeight: 400, color: '#333333' }}>
                {currentFolderName}
              </span>

              {currentFolderId && currentFolderId !== 'root' && (
                <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const f = findFolderInTree(folderTree, currentFolderId);
                      if (f) openRenameFolderModal(f);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                    title="Đổi tên thư mục hiện tại"
                  >
                    <Edit3 size={12} /> Sửa tên
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const f = findFolderInTree(folderTree, currentFolderId);
                      if (f) openDeleteFolderModal(f);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                    title="Xóa thư mục hiện tại"
                  >
                    <Trash2 size={12} /> Xóa
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SUBFOLDERS ROW / GRID (Explorer Cards) */}
          {currentSubfolders.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              background: '#ffffff',
              border: '1px solid #eeeeee',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#555555', textTransform: 'uppercase' }}>
                  Thư mục con ({currentSubfolders.length})
                </span>
                <button
                  type="button"
                  onClick={() => openCreateFolderModal(currentFolderId || '')}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.75rem', fontWeight: 400}}
                >
                  <Plus size={11} /> Thêm thư mục
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.65rem'
              }}>
                {currentSubfolders.map(sub => (
                  <div
                    key={sub.id}
                    onClick={() => setCurrentFolderId(sub.id)}
                    className="doc-folder-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.85rem',
                      border: '1px solid #eeeeee',
                      borderRadius: '6px',
                      background: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    title={`Mở thư mục "${sub.name}" (${sub.doc_count || 0} tài liệu)`}
                  >
                    <Folders size={20} style={{ color: '#333333', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 400,
                        color: '#333333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {sub.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#666666' }}>
                        {sub.doc_count || 0} tài liệu
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div
                      className="folder-card-actions"
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'none', alignItems: 'center', gap: '2px' }}
                    >
                      <button
                        type="button"
                        onClick={() => openRenameFolderModal(sub)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 5px' }}
                        title="Đổi tên"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteFolderModal(sub)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 5px' }}
                        title="Xóa thư mục"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drag & Drop Hero Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: dragOver ? '2px dashed #999999' : '1px dashed #dddddd',
              borderRadius: '8px',
              background: dragOver ? '#fbfbfb' : '#ffffff',
              padding: '1.1rem',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#555555' }}>
              <UploadCloud size={19} />
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#333333' }}>
                Kéo thả file hoặc thư mục Word (.docx, .doc), PDF (.pdf) vào "{currentFolderName}"
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#666666' }}>
              Hỗ trợ import siêu tốc hàng chục file cùng lúc, tự động lưu trữ và đồng bộ
            </span>
          </div>

          {/* Filter and Search Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            {/* Type Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {[
                { id: 'all', label: 'Tất cả', icon: <Folders size={13} style={{ color: '#333333' }} /> },
                { id: 'docx', label: 'Word (.docx, .doc)', icon: <FileText size={13} style={{ color: '#333333' }} /> },
                { id: 'pdf', label: 'PDF (.pdf)', icon: <FileText size={13} style={{ color: '#333333' }} /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 400,
                    borderRadius: '6px',
                    background: selectedType === tab.id ? '#f4f4f5' : '#ffffff',
                    color: '#333333',
                    border: '1px solid #eeeeee',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Search & View Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="text"
                placeholder="Tìm theo tên file..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.825rem',
                  border: '1px solid #eeeeee',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#333333',
                  outline: 'none',
                  width: '220px'
                }}
              />

              <div style={{ display: 'flex', border: '1px solid #eeeeee', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    background: viewMode === 'grid' ? '#f4f4f5' : '#ffffff',
                    border: 'none',
                    color: '#333333',
                    cursor: 'pointer'
                  }}
                  title="Xem dạng thẻ"
                >
                  Lưới
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    background: viewMode === 'table' ? '#f4f4f5' : '#ffffff',
                    border: 'none',
                    borderLeft: '1px solid #eeeeee',
                    color: '#333333',
                    cursor: 'pointer'
                  }}
                  title="Xem dạng bảng"
                >
                  Bảng
                </button>
              </div>
            </div>
          </div>

          {/* Main Document Content */}
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem'
            }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="card" style={{ padding: '1rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div className="skeleton" style={{ width: '38px', height: '22px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '85%', height: '16px', borderRadius: '4px', marginBottom: '0.5rem' }} />
                  <div className="skeleton" style={{ width: '60%', height: '14px', borderRadius: '4px', marginBottom: '1rem' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.65rem', borderTop: '1px solid #eeeeee' }}>
                    <div className="skeleton" style={{ width: '70px', height: '12px', borderRadius: '4px' }} />
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <div className="skeleton" style={{ width: '28px', height: '24px', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ width: '28px', height: '24px', borderRadius: '4px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : displayedDocs.length === 0 ? (
            <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
              <FileText size={36} style={{ color: '#888888', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 400, color: '#333333', marginBottom: '0.35rem' }}>
                Chưa có tài liệu nào trong thư mục này
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#666666', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                Hãy bấm nút "Tải lên file" hoặc kéo thả file Word, PDF vào đây để lưu trữ tài liệu.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderRadius: '6px', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
              >
                <Plus size={14} /> Thêm tài liệu vào đây
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="animate-fade-in" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem'
            }}>
              {displayedDocs.map(doc => {
                const isWord = doc.file_type === 'docx' || doc.file_type === 'doc';
                const isPdf = doc.file_type === 'pdf';
                const isEditing = editingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="card doc-card"
                    style={{
                      padding: '1rem',
                      border: '1px solid #eeeeee',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      background: '#ffffff',
                      position: 'relative'
                    }}
                  >
                    {/* Card Top: Type Badge & Size */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 400,
                        textTransform: 'uppercase',
                        border: '1px solid #eeeeee',
                        background: '#ffffff',
                        color: '#333333'
                      }}>
                        {doc.file_type}
                      </span>

                      <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 400}}>
                        {formatFileSize(doc.file_size)}
                      </span>
                    </div>

                    {/* Card Title */}
                    <div>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            style={{
                              flex: 1,
                              fontSize: '0.85rem',
                              padding: '0.3rem 0.5rem',
                              borderRadius: '4px',
                              border: '1px solid #eeeeee',
                              background: '#ffffff',
                              color: '#333333'
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRenameDoc(doc.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px' }}
                            title="Lưu tên"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDocId(null)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px' }}
                            title="Hủy"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDoubleClick={() => handleStartRenameDoc(doc)}
                          title={`${getCleanFileName(doc.title || doc.filename)} (Nháy đúp để đổi tên)`}
                          style={{
                            fontSize: '0.885rem',
                            fontWeight: 400,
                            color: '#333333',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            cursor: 'pointer'
                          }}
                        >
                          {getCleanFileName(doc.title || doc.filename)}
                        </div>
                      )}

                      {doc.folder_path && (
                        <div style={{ fontSize: '0.72rem', color: '#666666', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Folders size={12} style={{ color: '#666666', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.folder_path}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Metadata & Buttons */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid #eeeeee',
                      marginTop: 'auto',
                      gap: '0.4rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontSize: '0.72rem', color: '#666666', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={11} />
                        <span>{formatDate(doc.created_at)}</span>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                        {/* Convert Word to Quiz button */}
                        {isWord && doc.file_type === 'docx' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={convertingDocId === doc.id}
                            onClick={() => handleConvertToQuiz(doc)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 400}}
                            title="Tự động bóc tách câu hỏi và highlight để tạo bài thi trắc nghiệm"
                          >
                            {convertingDocId === doc.id ? (
                              <Loader2 size={12} className="spin" />
                            ) : (
                              <>
                                <Play size={11} /> Tạo đề thi
                              </>
                            )}
                          </button>
                        )}

                        {/* Preview (for PDF) */}
                        {isPdf && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPreviewDoc(doc)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Xem tài liệu trực tiếp trong trình duyệt"
                          >
                            Xem
                          </button>
                        )}

                        {/* Download */}
                        <a
                          href={apiUrl(`/api/documents/${doc.id}/download`)}
                          download={getCleanFileName(doc.filename)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', textDecoration: 'none' }}
                          title="Tải về máy tính"
                        >
                          <Download size={12} />
                        </a>

                        {/* Rename */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartRenameDoc(doc)}
                          style={{ padding: '4px 6px' }}
                          title="Đổi tên"
                        >
                          <Edit3 size={12} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteDoc(doc)}
                          style={{ padding: '4px 6px' }}
                          title="Xóa tài liệu"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="card animate-fade-in" style={{ border: '1px solid #eeeeee', borderRadius: '8px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#fcfcfc', borderBottom: '1px solid #eeeeee', textAlign: 'left', color: '#555555' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '70px' }}>Định dạng</th>
                    <th style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={13} style={{ color: '#555555' }} />
                        <span>Tên tài liệu</span>
                      </span>
                    </th>
                    <th style={{ padding: '0.75rem 1rem', width: '160px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Folders size={13} style={{ color: '#555555' }} />
                        <span>Đường dẫn</span>
                      </span>
                    </th>
                    <th style={{ padding: '0.75rem 1rem', width: '100px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} style={{ color: '#555555' }} />
                        <span>Dung lượng</span>
                      </span>
                    </th>
                    <th style={{ padding: '0.75rem 1rem', width: '110px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} style={{ color: '#555555' }} />
                        <span>Ngày tải</span>
                      </span>
                    </th>
                    <th style={{ padding: '0.75rem 1rem', width: '180px', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDocs.map(doc => {
                    const isWord = doc.file_type === 'docx' || doc.file_type === 'doc';
                    const isPdf = doc.file_type === 'pdf';
                    const isEditing = editingDocId === doc.id;

                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid #eeeeee' }}>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 400,
                            border: '1px solid #eeeeee',
                            background: '#ffffff',
                            color: '#333333',
                            textTransform: 'uppercase'
                          }}>
                            {doc.file_type}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 400, color: '#333333' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenameDoc(doc.id);
                                  if (e.key === 'Escape') setEditingDocId(null);
                                }}
                                style={{
                                  fontSize: '0.85rem',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #eeeeee',
                                  background: '#ffffff',
                                  color: '#333333',
                                  minWidth: '180px',
                                  maxWidth: '300px'
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRenameDoc(doc.id)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px' }}
                                title="Lưu tên"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDocId(null)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px' }}
                                title="Hủy"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <span
                              onDoubleClick={() => handleStartRenameDoc(doc)}
                              style={{ cursor: 'pointer' }}
                              title="Nháy đúp để đổi tên"
                            >
                              {getCleanFileName(doc.title || doc.filename)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#666666', fontSize: '0.8rem' }}>
                          {doc.folder_path ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Folders size={12} style={{ color: '#666666', flexShrink: 0 }} />
                              <span>{doc.folder_path}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#555555' }}>
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#666666', fontSize: '0.8rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} style={{ color: '#666666' }} />
                            <span>{formatDate(doc.created_at)}</span>
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            {isWord && doc.file_type === 'docx' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={convertingDocId === doc.id}
                                onClick={() => handleConvertToQuiz(doc)}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                title="Tạo bài thi trắc nghiệm"
                              >
                                <Play size={11} /> Tạo đề
                              </button>
                            )}
                            {isPdf && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPreviewDoc(doc)}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                title="Xem trước"
                              >
                                Xem
                              </button>
                            )}
                            <a
                              href={apiUrl(`/api/documents/${doc.id}/download`)}
                              download={getCleanFileName(doc.filename)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 6px' }}
                              title="Tải về"
                            >
                              <Download size={12} />
                            </a>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => isEditing ? handleSaveRenameDoc(doc.id) : handleStartRenameDoc(doc)}
                              style={{ padding: '3px 6px' }}
                              title={isEditing ? "Lưu tên" : "Đổi tên"}
                            >
                              {isEditing ? <Check size={12} /> : <Edit3 size={12} />}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeleteDoc(doc)}
                              style={{ padding: '3px 6px' }}
                              title="Xóa"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PDF VIEWER MODAL */}
      {previewDoc && (
        <div className="modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '1000px',
              width: '95vw',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              border: '1px solid #eeeeee',
              borderRadius: '8px'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #eeeeee'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  border: '1px solid #eeeeee',
                  background: '#ffffff',
                  color: '#333333'
                }}>
                  PDF
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 400, color: '#333333' }}>
                  {getCleanFileName(previewDoc.title || previewDoc.filename)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a
                  href={apiUrl(`/api/documents/${previewDoc.id}/download`)}
                  download={getCleanFileName(previewDoc.filename)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <Download size={14} /> Tải về
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPreviewDoc(null)}
                  style={{ padding: '4px 8px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF iframe */}
            <div style={{ flex: 1, position: 'relative', background: '#f4f4f5', borderRadius: '6px', overflow: 'hidden' }}>
              <iframe
                src={apiUrl(`/api/documents/${previewDoc.id}/view`)}
                title={getCleanFileName(previewDoc.title)}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* FOLDER CRUD MODAL (Create, Rename, Delete) */}
      {modalState && (
        <div className="modal-backdrop" onClick={() => setModalState(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '90vw',
              padding: '1.5rem',
              border: '1px solid #eeeeee',
              borderRadius: '8px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eeeeee', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Folders size={20} style={{ color: '#333333' }} />
                <span style={{ fontSize: '1rem', fontWeight: 400, color: '#333333' }}>
                  {modalState.type === 'create'
                    ? (modalState.parentId ? `Tạo thư mục con` : 'Tạo thư mục mới')
                    : modalState.type === 'rename'
                      ? 'Đổi tên thư mục'
                      : 'Xác nhận xóa thư mục'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 6px' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            {modalState.type === 'delete' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#333333', lineHeight: 1.5, margin: 0 }}>
                  Bạn có chắc chắn muốn xóa thư mục <strong>"{modalState.folderName}"</strong>?
                </p>
                <p style={{ fontSize: '0.825rem', color: '#666666', lineHeight: 1.4, margin: 0 }}>
                  Toàn bộ thư mục con và các tệp tài liệu ({modalState.docCount} tệp) nằm bên trong thư mục này cũng sẽ bị xóa vĩnh viễn khỏi hệ thống.
                </p>
              </div>
            ) : (
              <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {modalState.type === 'create' && modalState.parentName && (
                  <div style={{ fontSize: '0.8rem', color: '#666666' }}>
                    Nằm trong: <strong>{modalState.parentName}</strong>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, color: '#333333', marginBottom: '0.35rem' }}>
                    Tên thư mục:
                  </label>
                  <input
                    type="text"
                    value={modalInputName}
                    onChange={(e) => setModalInputName(e.target.value)}
                    placeholder="Ví dụ: Chương 1 - Hàm số, Giáo trình giải tích..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.875rem',
                      border: '1px solid #eeeeee',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#333333',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </form>
            )}

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              borderTop: '1px solid #eeeeee',
              paddingTop: '0.85rem'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalState(null)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleModalSubmit}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.825rem', fontWeight: 400}}
              >
                {modalState.type === 'create'
                  ? 'Tạo thư mục'
                  : modalState.type === 'rename'
                    ? 'Lưu thay đổi'
                    : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline styles for hover state of folder items */}
      <style>{`
        .doc-folder-item:hover {
          background: #f4f4f5 !important;
        }
        .doc-folder-item:hover .doc-folder-actions {
          display: flex !important;
        }
        .doc-folder-card:hover {
          border-color: #cccccc !important;
          background: #fafafa !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .doc-folder-card:hover .folder-card-actions {
          display: flex !important;
        }
      `}</style>
    </div>
  );
}
