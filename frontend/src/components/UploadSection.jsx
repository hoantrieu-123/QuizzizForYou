import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, Sparkles, AlertCircle, Download } from './UIcons';


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
      setErrorMsg('Vui lòng chọn file Word có phần mở rộng định dạng .docx');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
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
      const res = await fetch('/api/sample-file');
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
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
          Tải lên file Word (.docx) chứa câu hỏi
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto' }}>
          Hệ thống đọc trực tiếp mã XML <code style={{ background: '#f5f3ff', padding: '2px 6px', borderRadius: '4px', color: '#7c3aed', border: '1px solid #ddd6fe' }}>&lt;w:highlight&gt;</code> để xác định chính xác đáp án đúng (vàng, xanh lá, cyan...) và tự động phân loại 6 dạng câu hỏi.
        </p>
      </div>

      <div
        className={`dropzone ${isDragging ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".docx"
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
            <Loader2 size={46} className="spin-animate" style={{ color: '#7c3aed' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
              Đang phân tích cấu trúc Word & thẻ XML Highlight...
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Bóc tách các đoạn văn, bảng biểu 2x2, run-level formatting và phát hiện 6 dạng câu hỏi.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7c3aed',
              marginBottom: '0.25rem'
            }}>
              <UploadCloud size={34} />
            </div>
            <div>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Kéo thả file <span style={{ color: '#7c3aed' }}>.docx</span> vào đây, hoặc <span style={{ color: '#7c3aed', textDecoration: 'underline' }}>bấm để chọn file</span>
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Hỗ trợ file Word câu hỏi đơn, câu hỏi chùm, bảng biểu và bôi màu Highlight
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          marginTop: '1.25rem',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '1.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid #e2e8f0',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>Hỗ trợ nhận diện:</span>
          <span className="badge badge-neutral">1. Chọn 1 đáp án</span>
          <span className="badge badge-neutral">2. Chọn nhiều đáp án</span>
          <span className="badge badge-neutral">3. Đúng / Sai</span>
          <span className="badge badge-neutral">4. Điền từ</span>
          <span className="badge badge-neutral">5. Kéo thả vào ô trống</span>
          <span className="badge badge-neutral">6. Ghép đôi (Matching)</span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <a
            href="/api/sample-file"
            download="Mau_De_Thi_Tat_Ca_Dinh_Dang.docx"
            className="btn btn-secondary"
            style={{
              fontSize: '0.875rem',
              borderColor: '#cbd5e1',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 600
            }}
            title="Tải về máy tính file Word mẫu có đầy đủ tất cả định dạng câu hỏi và Highlight"
          >
            <Download size={16} style={{ color: '#7c3aed' }} /> Tải file Word mẫu (.docx)
          </a>

          <button
            className="btn btn-secondary"
            onClick={handleQuickTestSample}
            disabled={isUploading}
            style={{
              fontSize: '0.875rem',
              borderColor: '#ddd6fe',
              background: '#f5f3ff',
              color: '#7c3aed',
              fontWeight: 600
            }}
          > Thử ngay với file mẫu tích hợp
          </button>
        </div>
      </div>
    </div>
  );
}

