import React from 'react';
import { Download, Home, Search, X, FileText } from './UIcons';
import { apiUrl } from '../apiConfig';

export default function Navbar({ currentView, onNavigate, searchQuery = '', onSearchChange }) {
  const handleDownloadSample = () => {
    window.location.href = apiUrl('/api/sample-file');
  };

  return (
    <header className="app-header">
      {/* Brand Logo - Sage Olive Modern */}
      <div className="brand-logo" onClick={() => onNavigate('home')} title="EduDocx - Về trang chủ">
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '7px',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          flexShrink: 0
        }}>
          <FileText size={18} color="#FFFFFF" strokeWidth={2} />
        </div>
        <span style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-heading)'
        }}>
          EduDocx
        </span>
      </div>

      {/* Global Search Bar */}
      {currentView === 'home' && (
        <div className="nav-search-box">
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="nav-search-input"
            type="text"
            placeholder="Tìm kiếm file Word, bài thi, câu hỏi..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
              title="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Action Buttons & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('home')}
          title="Trang chủ"
        >
          <Home size={15} /> Trang chủ
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleDownloadSample}
          title="Tải file Word mẫu"
        >
          <Download size={15} /> Tải file mẫu (.docx)
        </button>

        <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }}></div>

        {/* User Profile Pill */}
        <div className="user-profile-badge" title="Tài khoản">
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '5px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 500,
            fontSize: '0.75rem'
          }}>
            HT
          </div>
          <span style={{ fontSize: '0.825rem', fontWeight: 400, color: 'var(--text)' }}>
            Hoàng Triều
          </span>
        </div>
      </div>
    </header>
  );
}
