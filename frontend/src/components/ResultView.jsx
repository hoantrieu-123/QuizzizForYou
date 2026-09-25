import React, { useEffect, useState } from 'react';
import {
  RotateCcw, Edit3, Home, ArrowRight, Play
} from './UIcons';
import { cleanQuestionPrompt, cleanOptionText } from './QuizPlayer';

export default function ResultView({ result, quiz, onRetake, onEdit, onHome }) {
  const [filter, setFilter] = useState('all');

  const earnedScore = result?.earned_score || 0;
  const totalScore = result?.total_score || 10;
  const percentage = result?.percentage !== undefined
    ? result.percentage
    : Math.round((earnedScore / Math.max(1, totalScore)) * 100);
  const questionResults = result?.question_results || [];

  useEffect(() => {
    // Clean up temporary saved progress once quiz is submitted
    try {
      localStorage.removeItem('edudocx_saved_progress');
    } catch (e) {
      // ignore
    }
  }, [percentage]);

  const correctCount = questionResults.filter(q => q.is_correct).length;
  const wrongCount = questionResults.filter(q => !q.is_correct && isAnswerGiven(q.user_answer)).length;
  const skippedCount = questionResults.length - correctCount - wrongCount;

  function isAnswerGiven(val) {
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.values(val).some(v => v !== '' && v !== null && v !== undefined);
    return true;
  }

  const rankLabel = percentage >= 85 ? 'Xuất sắc' : percentage >= 70 ? 'Giỏi' : percentage >= 50 ? 'Khá' : 'Trung bình';
  const rankColor = percentage >= 70 ? '#059669' : percentage >= 50 ? '#4f46e5' : '#d97706';
  const rankBg = percentage >= 70 ? '#ecfdf5' : percentage >= 50 ? '#eef2ff' : '#fffbeb';

  const avgPaceSec = Math.round(Math.max(10, (result?.time_spent_seconds || 45) / Math.max(1, questionResults.length)));

  const filteredResults = questionResults.filter(q => {
    if (filter === 'correct') return q.is_correct;
    if (filter === 'wrong') return !q.is_correct && isAnswerGiven(q.user_answer);
    if (filter === 'skipped') return !q.is_correct && !isAnswerGiven(q.user_answer);
    return true;
  });

  // Competency Analysis by Question Type
  const typeMap = {
    single_choice: 'Trắc nghiệm 1 đáp án',
    multiple_choice: 'Trắc nghiệm nhiều đáp án',
    true_false: 'Đúng / Sai',
    fill_blank: 'Điền từ khuyết',
    drag_drop_blank: 'Kéo thả từ vào ô',
    matching: 'Ghép đôi thuật ngữ'
  };

  const competencyBreakdown = Object.entries(typeMap).map(([key, label]) => {
    const list = questionResults.filter(q => q.type === key);
    if (list.length === 0) return null;
    const correct = list.filter(q => q.is_correct).length;
    const pct = Math.round((correct / list.length) * 100);
    return { key, label, total: list.length, correct, pct };
  }).filter(Boolean);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1800px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* 1. Top Banner / Hero */}
      <div style={{
        borderRadius: '8px',
        background: '#ffffff',
        border: '1px solid #eeeeee',
        padding: '1.5rem 2rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 400,
              color: '#333333',
              margin: '0 0 6px'
            }}>
              Hoàn thành bài kiểm tra: {quiz?.title || 'Bài tập Word'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555555' }}>
              <span>
                Thời gian nộp: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRetake}
              style={{ padding: '0.65rem 1.1rem', fontSize: '0.875rem', fontWeight: 400, borderRadius: '6px' }}
            >
              <RotateCcw size={16} /> Làm lại bài thi
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              style={{ padding: '0.65rem 1.1rem', fontSize: '0.875rem', fontWeight: 400, borderRadius: '6px' }}
            >
              Xuất kết quả PDF
            </button>

            {onEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEdit}
                style={{ padding: '0.65rem 1.1rem', fontSize: '0.875rem', fontWeight: 400, borderRadius: '6px' }}
              >
                <Edit3 size={16} /> Sửa câu hỏi
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onHome}
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: 400, borderRadius: '6px' }}
            >
              <Home size={16} /> Về trang chủ
            </button>
          </div>
        </div>
      </div>

      {/* 2. Score KPI Grid (4 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        {/* Card 1: Score & Rank */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              Tổng điểm đạt được
            </span>
            <span style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', fontWeight: 500 }}>
              Xếp loại: {rankLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
              {earnedScore}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
              / {totalScore} điểm
            </span>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary)' }} />
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            {percentage >= 65 ? 'Đạt yêu cầu chứng chỉ môn học (≥65đ)' : 'Cần rèn luyện thêm để vượt mốc 65%'}
          </div>
        </div>

        {/* Card 2: Accuracy & Count */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              Tỷ lệ chính xác
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
              {correctCount} / {questionResults.length} câu
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
              {percentage}%
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
              chuẩn đầu ra
            </span>
          </div>

          <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
            <div style={{ width: `${(correctCount / Math.max(1, questionResults.length)) * 100}%`, background: 'var(--success)' }} />
            <div style={{ width: `${(wrongCount / Math.max(1, questionResults.length)) * 100}%`, background: 'var(--danger)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Đúng: <strong style={{ color: 'var(--success)' }}>{correctCount}</strong></span>
            <span>Sai: <strong style={{ color: 'var(--danger)' }}>{wrongCount}</strong></span>
            <span>Bỏ: <strong style={{ color: 'var(--text-muted)' }}>{skippedCount}</strong></span>
          </div>
        </div>

        {/* Card 3: Wrong / Omitted breakdown */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              Cần cải thiện
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--danger)', lineHeight: 1 }}>
                {wrongCount}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Câu sai</span>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
            <div>
              <span style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1 }}>
                {skippedCount}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Bỏ trống</span>
            </div>
          </div>

          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
            fontSize: '0.775rem',
            fontWeight: 400
          }}>
            {wrongCount > 0 ? `Ôn lại ${wrongCount} câu sai để củng cố kiến thức` : 'Xuất sắc! Không có câu nào trả lời sai'}
          </div>
        </div>

        {/* Card 4: Pace / Speed */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              Tốc độ làm bài
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
              {avgPaceSec}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              giây / câu
            </span>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '65%', height: '100%', background: 'var(--primary)' }} />
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            Tốc độ xử lý tốt, đảm bảo thời gian quy định
          </div>
        </div>
      </div>

      {/* 3. 2-Column Split Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '1.75rem', alignItems: 'start' }}>
        {/* LEFT COLUMN: Detailed Review Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          {/* Section Header & Filter Tabs */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 400, color: '#333333', margin: 0 }}>
                Xem lại đáp án & Giải thích chi tiết
              </h2>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                onClick={() => setFilter('all')}
              >
                Tất cả ({questionResults.length})
              </button>
              <button
                className={`btn btn-sm ${filter === 'wrong' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                onClick={() => setFilter('wrong')}
              >
                Sai ({wrongCount})
              </button>
              <button
                className={`btn btn-sm ${filter === 'correct' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                onClick={() => setFilter('correct')}
              >
                Đúng ({correctCount})
              </button>
              <button
                className={`btn btn-sm ${filter === 'skipped' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', borderRadius: '4px' }}
                onClick={() => setFilter('skipped')}
              >
                Bỏ trống ({skippedCount})
              </button>
            </div>
          </div>

          {/* Question Cards Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredResults.map((q, idx) => {
              const isCorrect = q.is_correct;
              const hasAnswered = isAnswerGiven(q.user_answer);

              return (
                <div
                  key={q.question_id || idx}
                  id={`review-q-${q.order || idx + 1}`}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    border: '1px solid #eeeeee',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  {/* Question Meta Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        fontWeight: 400,
                        fontSize: '0.85rem',
                        color: '#333333',
                        border: '1px solid #eeeeee'
                      }}>
                        Câu {q.order || idx + 1}
                      </span>

                      {isCorrect ? (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '1px solid #15803d',
                          background: '#ffffff',
                          color: '#15803d',
                          fontSize: '11px',
                          fontWeight: 400
                        }}>
                          ✓ ĐÚNG
                        </span>
                      ) : hasAnswered ? (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '1px solid #b91c1c',
                          background: '#ffffff',
                          color: '#b91c1c',
                          fontSize: '11px',
                          fontWeight: 400
                        }}>
                          ✗ SAI
                        </span>
                      ) : (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '1px solid #eeeeee',
                          background: '#ffffff',
                          color: '#555555',
                          fontSize: '11px',
                          fontWeight: 400
                        }}>
                          BỎ TRỐNG
                        </span>
                      )}

                      <span style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #eeeeee', background: '#ffffff', color: '#555555', fontSize: '11px', fontWeight: 400}}>
                        {typeMap[q.type] || q.type}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#333333' }}>
                      {q.score} / {q.max_score} điểm
                    </span>
                  </div>

                  {/* Question Prompt */}
                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: 400,
                    color: '#333333',
                    lineHeight: 1.6,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    tabSize: 4,
                    fontFamily: (q.content || '').includes('\n') && /[{};=()<>\[\]]/.test(q.content)
                      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                      : 'inherit'
                  }}>
                    {cleanQuestionPrompt(q.content)}
                  </h3>

                  {/* Answer Breakdown Box */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '6px',
                    padding: '1rem 1.25rem',
                    border: '1px solid #eeeeee',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    fontSize: '0.9rem'
                  }}>
                    {(() => {
                      const userAnsText = renderAnswerValue(q.user_answer, q, quiz);
                      const isUserMulti = userAnsText.includes('\n');

                      const corrAnsText = renderCorrectAnswer(q, quiz);
                      const isCorrMulti = corrAnsText.includes('\n');

                      return (
                        <>
                          <div style={{
                            display: 'flex',
                            flexDirection: isUserMulti ? 'column' : 'row',
                            alignItems: isUserMulti ? 'flex-start' : 'baseline',
                            gap: isUserMulti ? '0.25rem' : '0.5rem'
                          }}>
                            <span style={{ fontWeight: 400, color: '#333333', flexShrink: 0 }}>Lựa chọn của bạn: </span>
                            <span style={{
                              color: isCorrect ? '#15803d' : '#b91c1c',
                              fontWeight: 400,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.5
                            }}>
                              {userAnsText || '(Chưa trả lời)'}
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            flexDirection: isCorrMulti ? 'column' : 'row',
                            alignItems: isCorrMulti ? 'flex-start' : 'baseline',
                            gap: isCorrMulti ? '0.25rem' : '0.5rem'
                          }}>
                            <span style={{ fontWeight: 400, color: '#333333', flexShrink: 0 }}>Đáp án đúng: </span>
                            <span style={{
                              color: '#333333',
                              fontWeight: 400,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.5
                            }}>
                              {corrAnsText}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Explanation Box */}
                  <div style={{
                    padding: '0.85rem 1.1rem',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #eeeeee',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ color: '#333333', fontSize: '0.85rem', fontWeight: 400}}>
                      Giải thích đáp án:
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#555555', margin: 0, lineHeight: 1.6 }}>
                      {q.explanation || `Đáp án chính xác được đối chiếu chuẩn xác theo tài liệu gốc.`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Matrix & Competency Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '5rem' }}>
          {/* Question Matrix Navigation */}
          <div className="card" style={{ padding: '1.25rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 400, color: '#333333' }}>Ma trận câu hỏi toàn bài</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: '#555555' }}>
                <span>Đúng: <strong style={{ color: '#333333' }}>{correctCount}</strong></span>
                <span>•</span>
                <span>Sai: <strong style={{ color: '#333333' }}>{wrongCount}</strong></span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '2px'
            }}>
              {questionResults.map((q, idx) => {
                const isCorrect = q.is_correct;
                const hasAnswered = isAnswerGiven(q.user_answer);

                let border = '1px solid #eeeeee';
                let col = '#333333';
                let bg = '#ffffff';
                if (isCorrect) {
                  border = '1px solid #15803d';
                  col = '#15803d';
                  bg = '#ffffff';
                } else if (hasAnswered) {
                  border = '1px solid #b91c1c';
                  col = '#b91c1c';
                  bg = '#ffffff';
                }

                return (
                  <button
                    key={q.question_id || idx}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`review-q-${q.order || idx + 1}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      height: '34px',
                      borderRadius: '4px',
                      border: border,
                      background: bg,
                      color: col,
                      fontWeight: 400,
                      fontSize: '0.825rem',
                      cursor: 'pointer'
                    }}
                    title={`Xem Câu ${q.order || idx + 1}`}
                  >
                    {q.order || idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Competency Analysis Card */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 400, color: '#333333', margin: 0 }}>
                Năng lực theo dạng bài
              </h3>
              <span style={{ fontSize: '11px', color: '#555555', fontWeight: 400}}>{competencyBreakdown.length} dạng câu</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {competencyBreakdown.map((item) => (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                    <span style={{ fontWeight: 400, color: '#333333' }}>{item.label}</span>
                    <span style={{ fontWeight: 400, color: '#333333' }}>{item.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#ffffff', border: '1px solid #eeeeee', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      background: '#333333'
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#555555' }}>
                    Đạt {item.correct}/{item.total} câu
                  </span>
                </div>
              ))}
            </div>

            {/* Overall Rating Card */}
            <div style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid #eeeeee', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 400, color: '#333333' }}>Đánh giá chung: {rankLabel}</div>
              <div style={{ fontSize: '11px', color: '#555555', marginTop: '2px' }}>Đạt {percentage}% tổng điểm yêu cầu</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatOptionWithDetail(label, options) {
  if (!options || !Array.isArray(options) || options.length === 0) return String(label ?? '');
  const cleanLabel = String(label ?? '').trim().toUpperCase();
  const opt = options.find(o => String(o?.label ?? '').trim().toUpperCase() === cleanLabel);
  if (!opt) return String(label ?? '');

  const rawText = (opt.text !== undefined && opt.text !== null && String(opt.text).trim() !== '')
    ? String(opt.text).trim()
    : String(opt.full_text || '').trim();

  if (!rawText) return opt.label || String(label ?? '');

  const strippedText = cleanOptionText(rawText, opt.label);
  if (!strippedText) return opt.label || String(label ?? '');

  if (strippedText.includes('\n')) {
    return `${opt.label}.\n${strippedText}`;
  }
  return `${opt.label}. ${strippedText}`;
}

function renderCorrectAnswer(q, quiz = null) {
  const options = q?.options || quiz?.questions?.find(qq => qq.id === q?.question_id || qq.order === q?.order)?.options || [];

  if (q.type === 'drag_drop_blank' && q.items && q.items.length > 0) {
    return q.items.map(it => {
      const answersList = (it.correctAnswers && it.correctAnswers.length > 0)
        ? it.correctAnswers.join(', ')
        : (it.correctAnswer || '(trống)');
      return `Vị trí ${it.blank}: ${answersList}`;
    }).join('\n');
  }

  if (q.type === 'fill_blank' && Array.isArray(q.correct_answers) && q.correct_answers.length > 1) {
    return q.correct_answers.map((ans, idx) => `Ô ${idx + 1}: ${ans || '(trống)'}`).join(' | ');
  }

  if (q.type === 'true_false' && q.statements && q.statements.length > 0) {
    return q.statements.map((st, i) => {
      const stLabel = st.content ? st.content.trim() : `Mệnh đề ${i + 1}`;
      return `${stLabel} ➔ ${st.correctAnswer}`;
    }).join('\n');
  }

  if (q.type === 'matching' && Array.isArray(q.correct_answers)) {
    return q.correct_answers.join('\n');
  }

  return renderAnswerValue(q.correct_answers, q, quiz);
}

function renderAnswerValue(val, question = null, quiz = null) {
  if (val === undefined || val === null || val === '') return '';

  const options = question?.options || quiz?.questions?.find(qq => qq.id === question?.question_id || qq.order === question?.order)?.options || [];

  // 1. Array of answers
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    if (options.length > 0) {
      return val.map(item => formatOptionWithDetail(item, options)).join('\n');
    }
    return val.join(', ');
  }

  // 2. Object values
  if (typeof val === 'object') {
    if (question?.type === 'true_false' && question?.statements && question.statements.length > 0) {
      return question.statements.map((st, i) => {
        const stKey = st.id || String(st.order);
        const uVal = val[stKey] || val[st.id] || val[String(st.order)] || val[st.order] || '(Chưa chọn)';
        const stLabel = st.content ? st.content.trim() : `Mệnh đề ${i + 1}`;
        return `${stLabel} ➔ ${uVal}`;
      }).join('\n');
    }

    if (question?.type === 'matching') {
      return Object.entries(val).map(([k, v]) => `${k} → ${v || '(chưa ghép)'}`).join('\n');
    }

    const isDragDrop = question?.type === 'drag_drop_blank';
    const isFillBlank = question?.type === 'fill_blank';
    return Object.entries(val).map(([k, v]) => {
      const vStr = Array.isArray(v) ? v.join(', ') : String(v || '');
      const isNum = !isNaN(Number(k));
      const prefix = isDragDrop ? `Vị trí ${k}` : (isFillBlank ? `Ô ${k}` : (isNum ? `Câu ${k}` : `[${k}]`));
      return `${prefix}: ${vStr || '(trống)'}`;
    }).join(isDragDrop ? '\n' : ' | ');
  }

  // 3. Single string answer
  if (options.length > 0) {
    return formatOptionWithDetail(val, options);
  }

  return String(val);
}
