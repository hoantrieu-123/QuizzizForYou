import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy, CheckCircle2, XCircle, RotateCcw,
  Edit3, Home, Sparkles
} from './UIcons';

export default function ResultView({ result, quiz, onRetake, onEdit, onHome }) {
  const [filter, setFilter] = useState('all');

  const earnedScore = result?.earned_score || 0;
  const totalScore = result?.total_score || 1;
  const percentage = result?.percentage || 0;
  const questionResults = result?.question_results || [];

  useEffect(() => {
    if (percentage >= 75) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [percentage]);

  const correctCount = questionResults.filter(q => q.is_correct).length;
  const wrongCount = questionResults.length - correctCount;

  const filteredResults = questionResults.filter(q => {
    if (filter === 'correct') return q.is_correct;
    if (filter === 'wrong') return !q.is_correct;
    return true;
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div className="card" style={{
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        marginBottom: '2rem',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: percentage >= 70 ? '#ecfdf5' : '#fffbeb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          color: percentage >= 70 ? '#059669' : '#d97706'
        }}>
          <Trophy size={38} />
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
          Kết quả bài làm: {quiz?.title}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Đã hoàn thành bài kiểm tra và tự động chấm điểm theo nguồn dữ liệu Word.
        </p>

        <div style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '0.5rem',
          background: '#ffffff',
          padding: '0.85rem 2rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '1.5rem'
        }}>
          <span style={{ fontSize: '3rem', fontWeight: 800, color: percentage >= 70 ? '#059669' : '#d97706', lineHeight: 1 }}>
            {earnedScore}
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 600, color: '#94a3b8' }}>
            / {totalScore} điểm ({percentage}%)
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          marginTop: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: 600 }}>
            <CheckCircle2 size={18} /> {correctCount} câu trả lời đúng
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626', fontWeight: 600 }}>
            <XCircle size={18} /> {wrongCount} câu trả lời sai / chưa trọn vẹn
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onRetake}>
            <RotateCcw size={16} /> Làm lại bài
          </button>
          <button className="btn btn-secondary" onClick={onEdit}>
            <Edit3 size={16} /> Chỉnh sửa câu hỏi
          </button>
          <button className="btn btn-secondary" onClick={onHome}>
            <Home size={16} /> Về trang chủ
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          Chi tiết kết quả từng câu hỏi
        </h3>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            Tất cả ({questionResults.length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'correct' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('correct')}
          >
            Đúng ({correctCount})
          </button>
          <button
            className={`btn btn-sm ${filter === 'wrong' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('wrong')}
          >
            Sai ({wrongCount})
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredResults.map((q, idx) => {
          return (
            <div
              key={q.question_id || idx}
              className="card"
              style={{
                borderLeft: q.is_correct ? '4px solid #10b981' : '4px solid #ef4444'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: q.is_correct ? '#ecfdf5' : '#fef2f2',
                    color: q.is_correct ? '#059669' : '#dc2626',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem'
                  }}>
                    {q.order || idx + 1}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                    Câu {q.order || idx + 1}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                    {q.type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${q.is_correct ? 'badge-success' : 'badge-warning'}`}>
                    Điểm: {q.score} / {q.max_score}
                  </span>
                </div>
              </div>

              <p style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '1rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                tabSize: 4,
                fontFamily: (q.content || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'inherit'
              }}>
                {q.content}
              </p>

              <div style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                fontSize: '0.925rem'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#475569' }}>Lựa chọn của bạn: </span>
                  <span style={{
                    color: q.is_correct ? '#059669' : '#dc2626',
                    fontWeight: 600,
                    whiteSpace: 'pre-wrap',
                    tabSize: 4,
                    fontFamily: String(renderAnswerValue(q.user_answer, q) || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                  }}>
                    {renderAnswerValue(q.user_answer, q) || '(Chưa trả lời)'}
                  </span>
                </div>

                <div>
                  <span style={{ fontWeight: 700, color: '#475569' }}>Đáp án đúng: </span>
                  <span style={{
                    color: '#059669',
                    fontWeight: 700,
                    whiteSpace: 'pre-wrap',
                    tabSize: 4,
                    fontFamily: String(renderCorrectAnswer(q) || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                  }}>
                    {renderCorrectAnswer(q)}
                  </span>
                </div>

                <div style={{ marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <span className="badge badge-highlight" style={{ fontSize: '0.775rem' }}>
                    <Sparkles size={13} /> Nguồn xác định: {q.highlight_source || 'Đọc thuộc tính Highlight từ file Word .docx'}
                  </span>
                  {q.explanation && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.825rem', color: '#64748b' }}>
                      {q.explanation}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderCorrectAnswer(q) {
  if (q.type === 'drag_drop_blank' && q.items && q.items.length > 0) {
    return q.items.map(it => {
      const answersList = (it.correctAnswers && it.correctAnswers.length > 0)
        ? it.correctAnswers.join(', ')
        : (it.correctAnswer || '(trống)');
      return `Vị trí ${it.blank}: ${answersList}`;
    }).join(' | ');
  }
  if (q.type === 'fill_blank' && Array.isArray(q.correct_answers) && q.correct_answers.length > 1) {
    return q.correct_answers.map((ans, idx) => `Ô ${idx + 1}: ${ans || '(trống)'}`).join(' | ');
  }
  return renderAnswerValue(q.correct_answers, q);
}

function renderAnswerValue(val, question = null) {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') {
    const isDragDrop = question?.type === 'drag_drop_blank';
    const isFillBlank = question?.type === 'fill_blank';
    return Object.entries(val).map(([k, v]) => {
      const vStr = Array.isArray(v) ? v.join(', ') : String(v);
      const isNum = !isNaN(Number(k));
      const prefix = isDragDrop ? `Vị trí ${k}` : (isFillBlank ? `Ô ${k}` : (isNum ? `Câu ${k}` : `[${k}]`));
      return `${prefix}: ${vStr || '(trống)'}`;
    }).join(' | ');
  }
  return String(val);
}

