import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl } from '../apiConfig';
import { Globe, Activity, Shield, X, Search, RefreshCw, Trash2, Check, Copy } from './UIcons';

// Helper to format country flag and name
function formatCountry(countryCode, ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return { name: 'Máy nội bộ (Localhost)', flag: '🏠' };
  }
  if (!countryCode || countryCode === '') {
    return { name: 'Không xác định', flag: '🌐' };
  }

  const code = countryCode.toUpperCase();
  const flagMap = {
    VN: '🇻🇳', US: '🇺🇸', JP: '🇯🇵', KR: '🇰🇷', SG: '🇸🇬',
    TH: '🇹🇭', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', CN: '🇨🇳',
    AU: '🇦🇺', CA: '🇨🇦', IN: '🇮🇳', RU: '🇷🇺', TW: '🇹🇼'
  };

  const flag = flagMap[code] || '🌐';
  const nameMap = {
    VN: 'Việt Nam', US: 'Hoa Kỳ', JP: 'Nhật Bản', KR: 'Hàn Quốc',
    SG: 'Singapore', TH: 'Thái Lan', GB: 'Vương quốc Anh', DE: 'Đức',
    FR: 'Pháp', CN: 'Trung Quốc', AU: 'Úc', CA: 'Canada'
  };

  return { name: nameMap[code] || code, flag };
}

// Helper to simplify User-Agent string
function parseUserAgent(ua) {
  if (!ua) return 'Không rõ';
  const lower = ua.toLowerCase();
  let os = 'Thiết bị khác';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  let browser = '';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('coccoc')) browser = 'Cốc Cốc';

  return browser ? `${os} · ${browser}` : os;
}

// Format timestamp to Vietnamese locale
function formatDateTime(isoOrSqliteStr) {
  if (!isoOrSqliteStr) return '';
  try {
    const d = new Date(isoOrSqliteStr.replace(' ', 'T') + (isoOrSqliteStr.includes('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) {
      return isoOrSqliteStr;
    }
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return isoOrSqliteStr;
  }
}

export default function VisitorLogModal({ isOpen, onClose }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('admin_ip_logs_unlocked') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, unique_ips: 0, my_ip: '', logs: [] });
  const [search, setSearch] = useState('');
  const [copiedIp, setCopiedIp] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const getStoredPin = () => localStorage.getItem('admin_ip_logs_pin') || '1234';

  const fetchLogs = async (searchTerm = search) => {
    try {
      setLoading(true);
      const url = apiUrl(`/api/admin/visitor-logs?limit=150&search=${encodeURIComponent(searchTerm)}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải nhật ký IP');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching visitor logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isUnlocked) {
      fetchLogs('');
    }
  }, [isOpen, isUnlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput.trim() === getStoredPin()) {
      setIsUnlocked(true);
      setPinError('');
      if (rememberMe) {
        localStorage.setItem('admin_ip_logs_unlocked', 'true');
      }
      fetchLogs('');
    } else {
      setPinError('Mã PIN không chính xác! Vui lòng thử lại.');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    localStorage.removeItem('admin_ip_logs_unlocked');
    setPinInput('');
    setPinError('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(search);
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử IP truy cập này không?')) {
      return;
    }
    try {
      setIsClearing(true);
      const res = await fetch(apiUrl('/api/admin/visitor-logs'), { method: 'DELETE' });
      if (res.ok) {
        fetchLogs('');
      } else {
        alert('Không thể xóa nhật ký.');
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopy = (ip) => {
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1800);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: isUnlocked ? '960px' : '440px',
          width: '94%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 1.5rem',
          borderRadius: '10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          transition: 'max-width 0.25s ease'
        }}
      >
        {/* ================================================================= */}
        {/* SCREEN 1: PIN AUTHENTICATION REQUIRED (IF LOCKED)                */}
        {/* ================================================================= */}
        {!isUnlocked ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Xác Thực Quản Trị Viên
                </h3>
              </div>
              <button
                onClick={onClose}
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 6px', borderRadius: '4px' }}
                title="Đóng"
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Đây là khu vực bảo mật riêng tư. Vui lòng nhập mã PIN quản trị để xem danh sách IP truy cập website.
            </p>

            <form onSubmit={handleUnlock}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.35rem' }}>
                  Mã PIN bảo mật (Mặc định: 1234):
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Nhập mã PIN..."
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                  autoFocus
                  style={{ width: '100%', height: '38px', fontSize: '1rem', letterSpacing: '2px', textAlign: 'center' }}
                />
                {pinError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.35rem', fontWeight: 500 }}>
                    {pinError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="remember-admin-pin"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="remember-admin-pin" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Ghi nhớ phiên đăng nhập trên trình duyệt này
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Mở khóa
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================================================================= */
          /* SCREEN 2: UNLOCKED ADMIN DASHBOARD                               */
          /* ================================================================= */
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)'
                }}>
                  <Globe size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      Nhật Ký IP Truy Cập (Private Admin)
                    </h2>
                    <span style={{ fontSize: '11px', background: 'rgba(82, 122, 82, 0.15)', color: 'var(--success)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Đã mở khóa
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Tự động ghi nhận qua Cloudflare & lưu trữ vĩnh viễn trên Turso Cloud. Chỉ hiển thị với bạn.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handleLock}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '6px' }}
                  title="Khóa lại để bảo mật"
                >
                  <Shield size={14} /> Khóa lại
                </button>
                <button
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', borderRadius: '6px' }}
                  title="Đóng (Phím tắt: Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Overview KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              margin: '0.85rem 0'
            }}>
              {/* Card 1: Total Visits */}
              <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Activity size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500 }}>
                    Tổng lượt truy cập
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>
                    {data.total}
                  </div>
                </div>
              </div>

              {/* Card 2: Unique IPs */}
              <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  background: '#EEF1E7',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500 }}>
                    Số IP duy nhất
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--success)' }}>
                    {data.unique_ips}
                  </div>
                </div>
              </div>

              {/* Card 3: Current User IP */}
              <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  background: 'var(--surface-hover)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Globe size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>IP của bạn</span>
                    <span style={{ fontSize: '10px', background: 'var(--primary)', color: '#FFFFFF', padding: '1px 5px', borderRadius: '3px' }}>
                      Thiết bị này
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.my_ip || 'Đang xác định...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Toolbar: Search & Action buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap',
              marginBottom: '0.75rem'
            }}>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '420px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Tìm IP, quốc gia, hoặc URL..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.825rem' }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => { setSearch(''); fetchLogs(''); }}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '34px' }}>
                  Tìm
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => fetchLogs()}
                  disabled={loading}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '34px' }}
                  title="Tải lại danh sách mới nhất"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
                </button>

                {data.logs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    disabled={isClearing}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '34px' }}
                    title="Xóa tất cả nhật ký"
                  >
                    <Trash2 size={14} />
                    <span>Xóa nhật ký</span>
                  </button>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface)'
            }}>
              <table className="quiz-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>Thời gian (VN)</th>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>Địa chỉ IP</th>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>Quốc gia</th>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>Thao tác & Đường dẫn</th>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)' }}>Thiết bị</th>
                    <th style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && data.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                          <span>Đang tải nhật ký truy cập từ máy chủ...</span>
                        </div>
                      </td>
                    </tr>
                  ) : data.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <Globe size={32} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                          <span>Chưa có lượt truy cập nào được ghi nhận.</span>
                          {search && <span style={{ fontSize: '0.75rem' }}>Thử xóa từ khóa tìm kiếm để xem tất cả.</span>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.logs.map((log) => {
                      const isCurrentMyIp = log.ip_address === data.my_ip;
                      const countryInfo = formatCountry(log.country, log.ip_address);
                      const device = parseUserAgent(log.user_agent);

                      return (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isCurrentMyIp ? 'var(--primary-light)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Thời gian */}
                          <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(log.created_at)}
                          </td>

                          {/* IP Address */}
                          <td style={{ padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: isCurrentMyIp ? 'var(--primary-hover)' : 'var(--text)',
                                fontSize: '0.85rem'
                              }}>
                                {log.ip_address}
                              </span>
                              {isCurrentMyIp && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  background: 'var(--primary)',
                                  color: '#FFFFFF',
                                  borderRadius: '3px',
                                  fontWeight: 500
                                }}>
                                  Bạn
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopy(log.ip_address)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: copiedIp === log.ip_address ? 'var(--success)' : 'var(--text-muted)',
                                  padding: '2px',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                title="Sao chép địa chỉ IP"
                              >
                                {copiedIp === log.ip_address ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>

                          {/* Quốc gia */}
                          <td style={{ padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span>{countryInfo.flag}</span>
                              <span style={{ color: 'var(--text)' }}>{countryInfo.name}</span>
                            </span>
                          </td>

                          {/* Thao tác & Đường dẫn */}
                          <td style={{ padding: '0.55rem 0.85rem', maxWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: log.method === 'POST' ? 'rgba(185, 133, 50, 0.15)' : 'var(--surface-hover)',
                                color: log.method === 'POST' ? 'var(--warning)' : 'var(--text-secondary)',
                                border: '1px solid var(--border)'
                              }}>
                                {log.method}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={log.path}
                              >
                                {log.path}
                              </span>
                            </div>
                          </td>

                          {/* Thiết bị */}
                          <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            <span title={log.user_agent}>
                              {device}
                            </span>
                          </td>

                          {/* Mã trạng thái */}
                          <td style={{ padding: '0.55rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: log.status_code >= 200 && log.status_code < 300 ? 'rgba(82, 122, 82, 0.15)' : 'rgba(184, 92, 85, 0.15)',
                              color: log.status_code >= 200 && log.status_code < 300 ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {log.status_code}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <div>
                Phím tắt bí mật: <kbd style={{ background: 'var(--surface-hover)', padding: '2px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>Ctrl + Shift + L</kbd>
              </div>
              <div>
                Dữ liệu đồng bộ trực tiếp tới Turso Cloud.
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
