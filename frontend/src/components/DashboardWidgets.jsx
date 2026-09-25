import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, FileText, RotateCcw } from './UIcons';
import { prefetchQuizDetail } from '../services/dataCache';

export default function DashboardWidgets({
  quizzes = [],
  onSelectQuiz,
  onStartQuiz,
  onResumeProgress,
  loadingQuizId
}) {
  const [inProgressQuiz, setInProgressQuiz] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('edudocx_saved_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.quizId) {
          setInProgressQuiz(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading saved quiz progress:', e);
    }
  }, []);

  const handleDismissProgress = () => {
    localStorage.removeItem('edudocx_saved_progress');
    setInProgressQuiz(null);
  };

  const handleResume = () => {
    if (inProgressQuiz?.quizId) {
      onResumeProgress?.(inProgressQuiz.quizId);
    }
  };

  // Recent 4 uploaded files
  const recentFiles = quizzes.slice(0, 4);

  const getCleanFileName = (name) => {
    if (!name) return '';
    return name.replace(/\\/g, '/').split('/').pop();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* WIDGET 1: Auto-save Recovery (Only if in progress) */}
      {inProgressQuiz && (
        <aside className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <RotateCcw size={15} style={{ color: 'var(--warning)' }} />
              <span>Bài làm chưa nộp</span>
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
              Đang dở
            </span>
          </div>

          <div style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.825rem',
            color: 'var(--text)'
          }}>
            <div>
              Bài thi: <strong>"{inProgressQuiz.title || 'Đang làm'}"</strong>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={handleResume}
                onMouseEnter={() => inProgressQuiz?.quizId && prefetchQuizDetail(inProgressQuiz.quizId)}
                disabled={loadingQuizId === inProgressQuiz?.quizId}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, cursor: loadingQuizId === inProgressQuiz?.quizId ? 'wait' : 'pointer' }}
              >
                {loadingQuizId === inProgressQuiz?.quizId ? 'Đang mở...' : 'Tiếp tục làm'}
              </button>
              <button
                type="button"
                onClick={handleDismissProgress}
                className="btn btn-secondary btn-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* WIDGET 2: File Word gần đây */}
      <aside className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
            <span>Đề thi gần đây</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            {recentFiles.length} file
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {recentFiles.length > 0 ? (
            recentFiles.map(q => {
              const isLoading = loadingQuizId === q.id;
              return (
                <div
                  key={q.id}
                  onMouseEnter={() => prefetchQuizDetail(q.id)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileText size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getCleanFileName(q.title || q.filename)}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {q.questions_count || q.questions?.length || 0} câu
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartQuiz?.(q.id)}
                    disabled={isLoading}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      opacity: isLoading ? 0.65 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Làm bài thi"
                  >
                    {isLoading ? (
                      <span>Đang mở...</span>
                    ) : (
                      <>
                        <PlayCircle size={14} style={{ color: 'var(--primary)' }} />
                        <span>Làm bài</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem 0' }}>
              Chưa có file nào được tải lên
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
