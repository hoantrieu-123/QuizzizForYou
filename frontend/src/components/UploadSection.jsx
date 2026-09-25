import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, AlertCircle, Download, FileText } from './UIcons';
import { apiUrl } from '../apiConfig';

export default function UploadSection({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('Vui lòng chọn file Word định dạng .docx');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(apiUrl('/api/upload'), {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi phân tích file Word');
      }

      onUploadSuccess(data.quiz);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuickTestSample = async () => {
    setErrorMsg(null);
    setIsUploading(true);

    try {
      const res = await fetch(apiUrl('/api/sample-file'));
      if (!res.ok) throw new Error('Không thể tải file mẫu');
      const blob = await res.blob();
      const file = new File([blob], 'sample_quiz_highlighted.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await handleFileSelected(file);
    } catch (err) {
      setErrorMsg(err.message);
      setIsUploading(false);
    }
  };

  return (
    <section id="import-word-hero" className="card" style={{ marginBottom: '1.25rem' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".docx"
        style={{ display: 'none' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
        {/* Left Column: Heading, Subtitle & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 500,
            margin: 0,
            color: 'var(--text)',
            letterSpacing: '-0.02em'
          }}>
            Tạo bài trắc nghiệm từ file Word (.docx)
          </h2>

          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            Trích xuất câu hỏi, đáp án tự động chỉ trong vài giây
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <FileText size={16} />
              <span>Chọn file Word (.docx)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickTestSample}
              disabled={isUploading}
            >
              <span>Thử file mẫu</span>
            </button>

            <a
              href={apiUrl('/api/sample-file')}
              download="Mau_De_Thi.docx"
              style={{
                color: 'var(--text)',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                marginLeft: '4px',
                textDecoration: 'none'
              }}
            >
              <Download size={15} style={{ color: 'var(--text-secondary)' }} />
              <span>Tải file mẫu</span>
            </a>
          </div>
        </div>

        {/* Right Column: Sage Olive Dropzone with Circular Icon Box */}
        <div>
          <div
            className={`hero-dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 0', width: '100%', maxWidth: '240px', margin: '0 auto' }}>
                <Loader2 size={28} className="spin-animate" style={{ color: 'var(--primary)' }} />
                <div style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--text)' }}>
                  Đang bóc tách file Word...
                </div>
                <div className="indeterminate-progress-container" style={{ width: '100%' }}>
                  <div className="indeterminate-progress-bar" />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '2px'
                }}>
                  <UploadCloud size={24} />
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text)' }}>
                  Kéo thả file .docx vào đây
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  hoặc bấm để chọn file từ máy tính
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="animate-toast" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          background: 'var(--danger-light)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          marginTop: '1rem',
          fontSize: '0.85rem',
          fontWeight: 400
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </section>
  );
}
