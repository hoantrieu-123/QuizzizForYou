import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy, CheckCircle2, XCircle, RotateCcw,
  Edit3, Home, Sparkles
} from './UIcons';
import { cleanQuestionPrompt } from './QuizPlayer';

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
                {cleanQuestionPrompt(q.content)}
              </p>

              <div style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.925rem'
              }}>
                {(() => {
                  const userAnsText = renderAnswerValue(q.user_answer, q, quiz);
                  const isUserMulti = userAnsText.includes('\n');
                  const isUserCode = isUserMulti || (q.content || '').includes('\n');

                  const corrAnsText = renderCorrectAnswer(q, quiz);
                  const isCorrMulti = corrAnsText.includes('\n');
                  const isCorrCode = isCorrMulti || (q.content || '').includes('\n');

                  return (
                    <>
                      <div style={{
                        display: 'flex',
                        flexDirection: isUserMulti ? 'column' : 'row',
                        alignItems: isUserMulti ? 'flex-start' : 'baseline',
                        gap: isUserMulti ? '0.35rem' : '0.5rem'
                      }}>
                        <span style={{ fontWeight: 700, color: '#475569', flexShrink: 0 }}>Lựa chọn của bạn: </span>
                        <span style={{
                          color: q.is_correct ? '#059669' : '#dc2626',
                          fontWeight: 600,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                          tabSize: 4,
                          fontFamily: isUserCode ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                        }}>
                          {userAnsText || '(Chưa trả lời)'}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: isCorrMulti ? 'column' : 'row',
                        alignItems: isCorrMulti ? 'flex-start' : 'baseline',
                        gap: isCorrMulti ? '0.35rem' : '0.5rem'
                      }}>
                        <span style={{ fontWeight: 700, color: '#475569', flexShrink: 0 }}>Đáp án đúng: </span>
                        <span style={{
                          color: '#059669',
                          fontWeight: 700,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                          tabSize: 4,
                          fontFamily: isCorrCode ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                        }}>
                          {corrAnsText}
                        </span>
                      </div>
                    </>
                  );
                })()}

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

function formatOptionWithDetail(label, options) {
  if (!options || !Array.isArray(options) || options.length === 0) return String(label ?? '');
  const cleanLabel = String(label ?? '').trim().toUpperCase();
  const opt = options.find(o => String(o?.label ?? '').trim().toUpperCase() === cleanLabel);
  if (!opt) return String(label ?? '');

  const rawText = (opt.text !== undefined && opt.text !== null && String(opt.text).trim() !== '')
    ? String(opt.text).trim()
    : String(opt.full_text || '').trim();

  if (!rawText) return opt.label || String(label ?? '');

  // Strip leading option prefix like "A.", "A)", "[A]", "(A)" if present to avoid "A. A. Content"
  const strippedText = rawText.replace(new RegExp(`^(\\[?${opt.label}\\]?|[\\(]?${opt.label}[\\)]?)[\\.\\:\\-\\)]?\\s*`, 'i'), '').trim();

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

  // 1. Array of answers (multiple choice, etc.)
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    if (options.length > 0) {
      return val.map(item => formatOptionWithDetail(item, options)).join('\n');
    }
    return val.join(', ');
  }

  // 2. Object values (true_false with statements, matching, drag_drop, multi-fill)
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

  // 3. Single string answer with options (single choice)
  if (options.length > 0) {
    return formatOptionWithDetail(val, options);
  }

  return String(val);
}

