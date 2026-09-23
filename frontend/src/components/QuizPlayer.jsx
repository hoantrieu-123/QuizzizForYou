import React, { useState, useEffect } from 'react';
import {
  Clock, ArrowLeft, ArrowRight, CheckCircle2,
  Send, Grid, X, Edit3, Shuffle
} from './UIcons';

export const cleanQuestionPrompt = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/^(?:(?:Câu|Question|Bài)\s*\d+[\s\:\.\-]*|\d+[\.\)\-]\s+)\s*\n?/i, '')
    .trim();
};

export const cleanOptionText = (text, label) => {
  if (!text) return '';
  const s = String(text).trim();
  if (!label && !s) return s;

  if (label) {
    const esc = String(label).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (esc) {
      const specificRegex = new RegExp(`^(?:\\[\\s*${esc}\\s*\\]|\\(\\s*${esc}\\s*\\)|${esc}\\s*[\\.\\:\\-\\)\\>])[\\.\\:\\-\\)]?\\s*`, 'i');
      if (specificRegex.test(s)) {
        return s.replace(specificRegex, '').trim();
      }
    }
  }

  const genericPrefixRegex = /^(?:\[\s*[a-zA-Z\d]{1,2}\s*\]|\(\s*[a-zA-Z\d]{1,2}\s*\)|[a-zA-Z\d]{1,2}\s*[\.\:\-\)\>])[\\.\:\-\)]?\s+/;
  return s.replace(genericPrefixRegex, '').trim();
};

export const cleanItemText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/^\s*(?:(?:Câu|Vị trí|Mục|Slot|Item)\s*\d+[\s\:\.\-]*|(?:\([a-zA-Z\d]{1,4}\)|\[[a-zA-Z\d]{1,4}\]|[a-zA-Z\d]{1,4}[\.\)\-])\s+)/i, '')
    .trim();
};

export const shuffleArray = (arr) => {
  if (!arr || !Array.isArray(arr)) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const createScrambledRights = (rights) => {
  if (!rights || !Array.isArray(rights) || rights.length <= 1) return [...(rights || [])];
  const distinct = new Set(rights).size;
  if (distinct <= 1) return [...rights];

  let scrambled = shuffleArray([...rights]);
  for (let attempt = 0; attempt < 20; attempt++) {
    const hasCollision = scrambled.some((r, idx) => r === rights[idx]);
    if (!hasCollision) return scrambled;
    scrambled = shuffleArray([...rights]);
  }

  // Fallback derangement: cycle shift by 1
  return rights.map((_, i) => rights[(i + 1) % rights.length]);
};

export const createScrambledBlanks = (count) => {
  if (!count || count <= 1) return [1];
  const original = Array.from({ length: count }, (_, i) => i + 1);
  let scrambled = shuffleArray([...original]);
  for (let attempt = 0; attempt < 20; attempt++) {
    const isIdentical = scrambled.every((v, i) => v === original[i]);
    if (!isIdentical) return scrambled;
    scrambled = shuffleArray([...original]);
  }
  return original.map((_, i) => original[(i + 1) % original.length]);
};

export const formatPromptWithNumberedBlanks = (text) => {
  if (!text) return '';
  const cleaned = cleanQuestionPrompt(text);
  if (/(?:_{2,}|\.{3,})\s*[\(\[]\s*\d+\s*[\)\]]|[\(\[]\s*\d+\s*[\)\]]\s*(?:_{2,}|\.{3,})/.test(cleaned)) {
    return cleaned;
  }
  let counter = 1;
  const blankRegex = /(_{2,}|\[\s*(?:\.{2,}|blank|ô\s*trống|_+|\.\.\.)\s*\]|\.{3,})/g;
  return cleaned.replace(blankRegex, (match) => {
    const res = `${match} (${counter})`;
    counter++;
    return res;
  });
};

export const createRandomizedQuizQuestions = (rawQuestions) => {
  if (!rawQuestions || !Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return [];
  }

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // 1. Đảo ngẫu nhiên vị trí các câu hỏi
  const shuffled = shuffleArray(rawQuestions);

  // 2. Đánh số lại thứ tự cố định từ 1 -> N, làm sạch tiền tố "Câu X:", và đảo các phương án đáp án
  return shuffled.map((q, idx) => {
    const newOrder = idx + 1;
    const cleanedContent = cleanQuestionPrompt(q.content);

    const newQ = {
      ...q,
      order: newOrder,
      content: cleanedContent
    };

    // 1. Đảo đáp án trắc nghiệm A, B, C, D (single_choice & multiple_choice)
    if (newQ.type === 'single_choice' || newQ.type === 'multiple_choice') {
      const opts = newQ.options || [];
      if (opts.length >= 2) {
        const originalCorrectAnswers = Array.isArray(newQ.correctAnswers)
          ? newQ.correctAnswers
          : (newQ.correctAnswers ? [newQ.correctAnswers] : []);

        const optsWithFlag = opts.map(opt => ({
          ...opt,
          isOriginallyCorrect: Boolean(
            opt.highlighted ||
            originalCorrectAnswers.includes(opt.label)
          )
        }));

        const shuffledOpts = shuffleArray(optsWithFlag);
        const remappedOpts = shuffledOpts.map((opt, optIdx) => {
          const newLabel = ALPHABET[optIdx] || `Opt${optIdx + 1}`;
          const rawText = (opt.text !== undefined && opt.text !== null && String(opt.text).trim() !== '')
            ? String(opt.text).trim()
            : String(opt.full_text || '').trim();

          const stripped = cleanOptionText(rawText, opt.label);

          return {
            ...opt,
            label: newLabel,
            text: stripped || opt.label,
            full_text: `${newLabel}. ${stripped || opt.label}`,
            highlighted: opt.isOriginallyCorrect
          };
        });

        const newCorrect = remappedOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
        newQ.options = remappedOpts;
        newQ.correctAnswers = newCorrect;
      }
    }
    // 2. Đảo đáp án Đúng / Sai (true_false)
    else if (newQ.type === 'true_false') {
      newQ.shuffledButtons = shuffleArray(['Đúng', 'Sai']);

      // Multi-statement: đảo ngẫu nhiên thứ tự các mệnh đề
      if (newQ.statements && newQ.statements.length >= 2) {
        const shuffledStmts = shuffleArray(newQ.statements).map((st, sIdx) => {
          const stableId = st.id || `st_${sIdx + 1}`;
          const cleanStContent = String(st.content || '').replace(/^\s*(?:[a-dA-D\d]+[\.\)]\s*)+/, '').trim();
          return {
            ...st,
            id: stableId,
            order: sIdx + 1,
            content: cleanStContent || st.content,
            shuffledButtons: shuffleArray(['Đúng', 'Sai'])
          };
        });
        newQ.statements = shuffledStmts;
        newQ.correctAnswers = shuffledStmts.map(s => s.correctAnswer);
      }

      // Single true_false with options (A. Đúng, B. Sai)
      if (newQ.options && newQ.options.length >= 2) {
        const originalCorrectAnswers = Array.isArray(newQ.correctAnswers)
          ? newQ.correctAnswers
          : (newQ.correctAnswers ? [newQ.correctAnswers] : []);

        const optsWithFlag = newQ.options.map(opt => ({
          ...opt,
          isOriginallyCorrect: Boolean(
            opt.highlighted ||
            originalCorrectAnswers.includes(opt.label)
          )
        }));

        const shuffledOpts = shuffleArray(optsWithFlag);
        const remappedOpts = shuffledOpts.map((opt, optIdx) => {
          const newLabel = ALPHABET[optIdx] || `Opt${optIdx + 1}`;
          const rawText = (opt.text !== undefined && opt.text !== null && String(opt.text).trim() !== '')
            ? String(opt.text).trim()
            : String(opt.full_text || '').trim();

          const stripped = cleanOptionText(rawText, opt.label);

          return {
            ...opt,
            label: newLabel,
            text: stripped || opt.label,
            full_text: `${newLabel}. ${stripped || opt.label}`,
            highlighted: opt.isOriginallyCorrect
          };
        });

        const newCorrect = remappedOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
        newQ.options = remappedOpts;
        newQ.correctAnswers = newCorrect;
      }
    }
    // 3. Đảo từ khóa và xáo trộn các ô câu kéo thả (drag_drop_blank)
    else if (newQ.type === 'drag_drop_blank') {
      const existingBank = Array.isArray(newQ.bank) ? newQ.bank : [];
      const itemWords = (newQ.items || []).flatMap(it => {
        if (Array.isArray(it.correctAnswers)) return it.correctAnswers;
        if (it.correctAnswer) return [it.correctAnswer];
        return [];
      });
      const allBankWords = [...new Set([...existingBank, ...itemWords])].filter(Boolean);
      if (allBankWords.length >= 2) {
        newQ.bank = shuffleArray(allBankWords);
      } else if (allBankWords.length === 1) {
        newQ.bank = allBankWords;
      }

      // Xáo trộn cả các ô / câu kéo thả (items)
      const rawItems = newQ.items || [];
      if (rawItems.length >= 2) {
        const shuffledItems = shuffleArray(rawItems).map((it, itIdx) => {
          const newBlank = itIdx + 1;
          const cleanedText = cleanItemText(it.text);
          return {
            ...it,
            blank: newBlank,
            text: cleanedText || it.text
          };
        });
        newQ.items = shuffledItems;
      }
    }
    // 4. Đảo ngẫu nhiên cặp ghép nối và xáo trộn Cột B (matching)
    else if (newQ.type === 'matching') {
      const rawPairs = newQ.pairs || [];
      if (rawPairs.length >= 2) {
        const pairsWithId = rawPairs.map((p, pIdx) => ({
          ...p,
          id: p.id || p.left || `pair_${pIdx + 1}`
        }));
        const shuffledPairs = shuffleArray(pairsWithId);
        const rights = shuffledPairs.map(p => p.right);
        const scrambledRights = createScrambledRights(rights);

        newQ.pairs = shuffledPairs;
        newQ.shuffledRights = scrambledRights;
        newQ.correctAnswers = shuffledPairs.map(p => `${p.left} → ${p.right}`);
      }
    }
    // 5. Đảo phương án hoặc ngân hàng từ của câu điền từ (fill_blank)
    else if (newQ.type === 'fill_blank') {
      const blankCount = Math.max(
        newQ.blankCount || 0,
        (newQ.correctAnswers || []).length,
        1
      );
      if (blankCount >= 2) {
        newQ.shuffledBlanks = createScrambledBlanks(blankCount);
      }

      if (newQ.options && newQ.options.length >= 2) {
        const originalCorrectAnswers = Array.isArray(newQ.correctAnswers)
          ? newQ.correctAnswers
          : (newQ.correctAnswers ? [newQ.correctAnswers] : []);

        const optsWithFlag = newQ.options.map(opt => ({
          ...opt,
          isOriginallyCorrect: Boolean(
            opt.highlighted ||
            originalCorrectAnswers.includes(opt.label)
          )
        }));

        const shuffledOpts = shuffleArray(optsWithFlag);
        const remappedOpts = shuffledOpts.map((opt, optIdx) => {
          const newLabel = ALPHABET[optIdx] || `Opt${optIdx + 1}`;
          const rawText = (opt.text !== undefined && opt.text !== null && String(opt.text).trim() !== '')
            ? String(opt.text).trim()
            : String(opt.full_text || '').trim();

          const stripped = cleanOptionText(rawText, opt.label);

          return {
            ...opt,
            label: newLabel,
            text: stripped || opt.label,
            full_text: `${newLabel}. ${stripped || opt.label}`,
            highlighted: opt.isOriginallyCorrect
          };
        });

        const newCorrect = remappedOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
        newQ.options = remappedOpts;
        newQ.correctAnswers = newCorrect;
      }

      if (newQ.bank && newQ.bank.length >= 2) {
        newQ.bank = shuffleArray(newQ.bank);
      }
    }

    return newQ;
  });
};

export default function QuizPlayer({ quiz, onSubmit, onExit, onEdit }) {
  const [questions, setQuestions] = useState(() => createRandomizedQuizQuestions(quiz.questions || []));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const initialDuration = (quiz.durationMinutes || 30) * 60;
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isPaused, setIsPaused] = useState(false);

  const [selectedMatchLeft, setSelectedMatchLeft] = useState(null);
  const [activeBlank, setActiveBlank] = useState(null);

  useEffect(() => {
    setQuestions(createRandomizedQuizQuestions(quiz.questions || []));
    setCurrentIndex(0);
    setAnswers({});
    setSecondsElapsed(0);
    setTimeLeft((quiz.durationMinutes || 30) * 60);
    setFlaggedQuestions(new Set());
  }, [quiz]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const toggleFlag = (qId) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        goToQuestion(Math.max(0, currentIndex - 1));
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < questions.length - 1) {
          goToQuestion(currentIndex + 1);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        const curQ = questions[currentIndex];
        if (curQ?.id) toggleFlag(curQ.id);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const num = parseInt(e.key, 10);
        const curQ = questions[currentIndex];
        if (curQ && curQ.type === 'single_choice' && curQ.options && curQ.options[num - 1]) {
          handleSingleChoice(curQ.options[num - 1].label);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions]);

  const formatTime = (secs) => {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
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

  const handleFillBlankSlot = (blankNum, text) => {
    setAnswers(prev => {
      const currentMap = typeof prev[currentQ.id] === 'object' && prev[currentQ.id] !== null
        ? { ...prev[currentQ.id] }
        : (typeof prev[currentQ.id] === 'string' && prev[currentQ.id] ? { 1: prev[currentQ.id] } : {});
      currentMap[blankNum] = text;
      return {
        ...prev,
        [currentQ.id]: currentMap
      };
    });
  };

  const getQuestionBlanks = (q) => {
    if (!q) return [1];
    if (q.blankCount && q.blankCount > 1) {
      return Array.from({ length: q.blankCount }, (_, i) => i + 1);
    }
    const content = q.content || '';
    const blankRegex = /(_{2,}\s*(?:\(\s*\d+\s*\)|\[\s*\d+\s*\])?|\[\s*(?:\.{2,}|blank|ô\s*trống|_+|\d+|\.\.\.)\s*\]|\(\s*(?:\d+|\.{2,})\s*\)|\.{3,})/g;
    const matches = content.match(blankRegex) || [];
    const count = Math.max(
      q.blankCount || 0,
      matches.length,
      (q.correctAnswers || []).length,
      1
    );
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  const goToQuestion = (idx) => {
    setCurrentIndex(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // 1. ĐẢO TẤT CẢ CÂU HỎI (Shuffle Questions)
  const handleShuffleQuestions = () => {
    if (questions.length < 2) return;
    const currentQId = questions[currentIndex]?.id;
    const shuffled = shuffleArray(questions);
    const renumbered = shuffled.map((q, idx) => ({
      ...q,
      order: idx + 1,
      content: cleanQuestionPrompt(q.content)
    }));
    setQuestions(renumbered);
    if (currentQId) {
      const newIdx = renumbered.findIndex(q => q.id === currentQId);
      if (newIdx !== -1) {
        setCurrentIndex(newIdx);
      }
    }
    showToast(`🔀 Đã đảo ngẫu nhiên toàn bộ câu hỏi (thứ tự 1 → ${questions.length})! Trạng thái được giữ nguyên.`);
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

          const originalCorrect = Array.isArray(q.correctAnswers)
            ? q.correctAnswers
            : (q.correctAnswers ? [q.correctAnswers] : []);

          const optsWithFlag = opts.map(opt => ({
            ...opt,
            isOriginallyCorrect: Boolean(opt.highlighted || originalCorrect.includes(opt.label))
          }));

          const shuffledOpts = shuffleArray(optsWithFlag);
          const newOpts = shuffledOpts.map((opt, idx) => {
            const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
            return {
              ...opt,
              label: newLabel,
              full_text: `${newLabel}. ${opt.text || ''}`,
              highlighted: opt.isOriginallyCorrect
            };
          });

          const newCorrect = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);

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
        return q;
      }
      // 2. TRUE / FALSE
      else if (q.type === 'true_false') {
        const newQ = { ...q, shuffledButtons: shuffleArray(['Đúng', 'Sai']) };

        // Multi-statement
        if (q.statements && q.statements.length >= 2) {
          const shuffledStmts = shuffleArray(q.statements).map((st, sIdx) => {
            const stableId = st.id || `st_${sIdx + 1}`;
            const cleanStContent = String(st.content || '').replace(/^\s*(?:[a-dA-D\d]+[\.\)]\s*)+/, '').trim();
            return {
              ...st,
              id: stableId,
              order: sIdx + 1,
              content: cleanStContent || st.content,
              shuffledButtons: shuffleArray(['Đúng', 'Sai'])
            };
          });
          newQ.statements = shuffledStmts;
          newQ.correctAnswers = shuffledStmts.map(s => s.correctAnswer);
        }

        // Single true_false with options
        if (q.options && q.options.length >= 2) {
          const userAns = answers[q.id];
          let selectedText = null;
          if (userAns) {
            const found = q.options.find(o => o.label === userAns);
            if (found) selectedText = found.text;
          }

          const originalCorrect = Array.isArray(q.correctAnswers)
            ? q.correctAnswers
            : (q.correctAnswers ? [q.correctAnswers] : []);

          const optsWithFlag = q.options.map(opt => ({
            ...opt,
            isOriginallyCorrect: Boolean(opt.highlighted || originalCorrect.includes(opt.label))
          }));

          const shuffledOpts = shuffleArray(optsWithFlag);
          const newOpts = shuffledOpts.map((opt, idx) => {
            const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
            return {
              ...opt,
              label: newLabel,
              full_text: `${newLabel}. ${opt.text || ''}`,
              highlighted: opt.isOriginallyCorrect
            };
          });

          const newCorrect = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);

          if (selectedText) {
            const newOpt = newOpts.find(o => o.text === selectedText);
            if (newOpt) {
              newAnswers[q.id] = newOpt.label;
            }
          }

          newQ.options = newOpts;
          newQ.correctAnswers = newCorrect;
        }

        return newQ;
      }
      // 3. DRAG & DROP BLANK
      else if (q.type === 'drag_drop_blank') {
        const existingBank = Array.isArray(q.bank) ? q.bank : [];
        const itemWords = (q.items || []).flatMap(it => {
          if (Array.isArray(it.correctAnswers)) return it.correctAnswers;
          if (it.correctAnswer) return [it.correctAnswer];
          return [];
        });
        const allBankWords = [...new Set([...existingBank, ...itemWords])].filter(Boolean);
        const shuffledBank = allBankWords.length >= 2 ? shuffleArray(allBankWords) : allBankWords;

        const rawItems = q.items || [];
        if (rawItems.length >= 2) {
          const currentAnsMap = answers[q.id] || {};
          const itemsWithAnswers = rawItems.map(it => ({
            ...it,
            currentPlaced: currentAnsMap[it.blank] || currentAnsMap[String(it.blank)] || []
          }));

          const shuffledItems = shuffleArray(itemsWithAnswers);
          const newAnsMap = {};

          const remappedItems = shuffledItems.map((it, idx) => {
            const newBlank = idx + 1;
            if (it.currentPlaced && it.currentPlaced.length > 0) {
              newAnsMap[newBlank] = it.currentPlaced;
            }
            const cleanedText = cleanItemText(it.text);
            return {
              ...it,
              blank: newBlank,
              text: cleanedText || it.text,
              currentPlaced: undefined
            };
          });

          newAnswers[q.id] = newAnsMap;

          return {
            ...q,
            bank: shuffledBank,
            items: remappedItems
          };
        }

        return {
          ...q,
          bank: shuffledBank
        };
      }
      // 4. MATCHING
      else if (q.type === 'matching') {
        const rawPairs = q.pairs || [];
        if (rawPairs.length >= 2) {
          const pairsWithId = rawPairs.map((p, pIdx) => ({
            ...p,
            id: p.id || p.left || `pair_${pIdx + 1}`
          }));
          const shuffledPairs = shuffleArray(pairsWithId);
          const rights = shuffledPairs.map(p => p.right);
          const scrambledRights = createScrambledRights(rights);
          return {
            ...q,
            pairs: shuffledPairs,
            shuffledRights: scrambledRights,
            correctAnswers: shuffledPairs.map(p => `${p.left} → ${p.right}`)
          };
        }
      }
      // 5. FILL BLANK
      else if (q.type === 'fill_blank') {
        const newQ = { ...q };
        const blankCount = Math.max(
          q.blankCount || 0,
          (q.correctAnswers || []).length,
          1
        );
        if (blankCount >= 2) {
          newQ.shuffledBlanks = createScrambledBlanks(blankCount);
        }

        if (q.options && q.options.length >= 2) {
          const userAns = answers[q.id];
          let selectedText = null;
          if (typeof userAns === 'string' && userAns) {
            const found = q.options.find(o => o.label === userAns || o.text === userAns);
            if (found) selectedText = found.text;
          }

          const originalCorrect = Array.isArray(q.correctAnswers)
            ? q.correctAnswers
            : (q.correctAnswers ? [q.correctAnswers] : []);

          const optsWithFlag = q.options.map(opt => ({
            ...opt,
            isOriginallyCorrect: Boolean(opt.highlighted || originalCorrect.includes(opt.label))
          }));

          const shuffledOpts = shuffleArray(optsWithFlag);
          const newOpts = shuffledOpts.map((opt, idx) => {
            const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
            return {
              ...opt,
              label: newLabel,
              full_text: `${newLabel}. ${opt.text || ''}`,
              highlighted: opt.isOriginallyCorrect
            };
          });

          const newCorrect = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);

          if (selectedText) {
            const newOpt = newOpts.find(o => o.text === selectedText);
            if (newOpt) {
              newAnswers[q.id] = newOpt.label;
            }
          }

          newQ.options = newOpts;
          newQ.correctAnswers = newCorrect;
        }

        if (q.bank && q.bank.length >= 2) {
          newQ.bank = shuffleArray(q.bank);
        }

        return newQ;
      }
      return q;
    });

    setQuestions(updatedQuestions);
    setAnswers(newAnswers);
    showToast(`🔀 Đã đảo ngẫu nhiên toàn bộ đáp án của tất cả câu hỏi! Trạng thái được giữ nguyên khi chuyển câu.`);
  };



  const isQuestionAnswered = (q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return false;
    if (q.type === 'single_choice') {
      return String(ans).trim().length > 0;
    }
    if (q.type === 'fill_blank') {
      if (typeof ans === 'string') return ans.trim().length > 0;
      if (typeof ans === 'object') {
        return Object.values(ans).some(v => String(v || '').trim().length > 0);
      }
      return Boolean(ans);
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

  useEffect(() => {
    try {
      localStorage.setItem('edudocx_saved_progress', JSON.stringify({
        quizId: quiz.id,
        quizTitle: quiz.title,
        answeredCount,
        totalCount: questions.length,
        answers,
        timestamp: Date.now()
      }));
    } catch (e) {
      // ignore
    }
  }, [answers, answeredCount, questions.length, quiz.id, quiz.title]);

  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    setShowConfirmModal(false);
    onSubmit(answers, questions);
  };

  return (
    <div style={{ maxWidth: '1800px', margin: '0 auto', paddingBottom: '7.5rem' }}>
      {/* 1. Top Exam Pinned Status Bar */}
      <header style={{
        position: 'sticky',
        top: '4.5rem',
        zIndex: 30,
        background: '#ffffff',
        borderRadius: '8px',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #eeeeee'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Title & tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#222222', fontWeight: 700 }}>
                  Mã đề: {String(quiz.id || 'QUIZ').slice(0, 8).toUpperCase()}
                </span>
              </div>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#222222',
                margin: '2px 0 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '420px'
              }}>
                {quiz.title}
              </h1>
            </div>
          </div>

          {/* Center & Right Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Progress pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #eeeeee'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#555555', fontWeight: 700, textTransform: 'uppercase' }}>Tiến độ</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#222222' }}>
                  {answeredCount} / {questions.length} ({progressPercent}%)
                </div>
              </div>
            </div>

            {/* Cloud Auto-save indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #eeeeee'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#555555', fontWeight: 700, textTransform: 'uppercase' }}>Trạng thái</div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#222222' }}>Đã lưu tự động</div>
              </div>
            </div>

            {/* Timer countdown card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              border: '1px solid #eeeeee',
              padding: '0.45rem 0.95rem',
              borderRadius: '6px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#555555', fontWeight: 700, textTransform: 'uppercase' }}>
                  Thời gian còn lại
                </div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: timeLeft < 300 ? '#b91c1c' : '#222222',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Pause / Resume */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsPaused(prev => !prev)}
              style={{
                borderRadius: '6px',
                padding: '0.6rem 0.95rem',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>

            {/* Submit button */}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSubmitClick}
              style={{
                borderRadius: '6px',
                padding: '0.6rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 800
              }}
            >
              <Send size={16} />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>

        {/* Linear Progress Track */}
        <div style={{
          width: '100%',
          height: '6px',
          background: '#ffffff',
          borderRadius: '3px',
          overflow: 'hidden',
          display: 'flex',
          marginTop: '1rem',
          border: '1px solid #eeeeee'
        }}>
          <div style={{
            width: `${progressPercent}%`,
            background: '#222222',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </header>

      {toastMessage && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #eeeeee',
          color: '#222222',
          padding: '0.75rem 1.25rem',
          borderRadius: '6px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700
        }}>
          {toastMessage}
        </div>
      )}

      {/* 2. 2-Column Split Testing Canvas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT COLUMN: Main Question Focus Arena */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          {/* Main Question Card */}
          <div className="card" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
            {/* Question Meta Chips */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: '#222222',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  border: '1px solid #222222'
                }}>
                  CÂU HỎI {currentIndex + 1}
                </span>

                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #eeeeee',
                  color: '#222222',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  {currentQ.type === 'single_choice' && '1 đáp án đúng'}
                  {currentQ.type === 'multiple_choice' && 'Nhiều đáp án đúng'}
                  {currentQ.type === 'true_false' && 'Đúng / Sai'}
                  {currentQ.type === 'fill_blank' && 'Điền khuyết'}
                  {currentQ.type === 'drag_drop_blank' && 'Kéo thả từ'}
                  {currentQ.type === 'matching' && 'Ghép đôi thuật ngữ'}
                </span>

                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #eeeeee',
                  color: '#222222',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  {(10 / Math.max(1, questions.length)).toFixed(2)} điểm
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isQuestionAnswered(currentQ) && (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #eeeeee',
                    color: '#222222',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    ✓ Đã trả lời
                  </span>
                )}
                {flaggedQuestions.has(currentQ.id) && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#222222',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid #222222'
                  }}>
                    ★ Đang xem lại
                  </span>
                )}
              </div>
            </div>

        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: (currentQ.content || '').includes('\n') ? 600 : 700,
          color: '#222222',
          lineHeight: 1.6,
          marginBottom: '1.75rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          tabSize: 4,
          fontFamily: (currentQ.content || '').includes('\n') && /[{};=()<>\[\]]/.test(currentQ.content) && /(?:int|void|public|static|function|class|def|var|let|const|val|package|print|return)/.test(currentQ.content)
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'inherit'
        }}>
          {currentQ.type === 'fill_blank' && (currentQ.blankCount > 1 || (currentQ.correctAnswers && currentQ.correctAnswers.length > 1))
            ? formatPromptWithNumberedBlanks(currentQ.content)
            : cleanQuestionPrompt(currentQ.content)}
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
                    color: '#222222',
                    fontWeight: isSelected ? 700 : 400,
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
            <p style={{ fontSize: '0.85rem', color: '#555555', marginBottom: '0.75rem', fontStyle: 'italic' }}>
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
                      color: '#222222',
                      fontWeight: isSelected ? 700 : 400,
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
            {(!currentQ.statements || currentQ.statements.length === 0) ? (
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
                        color: '#222222',
                        fontWeight: isSelected ? 700 : 400,
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
            ) : (
              (currentQ.statements || []).map((st) => {
                const stKey = st.id || String(st.order);
                const userStVal = (answers[currentQ.id] || {})[stKey];
                const buttons = st.shuffledButtons || currentQ.shuffledButtons || ['Đúng', 'Sai'];

                return (
                  <div
                    key={stKey}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem 1.25rem',
                      background: '#ffffff',
                      borderRadius: '6px',
                      border: '1px solid #eeeeee',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ fontSize: '1rem', color: '#222222', fontWeight: 500, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {st.content}
                    </span>

                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                      {buttons.map(btnVal => (
                        <button
                          key={btnVal}
                          type="button"
                          className={`btn ${userStVal === btnVal ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleStatementAnswer(stKey, btnVal)}
                          style={{ minWidth: '85px', borderRadius: '6px' }}
                        >
                          {btnVal} {userStVal === btnVal && '✓'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. FILL BLANK */}
        {currentQ.type === 'fill_blank' && (() => {
          const blanks = currentQ.shuffledBlanks || getQuestionBlanks(currentQ);
          const singleVal = (typeof currentAnswer === 'object' && currentAnswer !== null)
            ? (currentAnswer['1'] || currentAnswer[1] || '')
            : (currentAnswer || '');

          return (
            <div>
              {/* If bank words exist for fill blank, show chips */}
              {currentQ.bank && currentQ.bank.length > 0 && (
                <div style={{
                  background: '#ffffff',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #eeeeee',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#222222', marginRight: '0.25rem' }}>
                    Từ gợi ý (Bấm để điền):
                  </span>
                  {currentQ.bank.map((word, wIdx) => (
                    <button
                      key={wIdx}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (blanks.length <= 1) {
                          handleFillBlank(word);
                          handleFillBlankSlot(1, word);
                        } else {
                          const targetSlot = activeBlank || (blanks.length > 0 ? blanks[0] : 1);
                          handleFillBlankSlot(targetSlot, word);
                        }
                      }}
                      style={{ fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '4px' }}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              )}

              {blanks.length <= 1 ? (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#222222', marginBottom: '0.5rem' }}>
                    Nhập câu trả lời của bạn:
                  </label>
                  <input
                    type="text"
                    value={singleVal}
                    onChange={(e) => {
                      handleFillBlank(e.target.value);
                      handleFillBlankSlot(1, e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1.15rem',
                      fontSize: '1rem',
                      borderRadius: '6px',
                      border: '1px solid #eeeeee',
                      outline: 'none',
                      background: '#ffffff',
                      color: '#222222'
                    }}
                  />

                  {currentQ.options && currentQ.options.length >= 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#222222' }}>
                        Hoặc chọn phương án:
                      </span>
                      {currentQ.options.map(opt => {
                        const isSelected = singleVal === opt.label || singleVal === opt.text;
                        return (
                          <div
                            key={opt.label}
                            onClick={() => {
                              handleFillBlank(opt.text || opt.label);
                              handleFillBlankSlot(1, opt.text || opt.label);
                            }}
                            className={`option-item ${isSelected ? 'selected' : ''}`}
                            style={{ padding: '0.65rem 0.85rem' }}
                          >
                            <div className="option-badge">{opt.label}</div>
                            <span>{opt.text || opt.full_text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {blanks.map((bNum) => {
                    const val = (typeof currentAnswer === 'object' && currentAnswer !== null)
                      ? (currentAnswer[bNum] || currentAnswer[String(bNum)] || '')
                      : (bNum === 1 && typeof currentAnswer === 'string' ? currentAnswer : '');

                    return (
                      <div
                        key={bNum}
                        onClick={() => setActiveBlank(bNum)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          background: '#ffffff',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          border: activeBlank === bNum ? '2px solid #222222' : '1px solid #eeeeee'
                        }}
                      >
                        <div style={{
                          background: '#222222',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '4px',
                          flexShrink: 0,
                          minWidth: '95px',
                          textAlign: 'center'
                        }}>
                          Ô trống {bNum}
                        </div>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleFillBlankSlot(bNum, e.target.value)}
                          onFocus={() => setActiveBlank(bNum)}
                          style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            fontSize: '1rem',
                            borderRadius: '4px',
                            border: '1px solid #eeeeee',
                            outline: 'none',
                            background: '#ffffff',
                            color: '#222222',
                            fontWeight: 500
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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
                borderRadius: '6px',
                border: '1px solid #eeeeee',
                marginBottom: '1.5rem'
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
                        background: '#ffffff',
                        borderRadius: '6px',
                        border: isActive ? '2px solid #222222' : '1px solid #eeeeee',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{
                            padding: '3px 8px',
                            background: isActive ? '#222222' : '#ffffff',
                            color: isActive ? '#ffffff' : '#222222',
                            border: '1px solid #222222',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '0.8rem'
                          }}>
                            Vị trí {it.blank}
                          </span>
                          <span style={{ fontSize: '0.975rem', color: '#222222', fontWeight: 600 }}>
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
                            style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}
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
                          color: '#555555',
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
            <p style={{ fontSize: '0.85rem', color: '#555555', marginBottom: '1rem', fontStyle: 'italic' }}>
              * Chọn một thuật ngữ ở cột trái, sau đó chọn định nghĩa tương ứng ở cột phải để ghép cặp.
            </p>

            <div className="match-grid">
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#222222' }}>
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
                          <div style={{ fontSize: '0.775rem', color: '#555555', marginTop: '0.2rem', fontWeight: 600 }}>
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
                          style={{ background: 'none', border: 'none', color: '#222222', cursor: 'pointer' }}
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
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#222222' }}>
                  Cột B: Định nghĩa
                </span>
                {(currentQ.shuffledRights || (currentQ.pairs || []).map(p => p.right)).map((rightText, rIdx) => {
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
                      <span style={{ fontSize: '0.9rem', color: '#222222' }}>
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

          {/* Keyboard Accessibility Hint Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #eeeeee',
            fontSize: '0.8rem',
            color: '#555555'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <span>Phím tắt:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span><kbd style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eeeeee', fontWeight: 700 }}>1</kbd>-<kbd style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eeeeee', fontWeight: 700 }}>4</kbd> Chọn đáp án</span>
              <span><kbd style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eeeeee', fontWeight: 700 }}>F</kbd> Đặt cờ xem lại</span>
              <span><kbd style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eeeeee', fontWeight: 700 }}>←</kbd> <kbd style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eeeeee', fontWeight: 700 }}>→</kbd> Chuyển câu</span>
            </div>
          </div>

          {/* Quick Shuffle Tools */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleShuffleQuestions}
              style={{ fontSize: '0.78rem', borderRadius: '6px' }}
              title="Đảo thứ tự câu hỏi"
            >
              Đảo câu hỏi
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleShuffleAllAnswers}
              style={{ fontSize: '0.78rem', borderRadius: '6px' }}
              title="Đảo tất cả đáp án"
            >
              Đảo tất cả đáp án
            </button>
            {onEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEdit}
                style={{ fontSize: '0.78rem', borderRadius: '6px' }}
              >
                Chỉnh sửa đề thi
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Question Palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '5rem' }}>
          <div className="card" style={{ padding: '1.25rem', border: '1px solid #eeeeee', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#222222', margin: 0 }}>Bảng câu hỏi</h3>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#ffffff', color: '#555555', border: '1px solid #eeeeee', padding: '2px 8px', borderRadius: '4px' }}>
                {questions.length} câu
              </span>
            </div>

            {/* Status Metrics Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              padding: '8px',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #eeeeee',
              textAlign: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#222222' }}>{answeredCount}</div>
                <div style={{ fontSize: '11px', color: '#555555', fontWeight: 600 }}>Đã làm</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#222222' }}>{flaggedQuestions.size}</div>
                <div style={{ fontSize: '11px', color: '#555555', fontWeight: 600 }}>Xem lại</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#222222' }}>{questions.length - answeredCount}</div>
                <div style={{ fontSize: '11px', color: '#555555', fontWeight: 600 }}>Chưa làm</div>
              </div>
            </div>

            {/* Question Palette Matrix */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '2px'
            }}>
              {questions.map((q, idx) => {
                const isAnswered = isQuestionAnswered(q);
                const isFlagged = flaggedQuestions.has(q.id);
                const isCurrent = idx === currentIndex;

                let bg = '#ffffff';
                let color = '#222222';
                let border = '1px solid #eeeeee';

                if (isCurrent) {
                  border = '2px solid #222222';
                  bg = '#222222';
                  color = '#ffffff';
                } else if (isFlagged) {
                  bg = '#ffffff';
                  color = '#222222';
                  border = '2px dashed #222222';
                } else if (isAnswered) {
                  bg = '#f4f4f5';
                  color = '#222222';
                  border = '1px solid #eeeeee';
                }

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    style={{
                      height: '38px',
                      borderRadius: '4px',
                      background: bg,
                      color: color,
                      border: border,
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    title={`Câu ${idx + 1}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span
                        style={{
                          fontSize: '11px',
                          position: 'absolute',
                          top: '1px',
                          right: '3px',
                          color: isCurrent ? '#ffffff' : '#222222'
                        }}
                      >
                        ★
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legends */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #eeeeee', fontSize: '11px', color: '#555555' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f4f4f5', border: '1px solid #eeeeee' }} />
                <span>Đã trả lời ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#222222', border: '1px solid #222222' }} />
                <span>Đang xem (Câu {currentIndex + 1})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ffffff', border: '2px dashed #222222' }} />
                <span>Cần xem lại ({flaggedQuestions.size})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ffffff', border: '1px solid #eeeeee' }} />
                <span>Chưa làm ({questions.length - answeredCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Fixed Bottom Navigation Bar (Cố định chuyển câu tiếp theo & câu trước) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#ffffff',
        borderTop: '1px solid #eeeeee',
        zIndex: 45,
        padding: '0.85rem 1.5rem'
      }}>
        <div style={{
          maxWidth: '1800px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {/* Nút Câu trước */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '0.65rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              minWidth: '135px',
              borderRadius: '6px'
            }}
          >
            <ArrowLeft size={18} /> Câu trước
          </button>

          {/* Vị trí câu hiện tại & Đánh dấu xem lại */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{
              padding: '0.45rem 1.1rem',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #eeeeee',
              fontSize: '0.875rem',
              fontWeight: 800,
              color: '#222222'
            }}>
              Câu {currentIndex + 1} / {questions.length}
            </span>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => toggleFlag(currentQ.id)}
              style={{
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: flaggedQuestions.has(currentQ.id) ? '#222222' : '#ffffff',
                borderColor: flaggedQuestions.has(currentQ.id) ? '#222222' : '#eeeeee',
                color: flaggedQuestions.has(currentQ.id) ? '#ffffff' : '#222222',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <span>{flaggedQuestions.has(currentQ.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại (F)'}</span>
            </button>
          </div>

          {/* Nút Câu tiếp theo / Nộp bài thi */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToQuestion(currentIndex + 1)}
                style={{
                  padding: '0.65rem 1.6rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  minWidth: '150px',
                  borderRadius: '6px'
                }}
              >
                Câu tiếp theo <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitClick}
                style={{
                  padding: '0.65rem 1.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  minWidth: '150px',
                  borderRadius: '6px'
                }}
              >
                <Send size={18} /> Nộp bài thi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ border: '1px solid #eeeeee', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#222222', marginBottom: '0.75rem' }}>
              Xác nhận nộp bài thi
            </h3>
            <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Bạn đã hoàn thành <strong>{answeredCount} / {questions.length}</strong> câu hỏi.
              {answeredCount < questions.length && (
                <span style={{ display: 'block', color: '#b91c1c', marginTop: '0.5rem', fontWeight: 600 }}>
                  ⚠ Còn {questions.length - answeredCount} câu chưa có câu trả lời!
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setShowConfirmModal(false)}>
                Tiếp tục làm bài
              </button>
              <button className="btn btn-primary" style={{ borderRadius: '6px' }} onClick={confirmSubmit}>
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

