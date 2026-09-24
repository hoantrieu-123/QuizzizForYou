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
        {/* Left Column: Heading & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 400,
            margin: 0,
            color: '#333333',
            letterSpacing: '-0.02em'
          }}>
            Tạo bài trắc nghiệm từ file Word (.docx)
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <UploadCloud size={16} />
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
                color: '#333333',
                fontSize: '0.85rem',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                marginLeft: '4px'
              }}
            >
              <Download size={14} />
              <span>Tải file mẫu</span>
            </a>
          </div>
        </div>

        {/* Right Column: Clean B&W Dropzone */}
        <div>
          <div
            className={`hero-dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 0' }}>
                <Loader2 size={32} className="spin-animate" style={{ color: '#333333' }} />
                <div style={{ fontWeight: 400, fontSize: '0.95rem' }}>
                  Đang bóc tách file Word...
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={30} style={{ color: '#333333' }} />
                <div style={{ fontWeight: 400, fontSize: '0.95rem', color: '#333333' }}>
                  Kéo thả file .docx vào đây
                </div>
                <div style={{ fontSize: '0.78rem', color: '#555555' }}>
                  hoặc bấm để chọn file từ máy tính
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '6px',
          background: '#ffffff',
          border: '1px solid #b91c1c',
          color: '#b91c1c',
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
