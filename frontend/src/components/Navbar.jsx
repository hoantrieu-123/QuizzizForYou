import React from 'react';
import { FileText, Download, Home } from './UIcons';

export default function Navbar({ currentView, onNavigate }) {
  const handleDownloadSample = () => {
    window.location.href = '/api/sample-file';
  };

  return (
    <header className="app-header">
      <div className="brand-logo" onClick={() => onNavigate('home')}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: '#7c3aed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)'
        }}>
          <FileText size={22} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            WordQuiz <span style={{ color: '#7c3aed' }}>Pro</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            Tạo đề thi từ Highlight Word (.docx)
          </span>
        </div>
        {/* <span className="brand-badge">XML Highlight Engine</span> */}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate('home')}
          style={{ fontSize: '0.875rem' }}
        >
          <Home size={16} /> Trang chủ
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleDownloadSample}
          style={{ fontSize: '0.875rem', borderColor: '#ddd6fe', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}
          title="Tải file Word mẫu gồm 6 dạng câu hỏi có Highlight"
        >
          <Download size={16} /> Tải file mẫu (.docx)
        </button>
      </div>
    </header>
  );
}

