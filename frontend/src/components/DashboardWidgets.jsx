import React, { useState, useEffect } from 'react';
import { Play } from './UIcons';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* WIDGET 1: Auto-save Recovery (Only if in progress) */}
      {inProgressQuiz && (
        <aside className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#333333' }}>
              Bài làm chưa nộp
            </span>
            <span className="badge" style={{ fontSize: '0.72rem' }}>
              Đang dở
            </span>
          </div>

          <div style={{
            padding: '0.75rem',
            borderRadius: '6px',
            background: '#ffffff',
            border: '1px solid #eeeeee',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.825rem'
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
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#333333' }}>
            Đề thi gần đây
          </span>
          <span style={{ fontSize: '0.75rem', color: '#555555', fontWeight: 600 }}>
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
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #eeeeee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#333333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.title || q.filename}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#555555' }}>
                      {q.questions_count || q.questions?.length || 0} câu
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartQuiz?.(q.id)}
                    disabled={isLoading}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      opacity: isLoading ? 0.65 : 1
                    }}
                    title="Làm bài thi"
                  >
                    {isLoading ? (
                      <span>Đang mở...</span>
                    ) : (
                      <>
                        <Play size={12} /> Làm bài
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#666666', textAlign: 'center', padding: '0.75rem 0' }}>
              Chưa có file nào được tải lên
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
