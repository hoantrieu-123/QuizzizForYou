import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl } from '../apiConfig';
import {
  Globe, Activity, Shield, X, Search, RefreshCw, Trash2, Check, Copy, Key,
  FileText, Play, RotateCcw, AlertTriangle, AlertCircle
} from './UIcons';
import {
  DEFAULT_ADMIN_PIN,
  getAdminPin,
  setAdminPinInStorage,
  getAdminHeaders,
  fetchClientPermissions
} from '../utils/adminAuth';

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
    TH: '🇹🇭', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', CN: 'Trung Quốc',
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

// Format file size
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function VisitorLogModal({ isOpen, onClose, onRestored }) {
  // Main Tab: 'trash' (default) or 'logs'
  const [activeTab, setActiveTab] = useState('trash');

  // ===========================================================================
  // TRASH & RECOVERY STATE
  // ===========================================================================
  const [trashData, setTrashData] = useState({ documents: [], quizzes: [] });
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashFilter, setTrashFilter] = useState('all'); // 'all' | 'documents' | 'quizzes'
  const [restoringAction, setRestoringAction] = useState(null); // id or 'all'
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTrash = async () => {
    try {
      setTrashLoading(true);
      const res = await fetch(apiUrl('/api/trash'));
      if (res.ok) {
        const json = await res.json();
        setTrashData(json);
      }
    } catch (err) {
      console.error('Lỗi khi tải thùng rác:', err);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleRestoreDocument = async (docId, title) => {
    try {
      setRestoringAction(`doc_${docId}`);
      const res = await fetch(apiUrl(`/api/documents/${docId}/restore`), {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`Đã khôi phục tài liệu "${title || 'tài liệu'}" thành công!`);
        await fetchTrash();
        onRestored?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Không thể khôi phục tài liệu', true);
      }
    } catch (err) {
      showToast('Lỗi kết nối khi khôi phục: ' + err.message, true);
    } finally {
      setRestoringAction(null);
    }
  };

  const handleRestoreQuiz = async (quizId, title) => {
    try {
      setRestoringAction(`quiz_${quizId}`);
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}/restore`), {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`Đã khôi phục bài thi "${title || 'đề thi'}" thành công!`);
        await fetchTrash();
        onRestored?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Không thể khôi phục bài thi', true);
      }
    } catch (err) {
      showToast('Lỗi kết nối khi khôi phục: ' + err.message, true);
    } finally {
      setRestoringAction(null);
    }
  };

  const handleRestoreAll = async () => {
    const totalCount = trashData.documents.length + trashData.quizzes.length;
    if (totalCount === 0) return;

    if (!window.confirm(`Bạn có chắc muốn khôi phục toàn bộ ${totalCount} mục trong thùng rác?`)) {
      return;
    }

    try {
      setRestoringAction('all');
      const res = await fetch(apiUrl('/api/trash/restore-all'), {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Đã khôi phục thành công ${result.restored_documents || 0} tài liệu và ${result.restored_quizzes || 0} bài thi!`);
        await fetchTrash();
        onRestored?.();
      } else {
        showToast('Không thể khôi phục toàn bộ thùng rác', true);
      }
    } catch (err) {
      showToast('Lỗi khi khôi phục: ' + err.message, true);
    } finally {
      setRestoringAction(null);
    }
  };

  const handlePermanentDeleteDoc = async (docId, title) => {
    if (!window.confirm(`Hành động này sẽ xóa VĨNH VIỄN tài liệu "${title}" khỏi hệ thống và không thể khôi phục. Bạn có chắc chắn?`)) {
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/documents/${docId}/permanent`), {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Đã xóa vĩnh viễn tài liệu "${title}"`);
        await fetchTrash();
      } else {
        showToast('Không thể xóa vĩnh viễn tài liệu', true);
      }
    } catch (err) {
      showToast('Lỗi xóa vĩnh viễn: ' + err.message, true);
    }
  };

  const handlePermanentDeleteQuiz = async (quizId, title) => {
    if (!window.confirm(`Hành động này sẽ xóa VĨNH VIỄN bài thi "${title}" khỏi hệ thống và không thể khôi phục. Bạn có chắc chắn?`)) {
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}/permanent`), {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Đã xóa vĩnh viễn bài thi "${title}"`);
        await fetchTrash();
      } else {
        showToast('Không thể xóa vĩnh viễn bài thi', true);
      }
    } catch (err) {
      showToast('Lỗi xóa vĩnh viễn: ' + err.message, true);
    }
  };

  const handleClearTrash = async () => {
    const totalCount = trashData.documents.length + trashData.quizzes.length;
    if (totalCount === 0) return;

    if (!window.confirm(`CẢNH BÁO: Bạn sắp dọn sạch thùng rác và xóa VĨNH VIỄN ${totalCount} mục. Dữ liệu sẽ mất hoàn toàn và không thể khôi phục lại. Bạn có chắc chắn tiếp tục?`)) {
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/trash/clear'), {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Đã dọn sạch thùng rác!');
        await fetchTrash();
      } else {
        showToast('Không thể dọn sạch thùng rác', true);
      }
    } catch (err) {
      showToast('Lỗi dọn thùng rác: ' + err.message, true);
    }
  };

  // ===========================================================================
  // SUPER ADMIN IP PERMISSIONS STATE & HANDLERS
  // ===========================================================================
  const [superIps, setSuperIps] = useState([]);
  const [myIp, setMyIp] = useState('');
  const [isMyIpSuper, setIsMyIpSuper] = useState(false);
  const [superIpsLoading, setSuperIpsLoading] = useState(false);
  const [inputSuperIp, setInputSuperIp] = useState('');
  const [superAdminActionLoading, setSuperAdminActionLoading] = useState(false);

  const fetchSuperAdminInfo = async () => {
    try {
      setSuperIpsLoading(true);
      const res = await fetch(apiUrl('/api/client/permissions'), {
        headers: getAdminHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMyIp(data.client_ip || '');
        setIsMyIpSuper(!!data.is_super_admin);
        if (data.super_admin_ips) {
          setSuperIps(data.super_admin_ips);
        }
      }
    } catch (e) {
      console.error('Error fetching super admin permissions:', e);
    } finally {
      setSuperIpsLoading(false);
    }
  };

  const handleGrantSuperIp = async (targetIp, inputPin) => {
    const cleanIp = (targetIp || '').trim();
    if (!cleanIp) {
      showToast('Vui lòng nhập địa chỉ IP hợp lệ', true);
      return;
    }
    const pinToUse = inputPin || getAdminPin();
    try {
      setSuperAdminActionLoading(true);
      const res = await fetch(apiUrl('/api/admin/grant-super-ip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ ip: cleanIp, pin: pinToUse })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          const userPin = window.prompt('Nhập mã PIN Quản trị viên để cấp quyền IP Cao Nhất:');
          if (userPin) {
            setAdminPinInStorage(userPin);
            return handleGrantSuperIp(cleanIp, userPin);
          }
        }
        throw new Error(data.detail || 'Không thể cấp quyền IP');
      }

      showToast(`Đã cấp quyền IP Cao Nhất thành công cho ${cleanIp}!`);
      if (data.super_admin_ips) {
        setSuperIps(data.super_admin_ips);
      }
      if (cleanIp === myIp) {
        setIsMyIpSuper(true);
      }
      setInputSuperIp('');
      fetchClientPermissions(true);
      if (activeTab === 'logs') {
        fetchLogs();
      }
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSuperAdminActionLoading(false);
    }
  };

  const handleRevokeSuperIp = async (targetIp, inputPin) => {
    const cleanIp = (targetIp || '').trim();
    if (!cleanIp) return;
    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi quyền IP Cao Nhất của ${cleanIp}?`)) {
      return;
    }
    const pinToUse = inputPin || getAdminPin();
    try {
      setSuperAdminActionLoading(true);
      const res = await fetch(apiUrl('/api/admin/revoke-super-ip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ ip: cleanIp, pin: pinToUse })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          const userPin = window.prompt('Nhập mã PIN Quản trị viên để thu hồi quyền IP:');
          if (userPin) {
            setAdminPinInStorage(userPin);
            return handleRevokeSuperIp(cleanIp, userPin);
          }
        }
        throw new Error(data.detail || 'Không thể thu hồi quyền IP');
      }

      showToast(`Đã thu hồi quyền IP Cao Nhất của ${cleanIp}!`);
      if (data.super_admin_ips) {
        setSuperIps(data.super_admin_ips);
      }
      if (cleanIp === myIp) {
        setIsMyIpSuper(false);
      }
      fetchClientPermissions(true);
      if (activeTab === 'logs') {
        fetchLogs();
      }
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSuperAdminActionLoading(false);
    }
  };

  // ===========================================================================
  // VISITOR LOGS STATE
  // ===========================================================================
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logsData, setLogsData] = useState({ total: 0, unique_ips: 0, my_ip: '', logs: [] });
  const [search, setSearch] = useState('');
  const [copiedIp, setCopiedIp] = useState(null);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // Change PIN state
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  const fetchLogs = async (searchTerm = search) => {
    try {
      setLogsLoading(true);
      setLogsError('');
      const url = apiUrl(`/api/admin/visitor-logs?limit=150&search=${encodeURIComponent(searchTerm)}`);
      const res = await fetch(url, {
        headers: getAdminHeaders()
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Máy chủ Backend trên Render chưa cập nhật phiên bản mới (Lỗi 404). Vui lòng vào dashboard.render.com -> chọn Web Service backend -> nhấn "Manual Deploy" -> "Deploy latest commit" để kích hoạt tính năng!');
        }
        throw new Error(`Máy chủ phản hồi lỗi HTTP ${res.status}`);
      }
      const json = await res.json();
      setLogsData(json);
    } catch (err) {
      console.error('Error fetching visitor logs:', err);
      setLogsError(err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử IP truy cập này không?')) {
      return;
    }
    try {
      setIsClearingLogs(true);
      const res = await fetch(apiUrl('/api/admin/visitor-logs'), {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (res.ok) {
        fetchLogs('');
        showToast('Đã xóa lịch sử IP thành công!');
      } else {
        alert('Không thể xóa nhật ký.');
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleCopy = (ip) => {
    navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1800);
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    const cleanOld = oldPin.trim();
    const cleanNew = newPin.trim();
    const cleanConfirm = confirmNewPin.trim();

    if (cleanNew.length < 4) {
      setChangePinError('Mã PIN mới phải có ít nhất 4 ký tự!');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setChangePinError('Xác nhận mã PIN mới không trùng khớp!');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/admin/change-pin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_pin: cleanOld, new_pin: cleanNew })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Mã PIN hiện tại không chính xác!');
      }

      setAdminPinInStorage(cleanNew);
      setChangePinSuccess('Đã đổi mã PIN thành công và đồng bộ lên máy chủ!');
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setTimeout(() => {
        setShowChangePin(false);
        setChangePinSuccess('');
      }, 1500);
    } catch (err) {
      if (cleanOld === getAdminPin()) {
        setAdminPinInStorage(cleanNew);
        setChangePinSuccess('Đã đổi mã PIN thành công trên trình duyệt này!');
        setOldPin('');
        setNewPin('');
        setConfirmNewPin('');
        setTimeout(() => {
          setShowChangePin(false);
          setChangePinSuccess('');
        }, 1500);
      } else {
        setChangePinError(err.message || 'Mã PIN hiện tại không chính xác!');
      }
    }
  };

  // ===========================================================================
  // LIFECYCLE & KEYBOARD HANDLERS
  // ===========================================================================
  useEffect(() => {
    if (isOpen) {
      fetchTrash();
      fetchSuperAdminInfo();
      if (activeTab === 'logs') {
        fetchLogs('');
      }
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalTrashCount = trashData.documents.length + trashData.quizzes.length;

  const filteredDocs = trashFilter === 'quizzes' ? [] : trashData.documents;
  const filteredQuizzes = trashFilter === 'documents' ? [] : trashData.quizzes;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '960px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 1.5rem',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER                                                      */}
        {/* ================================================================= */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '9px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)'
            }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Trung Tâm Khôi Phục & Quản Trị
                </h2>
                <span style={{
                  fontSize: '11px',
                  background: 'var(--surface-hover)',
                  color: 'var(--text-muted)',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontWeight: 500,
                  border: '1px solid var(--border)'
                }}>
                  Ctrl + Shift + L
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Khôi phục lại tài liệu hoặc đề thi đã xóa, kiểm tra nhật ký truy cập riêng tư
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '5px 8px', borderRadius: '6px' }}
            title="Đóng (Phím tắt: Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* ================================================================= */}
        {/* TOAST FEEDBACK                                                    */}
        {/* ================================================================= */}
        {toastMessage && (
          <div style={{
            background: toastMessage.isError ? 'rgba(184, 92, 85, 0.15)' : 'rgba(82, 122, 82, 0.15)',
            color: toastMessage.isError ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${toastMessage.isError ? 'rgba(184, 92, 85, 0.3)' : 'rgba(82, 122, 82, 0.3)'}`,
            padding: '0.55rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}>
            {toastMessage.isError ? <AlertTriangle size={15} /> : <Check size={15} />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* TOP TABS                                                          */}
        {/* ================================================================= */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem',
          paddingBottom: '0.25rem'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('trash')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'trash' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'trash' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeTab === 'trash' ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={15} />
            <span>Khôi phục tài liệu & Đề thi</span>
            {totalTrashCount > 0 && (
              <span style={{
                background: activeTab === 'trash' ? 'rgba(255, 255, 255, 0.3)' : 'var(--primary-light)',
                color: activeTab === 'trash' ? '#FFFFFF' : 'var(--primary)',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 600
              }}>
                {totalTrashCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('super_ips')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'super_ips' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'super_ips' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeTab === 'super_ips' ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Shield size={15} />
            <span>Quyền IP Cao Nhất</span>
            {isMyIpSuper && (
              <span style={{
                background: '#22c55e',
                color: '#FFFFFF',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '8px',
                fontWeight: 600
              }}>
                VIP
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'logs' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'logs' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeTab === 'logs' ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={15} />
            <span>Nhật ký IP truy cập</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: RECOVERY / TRASH PANEL                                     */}
        {/* ================================================================= */}
        {activeTab === 'trash' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '0.85rem'
            }}>
              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setTrashFilter('all')}
                  className={`btn btn-sm ${trashFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '3px 9px' }}
                >
                  Tất cả ({totalTrashCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTrashFilter('documents')}
                  className={`btn btn-sm ${trashFilter === 'documents' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '3px 9px' }}
                >
                  Tài liệu ({trashData.documents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTrashFilter('quizzes')}
                  className={`btn btn-sm ${trashFilter === 'quizzes' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '3px 9px' }}
                >
                  Đề thi ({trashData.quizzes.length})
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {totalTrashCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreAll}
                    disabled={restoringAction === 'all'}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      background: 'var(--success, #2e7d32)',
                      borderColor: 'var(--success, #2e7d32)',
                      color: '#ffffff',
                      fontWeight: 600
                    }}
                    title="Khôi phục lại toàn bộ tài liệu và bài thi trong thùng rác"
                  >
                    <RotateCcw size={14} className={restoringAction === 'all' ? 'animate-spin' : ''} />
                    <span>{restoringAction === 'all' ? 'Đang khôi phục...' : 'Khôi phục tất cả'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchTrash}
                  disabled={trashLoading}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Làm mới thùng rác"
                >
                  <RefreshCw size={13} className={trashLoading ? 'animate-spin' : ''} />
                  <span>Làm mới</span>
                </button>

                {totalTrashCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearTrash}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Xóa vĩnh viễn tất cả các mục trong thùng rác"
                  >
                    <Trash2 size={13} />
                    <span>Dọn sạch thùng rác</span>
                  </button>
                )}
              </div>
            </div>

            {/* List / Table of Items */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface)'
            }}>
              {trashLoading && totalTrashCount === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div>Đang tải thùng rác...</div>
                </div>
              ) : (filteredDocs.length === 0 && filteredQuizzes.length === 0) ? (
                <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RotateCcw size={42} style={{ color: 'var(--border)', marginBottom: '0.75rem', opacity: 0.6 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.35rem 0' }}>
                    Thùng rác đang trống
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>
                    Khi bạn hoặc ai đó xóa tài liệu hay đề thi, chúng sẽ được lưu an toàn tại đây để bạn có thể khôi phục lại bất kỳ lúc nào.
                  </p>
                </div>
              ) : (
                <table className="quiz-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', width: '90px' }}>Loại</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Tên tệp / Bài thi</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '150px' }}>Thông tin</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '160px' }}>Thời điểm xóa</th>
                      <th style={{ padding: '0.65rem 0.85rem', width: '190px', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Deleted Documents */}
                    {filteredDocs.map((doc) => {
                      const isRestoring = restoringAction === `doc_${doc.id}`;
                      const cleanTitle = (doc.title || doc.filename || 'Tài liệu').replace(/\\/g, '/').split('/').pop();
                      const fileExt = (doc.file_type || 'docx').toUpperCase();

                      return (
                        <tr
                          key={`doc_${doc.id}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Loại */}
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: doc.file_type === 'pdf' ? 'rgba(217, 83, 79, 0.12)' : 'rgba(43, 114, 186, 0.12)',
                              color: doc.file_type === 'pdf' ? '#d9534f' : '#2b72ba'
                            }}>
                              <FileText size={12} />
                              <span>{fileExt}</span>
                            </span>
                          </td>

                          {/* Tên */}
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>
                              {cleanTitle}
                            </div>
                            {doc.filename && doc.filename !== doc.title && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                File gốc: {doc.filename.replace(/\\/g, '/').split('/').pop()}
                              </div>
                            )}
                          </td>

                          {/* Thông tin */}
                          <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)' }}>
                            {formatBytes(doc.file_size)}
                          </td>

                          {/* Thời điểm xóa */}
                          <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(doc.deleted_at)}
                          </td>

                          {/* Thao tác */}
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleRestoreDocument(doc.id, cleanTitle)}
                                disabled={isRestoring || restoringAction === 'all'}
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--success, #2e7d32)',
                                  borderColor: 'var(--success, #2e7d32)',
                                  color: '#ffffff',
                                  padding: '3px 8px',
                                  fontSize: '0.78rem',
                                  borderRadius: '5px'
                                }}
                                title="Khôi phục tài liệu này về thư mục ban đầu"
                              >
                                <RotateCcw size={12} className={isRestoring ? 'animate-spin' : ''} />
                                <span>{isRestoring ? 'Đang...' : 'Khôi phục'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePermanentDeleteDoc(doc.id, cleanTitle)}
                                disabled={isRestoring || restoringAction === 'all'}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: '3px 6px',
                                  color: 'var(--danger)',
                                  borderRadius: '5px'
                                }}
                                title="Xóa vĩnh viễn khỏi hệ thống"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Render Deleted Quizzes */}
                    {filteredQuizzes.map((quiz) => {
                      const isRestoring = restoringAction === `quiz_${quiz.id}`;
                      const cleanTitle = (quiz.title || quiz.filename || 'Bài kiểm tra').replace(/\\/g, '/').split('/').pop();

                      return (
                        <tr
                          key={`quiz_${quiz.id}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Loại */}
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(124, 77, 255, 0.12)',
                              color: '#7c4dff'
                            }}>
                              <Play size={12} />
                              <span>ĐỀ THI</span>
                            </span>
                          </td>

                          {/* Tên */}
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>
                              {cleanTitle}
                            </div>
                            {quiz.filename && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                File gốc: {quiz.filename.replace(/\\/g, '/').split('/').pop()}
                              </div>
                            )}
                          </td>

                          {/* Thông tin */}
                          <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)' }}>
                            <span className="badge" style={{ fontSize: '0.75rem' }}>
                              {quiz.question_count || 0} câu hỏi
                            </span>
                          </td>

                          {/* Thời điểm xóa */}
                          <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(quiz.deleted_at)}
                          </td>

                          {/* Thao tác */}
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleRestoreQuiz(quiz.id, cleanTitle)}
                                disabled={isRestoring || restoringAction === 'all'}
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--success, #2e7d32)',
                                  borderColor: 'var(--success, #2e7d32)',
                                  color: '#ffffff',
                                  padding: '3px 8px',
                                  fontSize: '0.78rem',
                                  borderRadius: '5px'
                                }}
                                title="Khôi phục bài thi này"
                              >
                                <RotateCcw size={12} className={isRestoring ? 'animate-spin' : ''} />
                                <span>{isRestoring ? 'Đang...' : 'Khôi phục'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePermanentDeleteQuiz(quiz.id, cleanTitle)}
                                disabled={isRestoring || restoringAction === 'all'}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: '3px 6px',
                                  color: 'var(--danger)',
                                  borderRadius: '5px'
                                }}
                                title="Xóa vĩnh viễn khỏi hệ thống"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: SUPER ADMIN IP MANAGEMENT PANEL                            */}
        {/* ================================================================= */}
        {activeTab === 'super_ips' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '1rem', overflowY: 'auto', paddingRight: '4px' }}>
            {/* 1. CURRENT DEVICE STATUS CARD */}
            <div style={{
              background: isMyIpSuper ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${isMyIpSuper ? '#86efac' : '#fde68a'}`,
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={20} style={{ color: isMyIpSuper ? '#15803d' : '#b45309' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isMyIpSuper ? '#15803d' : '#b45309' }}>
                    Thiết bị / Địa chỉ IP của bạn
                  </span>
                </div>
                <div style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: isMyIpSuper ? '#dcfce7' : '#fef3c7',
                  color: isMyIpSuper ? '#166534' : '#92400e',
                  border: `1px solid ${isMyIpSuper ? '#bbf7d0' : '#fde68a'}`
                }}>
                  {isMyIpSuper ? '👑 IP Cao Nhất (Toàn quyền Xóa / Sửa)' : '👤 IP Khách (Không thể Xóa / Chỉ sửa mục của mình)'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
                  {myIp || 'Đang lấy IP...'}
                </div>
                {myIp && (
                  <button
                    type="button"
                    onClick={() => handleCopy(myIp)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    {copiedIp === myIp ? <Check size={12} /> : <Copy size={12} />} {copiedIp === myIp ? 'Đã sao chép' : 'Sao chép IP'}
                  </button>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b', lineHeight: 1.5 }}>
                {isMyIpSuper
                  ? 'Máy này hiện có toàn quyền Quản trị viên Cao Nhất: nút Xóa tài liệu, thư mục, đề thi luôn hiển thị đầy đủ và có thể sửa mọi nội dung trên website.'
                  : 'Các IP khách thông thường sẽ bị ẩn hoàn toàn nút Xóa và không thể chỉnh sửa đề thi, thư mục hoặc tài liệu do người khác tải lên. Bấm nút dưới để cấp quyền IP Cao Nhất cho máy này.'
                }
              </p>

              <div>
                {!isMyIpSuper ? (
                  <button
                    type="button"
                    disabled={superAdminActionLoading || !myIp}
                    onClick={() => handleGrantSuperIp(myIp)}
                    className="btn btn-primary"
                    style={{
                      padding: '0.65rem 1.35rem',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    ⭐ Cấp quyền IP Cao Nhất cho máy này
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={superAdminActionLoading || !myIp}
                    onClick={() => handleRevokeSuperIp(myIp)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.5rem 1rem',
                      color: '#b91c1c',
                      borderColor: '#fca5a5',
                      fontSize: '0.825rem',
                      borderRadius: '8px'
                    }}
                  >
                    Hủy quyền IP Cao Nhất của máy này
                  </button>
                )}
              </div>
            </div>

            {/* 2. GRANT ANOTHER IP FORM */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                Cấp quyền IP Cao Nhất cho một IP khác
              </span>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Nhập địa chỉ IP của máy tính, điện thoại hoặc quản trị viên khác để cấp toàn quyền Xóa và Sửa trên website:
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputSuperIp) handleGrantSuperIp(inputSuperIp);
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                <input
                  type="text"
                  placeholder="Nhập địa chỉ IP (VD: 1.53.93.51)..."
                  value={inputSuperIp}
                  onChange={(e) => setInputSuperIp(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="submit"
                  disabled={superAdminActionLoading || !inputSuperIp.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.55rem 1.1rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  + Cấp quyền IP
                </button>
              </form>
            </div>

            {/* 3. LIST OF SUPER ADMIN IPS */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                  Danh sách các IP Cao Nhất ({superIps.length})
                </span>
                <button
                  type="button"
                  onClick={fetchSuperAdminInfo}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                >
                  <RefreshCw size={12} /> Làm mới
                </button>
              </div>

              {superIps.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Chưa có IP nào trong danh sách. Hãy nhấn "Cấp quyền IP Cao Nhất cho máy này" phía trên.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Địa chỉ IP</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Loại</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Quyền hạn</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superIps.map(ip => {
                        const isThisMine = ip === myIp;
                        return (
                          <tr key={ip} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                              {ip}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isThisMine ? (
                                <span style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontSize: '0.72rem',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontWeight: 600
                                }}>
                                  Máy của bạn
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                  Quản trị viên
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#166534', fontSize: '0.8rem' }}>
                              Toàn quyền Xóa & Sửa
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleRevokeSuperIp(ip)}
                                disabled={superAdminActionLoading}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#dc2626' }}
                              >
                                Thu hồi quyền
                              </button>
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
        )}

        {/* ================================================================= */}
        {/* TAB 3: VISITOR LOGS PANEL                                         */}
        {/* ================================================================= */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Header controls for Logs */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap',
              marginBottom: '0.75rem'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tự động ghi nhận qua Cloudflare & lưu trữ vĩnh viễn trên Turso Cloud.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowChangePin(prev => !prev)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: '6px' }}
                  title="Thay đổi mã PIN bảo mật"
                >
                  <Key size={14} /> Đổi PIN
                </button>

                <button
                  type="button"
                  onClick={() => fetchLogs()}
                  disabled={logsLoading}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '32px' }}
                  title="Tải lại danh sách mới nhất"
                >
                  <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} />
                  <span>{logsLoading ? 'Đang tải...' : 'Làm mới'}</span>
                </button>

                {logsData.logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    disabled={isClearingLogs}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '32px' }}
                    title="Xóa tất cả nhật ký"
                  >
                    <Trash2 size={13} />
                    <span>Xóa nhật ký</span>
                  </button>
                )}
              </div>
            </div>

            {/* Change PIN Form (Sub-view) */}
            {showChangePin && (
              <div className="card" style={{
                margin: '0.5rem 0 0.85rem 0',
                padding: '0.85rem 1rem',
                border: '1.5px solid var(--primary)',
                background: 'var(--surface-hover)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                    <Key size={15} style={{ color: 'var(--primary)' }} />
                    <span>Thay Đổi Mã PIN Quản Trị Viên</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowChangePin(false); setChangePinError(''); }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 5px', borderRadius: '4px' }}
                  >
                    <X size={13} />
                  </button>
                </div>

                <form onSubmit={handleChangePin} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '125px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      PIN hiện tại:
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Mã PIN cũ..."
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      style={{ height: '33px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '125px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      PIN mới (tối thiểu 4 số):
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Mã PIN mới..."
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      style={{ height: '33px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '125px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Xác nhận PIN mới:
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Nhập lại PIN mới..."
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      style={{ height: '33px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ height: '33px', padding: '0 0.85rem' }}>
                      Lưu mã PIN mới
                    </button>
                  </div>
                </form>

                {changePinError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.45rem', fontWeight: 500 }}>
                    {changePinError}
                  </div>
                )}
                {changePinSuccess && (
                  <div style={{ color: 'var(--success)', fontSize: '0.78rem', marginTop: '0.45rem', fontWeight: 500 }}>
                    ✓ {changePinSuccess}
                  </div>
                )}
              </div>
            )}

            {/* Error Message Notice */}
            {logsError && (
              <div style={{
                background: '#FFF4E5',
                color: '#663C00',
                border: '1px solid #FFE2B8',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.825rem',
                lineHeight: 1.5,
                margin: '0.5rem 0'
              }}>
                <strong>⚠️ Thông báo:</strong> {logsError}
              </div>
            )}

            {/* Overview KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.65rem',
              margin: '0.5rem 0 0.85rem 0'
            }}>
              {/* Card 1: Total Visits */}
              <div className="card" style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', borderRadius: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Activity size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500 }}>
                    Tổng lượt xem
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
                    {logsData.total}
                  </div>
                </div>
              </div>

              {/* Card 2: Unique IPs */}
              <div className="card" style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', borderRadius: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#EEF1E7',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500 }}>
                    Số IP duy nhất
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
                    {logsData.unique_ips}
                  </div>
                </div>
              </div>

              {/* Card 3: Current User IP */}
              <div className="card" style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', borderRadius: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--surface-hover)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Globe size={17} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>IP của bạn</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {logsData.my_ip || 'Đang xác định...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Tìm IP, quốc gia, hoặc URL..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    fetchLogs(e.target.value);
                  }}
                  style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Logs Table */}
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
                  {logsLoading && logsData.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                          <span>Đang tải nhật ký truy cập từ máy chủ...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logsData.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <Globe size={32} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                          <span>Chưa có lượt truy cập nào được ghi nhận.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logsData.logs.map((log) => {
                      const isCurrentMyIp = log.ip_address === logsData.my_ip;
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
                          <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(log.created_at)}
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                              {superIps.includes(log.ip_address) && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  background: '#22c55e',
                                  color: '#FFFFFF',
                                  borderRadius: '3px',
                                  fontWeight: 600
                                }}>
                                  ⭐ IP Cao Nhất
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

                              {superIps.includes(log.ip_address) ? (
                                <button
                                  type="button"
                                  disabled={superAdminActionLoading}
                                  onClick={() => handleRevokeSuperIp(log.ip_address)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#dc2626',
                                    padding: '1px 4px',
                                    fontSize: '10px',
                                    borderRadius: '3px',
                                    textDecoration: 'underline'
                                  }}
                                  title="Thu hồi quyền IP Cao Nhất"
                                >
                                  Hủy quyền
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={superAdminActionLoading}
                                  onClick={() => handleGrantSuperIp(log.ip_address)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--primary)',
                                    padding: '1px 4px',
                                    fontSize: '10px',
                                    borderRadius: '3px',
                                    textDecoration: 'underline'
                                  }}
                                  title="Cấp quyền IP Cao Nhất cho IP này"
                                >
                                  + Cấp quyền
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span>{countryInfo.flag}</span>
                              <span style={{ color: 'var(--text)' }}>{countryInfo.name}</span>
                            </span>
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', maxWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: log.method === 'VISIT'
                                  ? 'rgba(37, 99, 235, 0.12)'
                                  : (log.method === 'POST' ? 'rgba(185, 133, 50, 0.15)' : (log.method === 'DELETE' ? 'rgba(220, 38, 38, 0.12)' : 'var(--surface-hover)')),
                                color: log.method === 'VISIT'
                                  ? '#2563eb'
                                  : (log.method === 'POST' ? 'var(--warning)' : (log.method === 'DELETE' ? '#dc2626' : 'var(--text-secondary)')),
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
                          <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            <span title={log.user_agent}>
                              {device}
                            </span>
                          </td>
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
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL FOOTER                                                      */}
        {/* ================================================================= */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.75rem',
          marginTop: '0.5rem',
          borderTop: '1px solid var(--border)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            Bật/tắt nhanh bằng phím tắt: <kbd style={{ background: 'var(--surface-hover)', padding: '2px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>Ctrl + Shift + L</kbd>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 12px' }}
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
