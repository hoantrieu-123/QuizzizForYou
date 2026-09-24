import React from 'react';
import { Download, Home } from './UIcons';
import { apiUrl } from '../apiConfig';

export default function Navbar({ currentView, onNavigate, searchQuery = '', onSearchChange }) {
  const handleDownloadSample = () => {
    window.location.href = apiUrl('/api/sample-file');
  };

  return (
    <header className="app-header">
      {/* Brand Logo - Minimalist Black & White */}
      <div className="brand-logo" onClick={() => onNavigate('home')} title="EduDocx - Về trang chủ">
        <svg viewBox="0 0 160 40" style={{ height: '32px', width: 'auto' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="36" height="36" rx="6" fill="#333333" stroke="#333333" strokeWidth="1.5" />
          <path d="M12 14h16M12 20h10M12 26h14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <text x="48" y="26" fontFamily="'Plus Jakarta Sans', system-ui, sans-serif" fontSize="18" fontWeight="800" fill="#333333">
            EduDocx
          </text>
        </svg>
      </div>

      {/* Global Search Bar */}
      {currentView === 'home' && (
        <div className="nav-search-box">
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', color: '#666666', fontSize: '18px', pointerEvents: 'none' }}>
            search
          </span>
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
                right: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#666666',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Xóa tìm kiếm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
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

        <div style={{ height: '20px', width: '1px', backgroundColor: '#eeeeee', margin: '0 4px' }}></div>

        {/* User Profile Pill */}
        <div className="user-profile-badge" title="Tài khoản">
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '4px',
            background: '#ffffff',
            color: '#333333',
            border: '1px solid #eeeeee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 400,
            fontSize: '0.75rem'
          }}>
            HT
          </div>
          <span style={{ fontSize: '0.825rem', fontWeight: 400, color: '#333333' }}>
            Hoàng Triều
          </span>
        </div>
      </div>
    </header>
  );
}
