import React, { useState, useEffect } from 'react';
import {
  Clock, ArrowLeft, ArrowRight, CheckCircle2,
  Send, Grid, X, Edit3, Shuffle
} from './UIcons';

export default function QuizPlayer({ quiz, onSubmit, onExit, onEdit }) {
  const [questions, setQuestions] = useState(quiz.questions || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);

  const [selectedMatchLeft, setSelectedMatchLeft] = useState(null);
  const [activeBlank, setActiveBlank] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex] || {};
  const currentAnswer = answers[currentQ.id];

  const handleSingleChoice = (label) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: label }));
  };

  const handleMultiChoice = (label) => {
    const currentList = prevList(currentQ.id);
    const set = new Set(currentList);
    if (set.has(label)) {
      set.delete(label);
    } else {
      set.add(label);
    }
    setAnswers(prev => ({ ...prev, [currentQ.id]: Array.from(set) }));
  };

  const prevList = (qId) => {
    const v = answers[qId];
    return Array.isArray(v) ? v : [];
  };

  const handleStatementAnswer = (stId, val) => {
    const currentMap = answers[currentQ.id] || {};
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...currentMap,
        [stId]: val
      }
    }));
  };

  const handleFillBlank = (text) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: text }));
  };

  const handleSlotPlace = (blankNum, word) => {
    if (!word) return;
    setAnswers(prev => {
      const currentMap = prev[currentQ.id] || {};
      const existingRaw = currentMap[blankNum];
      const currentList = Array.isArray(existingRaw)
        ? [...existingRaw]
        : (existingRaw ? [existingRaw] : []);

      if (!currentList.includes(word)) {
        currentList.push(word);
      }
      return {
        ...prev,
        [currentQ.id]: {
          ...currentMap,
          [blankNum]: currentList
        }
      };
    });
  };

  const handleSlotRemoveWord = (blankNum, wordToRemove) => {
    setAnswers(prev => {
      const currentMap = prev[currentQ.id] || {};
      const existingRaw = currentMap[blankNum];
      const currentList = Array.isArray(existingRaw)
        ? existingRaw
        : (existingRaw ? [existingRaw] : []);
      const updatedList = currentList.filter(w => w !== wordToRemove);
      return {
        ...prev,
        [currentQ.id]: {
          ...currentMap,
          [blankNum]: updatedList
        }
      };
    });
  };

  const handleSlotClear = (blankNum) => {
    setAnswers(prev => {
      const currentMap = { ...(prev[currentQ.id] || {}) };
      delete currentMap[blankNum];
      return {
        ...prev,
        [currentQ.id]: currentMap
      };
    });
  };

  const handleMatchPair = (leftId, rightText) => {
    const currentMap = answers[currentQ.id] || {};
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...currentMap,
        [leftId]: rightText
      }
    }));
    setSelectedMatchLeft(null);
  };

  const handleClearMatch = (leftId) => {
    const currentMap = { ...(answers[currentQ.id] || {}) };
    delete currentMap[leftId];
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: currentMap
    }));
  };

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // 1. ĐẢO TẤT CẢ CÂU HỎI (Shuffle Questions)
  const handleShuffleQuestions = () => {
    if (questions.length < 2) return;
    const currentQId = questions[currentIndex]?.id;
    const shuffled = shuffleArray(questions);
    const renumbered = shuffled.map((q, idx) => ({
      ...q,
      order: idx + 1
    }));
    setQuestions(renumbered);
    if (currentQId) {
      const newIdx = renumbered.findIndex(q => q.id === currentQId);
      if (newIdx !== -1) {
        setCurrentIndex(newIdx);
      }
    }
    showToast(`🔀 Đã đảo thứ tự tất cả ${questions.length} câu hỏi! Trạng thái được giữ nguyên khi làm bài.`);
  };

  // 2. ĐẢO TẤT CẢ ĐÁP ÁN (Shuffle All Answers)
  const handleShuffleAllAnswers = () => {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const newAnswers = { ...answers };

    const updatedQuestions = questions.map((q) => {
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const opts = q.options || [];
        if (opts.length >= 2) {
          const userAns = answers[q.id];
          let selectedText = null;
          let selectedTexts = [];
          if (q.type === 'single_choice' && userAns) {
            const found = opts.find(o => o.label === userAns);
            if (found) selectedText = found.text;
          } else if (q.type === 'multiple_choice' && Array.isArray(userAns)) {
            selectedTexts = opts.filter(o => userAns.includes(o.label)).map(o => o.text);
          }

          const shuffledOpts = shuffleArray(opts);
          const newOpts = shuffledOpts.map((opt, idx) => {
            const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
            return {
              ...opt,
              label: newLabel,
              full_text: `${newLabel}. ${opt.text || ''}`
            };
          });

          const newCorrect = newOpts.filter(o => o.highlighted).map(o => o.label);

          if (q.type === 'single_choice' && selectedText) {
            const newOpt = newOpts.find(o => o.text === selectedText);
            if (newOpt) {
              newAnswers[q.id] = newOpt.label;
            }
          } else if (q.type === 'multiple_choice' && selectedTexts.length > 0) {
            const newLabels = newOpts.filter(o => selectedTexts.includes(o.text)).map(o => o.label);
            newAnswers[q.id] = newLabels;
          }

          return {
            ...q,
            options: newOpts,
            correctAnswers: newCorrect
          };
        }
      } else if (q.type === 'drag_drop_blank') {
        const currentBank = (q.bank && q.bank.length > 0)
          ? q.bank
          : (q.items || []).map(it => it.correctAnswer).filter(Boolean);
        if (currentBank.length >= 2) {
          return {
            ...q,
            bank: shuffleArray(currentBank)
          };
        }
      } else if (q.type === 'matching') {
        const pairs = q.pairs || [];
        if (pairs.length >= 2) {
          const shuffledPairs = shuffleArray(pairs);
          return {
            ...q,
            pairs: shuffledPairs,
            correctAnswers: shuffledPairs.map(p => `${p.left} → ${p.right}`)
          };
        }
      }
      return q;
    });

    setQuestions(updatedQuestions);
    setAnswers(newAnswers);
    showToast(`Đã đảo ngẫu nhiên toàn bộ đáp án của tất cả câu hỏi! Trạng thái được giữ nguyên khi chuyển câu.`);
  };



  const isQuestionAnswered = (q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return false;
    if (q.type === 'single_choice' || q.type === 'fill_blank') {
      return String(ans).trim().length > 0;
    }
    if (q.type === 'multiple_choice') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'true_false') {
      const statements = q.statements || [];
      if (statements.length === 0) return Boolean(ans);
      const ansObj = typeof ans === 'object' ? ans : {};
      return statements.every(s => ansObj[s.id || String(s.order)]);
    }
    if (q.type === 'drag_drop_blank') {
      const items = q.items || [];
      const ansObj = typeof ans === 'object' ? ans : {};
      return items.some(it => {
        const v = ansObj[it.blank];
        return Array.isArray(v) ? v.length > 0 : Boolean(v);
      });
    }
    if (q.type === 'matching') {
      const pairs = q.pairs || [];
      const ansObj = typeof ans === 'object' ? ans : {};
      return pairs.some(p => ansObj[p.id || p.left]);
    }
    return Boolean(ans);
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    setShowConfirmModal(false);
    onSubmit(answers, questions);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Quiz Top Header */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem 1.75rem',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bài kiểm tra trực tuyến
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.15rem 0' }}>
              {quiz.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#ffffff',
              border: '1px solid #ddd6fe',
              padding: '0.45rem 0.85rem',
              borderRadius: '10px',
              fontWeight: 700,
              color: '#7c3aed',
              fontSize: '0.95rem'
            }}>
              <Clock size={18} style={{ color: '#7c3aed' }} />
              {formatTime(secondsElapsed)}
            </div>

            {onEdit && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onEdit}
                style={{ background: '#f5f3ff', borderColor: '#ddd6fe', color: '#7c3aed', fontWeight: 600 }}
                title="Quay lại màn hình chỉnh sửa câu hỏi và đáp án"
              >
                <Edit3 size={15} /> Sửa câu & đáp án
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleShuffleQuestions}
              style={{ background: '#f5f3ff', borderColor: '#ddd6fe', color: '#7c3aed', fontWeight: 600 }}
              title="Đảo ngẫu nhiên thứ tự các câu hỏi trong đề thi"
            >
              <Shuffle size={15} style={{ color: '#7c3aed' }} /> Đảo câu hỏi
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleShuffleAllAnswers}
              style={{ background: '#f5f3ff', borderColor: '#ddd6fe', color: '#7c3aed', fontWeight: 600 }}
              title="Đảo ngẫu nhiên toàn bộ đáp án của tất cả câu hỏi (giữ nguyên khi chuyển câu)"
            >
              <Shuffle size={15} style={{ color: '#7c3aed' }} /> Đảo tất cả đáp án
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowNavDrawer(true)}
              title="Danh sách câu hỏi"
            >
              <Grid size={16} /> Bảng câu hỏi ({answeredCount}/{questions.length})
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: '#64748b', marginBottom: '0.35rem' }}>
            <span>Tiến độ làm bài: {answeredCount}/{questions.length} câu</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          background: '#f5f3ff',
          border: '1.5px solid #c4b5fd',
          color: '#5b21b6',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <Shuffle size={18} style={{ color: '#7c3aed', flexShrink: 0 }} /> {toastMessage}
        </div>
      )}

      {/* Main Question Card */}
      <div className="card" style={{ padding: '2rem', minHeight: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              background: '#f5f3ff',
              color: '#7c3aed',
              fontWeight: 800,
              fontSize: '1rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd6fe'
            }}>
              Câu {currentIndex + 1} / {questions.length}
            </span>

            <span className="badge badge-neutral" style={{ fontSize: '0.8rem' }}>
              {currentQ.type === 'single_choice' && 'Chọn 1 đáp án'}
              {currentQ.type === 'multiple_choice' && 'Chọn nhiều đáp án'}
              {currentQ.type === 'true_false' && 'Đúng / Sai'}
              {currentQ.type === 'fill_blank' && 'Điền từ vào chỗ trống'}
              {currentQ.type === 'drag_drop_blank' && 'Kéo thả từ vào ô trống'}
              {currentQ.type === 'matching' && 'Ghép đôi thuật ngữ - định nghĩa'}
            </span>
          </div>

          {isQuestionAnswered(currentQ) && (
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              <CheckCircle2 size={13} /> Đã trả lời
            </span>
          )}
        </div>

        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: (currentQ.content || '').includes('\n') ? 600 : 700,
          color: '#0f172a',
          lineHeight: 1.6,
          marginBottom: '1.75rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          tabSize: 4,
          fontFamily: (currentQ.content || '').includes('\n')
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'inherit'
        }}>
          {currentQ.content}
        </h3>

        {/* 1. SINGLE CHOICE */}
        {currentQ.type === 'single_choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(currentQ.options || []).map(opt => {
              const isSelected = currentAnswer === opt.label;
              return (
                <div
                  key={opt.label}
                  onClick={() => handleSingleChoice(opt.label)}
                  className={`option-item ${isSelected ? 'selected' : ''}`}
                >
                  <div className="option-badge">
                    {opt.label}
                  </div>
                  <span style={{
                    fontSize: '1rem',
                    color: isSelected ? '#7c3aed' : '#1e293b',
                    fontWeight: isSelected ? 600 : 400,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                    tabSize: 4,
                    fontFamily: (opt.text || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'inherit'
                  }}>
                    {opt.text || opt.full_text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. MULTIPLE CHOICE */}
        {currentQ.type === 'multiple_choice' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem', fontStyle: 'italic' }}>
              * Chọn tất cả các phương án bạn cho là đúng
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(currentQ.options || []).map(opt => {
                const selectedList = prevList(currentQ.id);
                const isSelected = selectedList.includes(opt.label);
                return (
                  <div
                    key={opt.label}
                    onClick={() => handleMultiChoice(opt.label)}
                    className={`option-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="option-badge">
                      {opt.label}
                    </div>
                    <span style={{
                      fontSize: '1rem',
                      color: isSelected ? '#7c3aed' : '#1e293b',
                      fontWeight: isSelected ? 600 : 400,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                      tabSize: 4,
                      fontFamily: (opt.text || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'inherit'
                    }}>
                      {opt.text || opt.full_text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TRUE / FALSE */}
        {currentQ.type === 'true_false' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(currentQ.statements || []).map((st) => {
              const stKey = st.id || String(st.order);
              const userStVal = (answers[currentQ.id] || {})[stKey];

              return (
                <div
                  key={stKey}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 500, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {st.content}
                  </span>

                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <button
                      type="button"
                      className={`btn ${userStVal === 'Đúng' ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => handleStatementAnswer(stKey, 'Đúng')}
                      style={{ minWidth: '85px' }}
                    >
                      Đúng {userStVal === 'Đúng' && '✓'}
                    </button>
                    <button
                      type="button"
                      className={`btn ${userStVal === 'Sai' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => handleStatementAnswer(stKey, 'Sai')}
                      style={{ minWidth: '85px' }}
                    >
                      Sai {userStVal === 'Sai' && '✓'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. FILL BLANK */}
        {currentQ.type === 'fill_blank' && (
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              Nhập câu trả lời của bạn vào ô bên dưới:
            </label>
            <input
              type="text"
              value={currentAnswer || ''}
              onChange={(e) => handleFillBlank(e.target.value)}
              placeholder="Gõ từ hoặc cụm từ đáp án..."
              style={{
                width: '100%',
                padding: '0.85rem 1.15rem',
                fontSize: '1.1rem',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>
        )}

        {/* 5. DRAG & DROP BLANK */}
        {currentQ.type === 'drag_drop_blank' && (() => {
          const availableItems = currentQ.items || [];
          const currentActiveBlank = (activeBlank && availableItems.some(it => it.blank === activeBlank))
            ? activeBlank
            : (availableItems.length > 0 ? availableItems[0].blank : 1);

          return (
            <div>
              <div style={{
                background: '#ffffff',
                padding: '1.15rem',
                borderRadius: '14px',
                border: '1.5px solid #ddd6fe',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                  {(currentQ.bank && currentQ.bank.length > 0
                    ? currentQ.bank
                    : (currentQ.items || []).flatMap(it => it.correctAnswers || (it.correctAnswer ? [it.correctAnswer] : []))
                  ).map((word, wIdx) => {
                    const allPlacedWords = Object.values(answers[currentQ.id] || {}).flatMap(v => Array.isArray(v) ? v : (v ? [v] : []));
                    const usedInSlots = allPlacedWords.includes(word);
                    return (
                      <div
                        key={wIdx}
                        className={`drag-chip ${usedInSlots ? 'placed' : ''}`}
                        draggable={!usedInSlots}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', word)}
                        onClick={() => {
                          const currentMap = answers[currentQ.id] || {};
                          if (usedInSlots) {
                            for (const [bNum, val] of Object.entries(currentMap)) {
                              const list = Array.isArray(val) ? val : (val ? [val] : []);
                              if (list.includes(word)) {
                                handleSlotRemoveWord(bNum, word);
                                return;
                              }
                            }
                          } else {
                            handleSlotPlace(currentActiveBlank, word);
                          }
                        }}
                        title={usedInSlots ? 'Đã được đặt vào câu (bấm để gỡ bỏ)' : `Kéo hoặc bấm để đưa vào Vị trí ${currentActiveBlank}`}
                      >
                        {word}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(currentQ.items || []).map((it) => {
                  const rawVal = (answers[currentQ.id] || {})[it.blank];
                  const filledWords = Array.isArray(rawVal) ? rawVal : (rawVal ? [rawVal] : []);
                  const isActive = currentActiveBlank === it.blank;

                  return (
                    <div
                      key={it.blank}
                      onClick={() => setActiveBlank(it.blank)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        padding: '1.15rem 1.25rem',
                        background: isActive ? '#f5f3ff' : '#ffffff',
                        borderRadius: '12px',
                        border: isActive ? '2px solid #7c3aed' : '1.5px solid #ddd6fe',
                        boxShadow: isActive ? '0 0 0 3px rgba(124, 58, 237, 0.15)' : 'var(--shadow-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span className={`badge ${isActive ? 'badge-blue' : 'badge-gray'}`} style={{ fontWeight: 800 }}>
                            Vị trí {it.blank}
                          </span>
                          {isActive && (
                            <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700, background: '#ffffff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: '6px' }}>
                              Đang nhận từ
                            </span>
                          )}
                          <span style={{ fontSize: '0.975rem', color: '#1e293b', fontWeight: 600 }}>
                            {it.text || `Chỗ trống số ${it.blank}`}
                          </span>
                        </div>
                        {filledWords.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSlotClear(it.blank);
                            }}
                            style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#64748b' }}
                            title="Xóa toàn bộ các từ trong câu này"
                          >
                            Xóa tất cả ({filledWords.length})
                          </button>
                        )}
                      </div>

                      <div
                        className={`drop-slot ${filledWords.length > 0 ? 'filled' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('drag-over');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('drag-over');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('drag-over');
                          const word = e.dataTransfer.getData('text/plain');
                          if (word) {
                            handleSlotPlace(it.blank, word);
                            setActiveBlank(it.blank);
                          }
                        }}
                        style={{ width: '100%', minHeight: '52px', cursor: 'default' }}
                      >
                        {filledWords.map((word, wIdx) => (
                          <span key={wIdx} className="drop-slot-badge">
                            <span>{word}</span>
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSlotRemoveWord(it.blank, word);
                              }}
                              title="Gỡ bỏ đáp án này"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}

                        <span style={{
                          fontSize: '0.825rem',
                          color: filledWords.length > 0 ? '#7c3aed' : '#94a3b8',
                          fontStyle: 'italic',
                          padding: '0 4px',
                          userSelect: 'none'
                        }}>
                          {filledWords.length === 0 ? '[ Kéo thả hoặc bấm từ để điền vào đây ]' : '+ Kéo thêm hoặc bấm từ để thêm vào đây'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 6. MATCHING */}
        {currentQ.type === 'matching' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', fontStyle: 'italic' }}>
              * Chọn một thuật ngữ ở cột trái, sau đó chọn định nghĩa tương ứng ở cột phải để ghép cặp.
            </p>

            <div className="match-grid">
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  Cột A: Thuật ngữ
                </span>
                {(currentQ.pairs || []).map((pair) => {
                  const pairId = pair.id || pair.left;
                  const isSelected = selectedMatchLeft === pairId;
                  const matchedRight = (answers[currentQ.id] || {})[pairId];

                  return (
                    <div
                      key={pairId}
                      className={`match-left-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedMatchLeft(isSelected ? null : pairId)}
                    >
                      <div>
                        <div>{pair.left}</div>
                        {matchedRight && (
                          <div style={{ fontSize: '0.775rem', color: '#059669', marginTop: '0.2rem', fontWeight: 500 }}>
                            ✓ Đã ghép với: {matchedRight.substring(0, 32)}...
                          </div>
                        )}
                      </div>
                      {matchedRight && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearMatch(pairId);
                          }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          title="Hủy ghép"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  Cột B: Định nghĩa
                </span>
                {(currentQ.pairs || []).map((pair, rIdx) => {
                  const rightText = pair.right;
                  const currentAnswerMap = answers[currentQ.id] || {};
                  const isMatched = Object.values(currentAnswerMap).includes(rightText);

                  return (
                    <div
                      key={rIdx}
                      className={`match-right-slot ${selectedMatchLeft ? 'targeted' : ''} ${isMatched ? 'matched' : ''}`}
                      onClick={() => {
                        if (selectedMatchLeft) {
                          handleMatchPair(selectedMatchLeft, rightText);
                        }
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                        {rightText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{
        marginTop: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
        >
          <ArrowLeft size={16} /> Câu trước
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {currentIndex < questions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            >
              Câu tiếp theo <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={handleSubmitClick}
              style={{ padding: '0.65rem 1.75rem' }}
            >
              <Send size={16} /> Nộp bài thi
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
              Xác nhận nộp bài thi
            </h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Bạn đã hoàn thành <strong>{answeredCount} / {questions.length}</strong> câu hỏi.
              {answeredCount < questions.length && (
                <span style={{ display: 'block', color: '#d97706', marginTop: '0.5rem', fontWeight: 600 }}>
                  ⚠ Còn {questions.length - answeredCount} câu chưa có câu trả lời!
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Tiếp tục làm bài
              </button>
              <button className="btn btn-success" onClick={confirmSubmit}>
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {showNavDrawer && (
        <div className="modal-backdrop" onClick={() => setShowNavDrawer(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Bảng câu hỏi ({answeredCount}/{questions.length} đã làm)
              </h3>
              <button
                onClick={() => setShowNavDrawer(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
              gap: '0.5rem',
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '0.25rem'
            }}>
              {questions.map((q, idx) => {
                const isAnswered = isQuestionAnswered(q);
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowNavDrawer(false);
                    }}
                    style={{
                      height: '44px',
                      borderRadius: '8px',
                      border: isCurrent ? '2px solid #7c3aed' : '1px solid #ddd6fe',
                      background: isAnswered ? '#10b981' : isCurrent ? '#f5f3ff' : '#ffffff',
                      color: isAnswered ? '#ffffff' : isCurrent ? '#7c3aed' : '#334155',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

