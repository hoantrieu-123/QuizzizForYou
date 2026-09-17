import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, Play, Save, ArrowLeft,
  Edit2, Plus, Trash2, Check, Circle, Sparkles,
  Shuffle, Package, GripVertical, X, Layers, Settings2
} from './UIcons';
import { cleanQuestionPrompt, cleanItemText, createScrambledRights, createScrambledBlanks } from './QuizPlayer';

const QUESTION_TYPES = [
  { value: 'single_choice', label: '1. Chọn một đáp án' },
  { value: 'multiple_choice', label: '2. Chọn nhiều đáp án' },
  { value: 'true_false', label: '3. Đúng / Sai' },
  { value: 'fill_blank', label: '4. Điền từ vào chỗ trống' },
  { value: 'drag_drop_blank', label: '5. Kéo thả vào ô trống' },
  { value: 'matching', label: '6. Ghép đôi (Matching)' },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function PreviewEditor({ quiz, onSave, onStartQuiz, onBack }) {
  const [title, setTitle] = useState(quiz.title || '');
  const [questions, setQuestions] = useState(quiz.questions || []);
  const [filterType, setFilterType] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeMultiWord, setActiveMultiWord] = useState(null);

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

  const handleShuffleOptions = (qIdx) => {
    const q = questions[qIdx];
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      const opts = q.options || [];
      if (opts.length < 2) return;
      const shuffled = shuffleArray(opts);
      const newOpts = shuffled.map((opt, idx) => {
        const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
        return {
          ...opt,
          label: newLabel,
          full_text: `${newLabel}. ${opt.text || ''}`
        };
      });
      const newCorrect = newOpts.filter(o => o.highlighted).map(o => o.label);
      const updated = [...questions];
      updated[qIdx] = {
        ...q,
        options: newOpts,
        correctAnswers: newCorrect
      };
      setQuestions(updated);
      showToast(`🔀 Đã đảo ngẫu nhiên các phương án của Câu ${q.order || qIdx + 1}!`);
    } else if (q.type === 'drag_drop_blank') {
      const existingBank = Array.isArray(q.bank) ? q.bank : [];
      const itemWords = (q.items || []).flatMap(it => {
        if (Array.isArray(it.correctAnswers)) return it.correctAnswers;
        if (it.correctAnswer) return [it.correctAnswer];
        return [];
      });
      const allBankWords = [...new Set([...existingBank, ...itemWords])].filter(Boolean);
      const shuffledBank = allBankWords.length >= 2 ? shuffleArray(allBankWords) : allBankWords;

      let newItems = q.items || [];
      if (newItems.length >= 2) {
        newItems = shuffleArray(newItems).map((it, idx) => ({
          ...it,
          blank: idx + 1,
          text: cleanItemText(it.text) || it.text
        }));
      }

      const updated = [...questions];
      updated[qIdx] = {
        ...q,
        bank: shuffledBank,
        items: newItems
      };
      setQuestions(updated);
      showToast(`🔀 Đã đảo thứ tự hộp từ và các ô kéo thả của Câu ${q.order || qIdx + 1}!`);
    } else if (q.type === 'matching') {
      const pairs = q.pairs || [];
      if (pairs.length < 2) return;
      const shuffledPairs = shuffleArray(pairs);
      const updated = [...questions];
      updated[qIdx] = {
        ...q,
        pairs: shuffledPairs,
        correctAnswers: shuffledPairs.map(p => `${p.left} → ${p.right}`)
      };
      setQuestions(updated);
      showToast(`🔀 Đã đảo thứ tự các cặp ghép nối của Câu ${q.order || qIdx + 1}!`);
    } else if (q.type === 'fill_blank') {
      const blankCount = Math.max(
        q.blankCount || 0,
        (q.correctAnswers || []).length,
        1
      );
      const newQ = { ...q };
      let hasChanges = false;
      if (blankCount >= 2) {
        newQ.shuffledBlanks = createScrambledBlanks(blankCount);
        hasChanges = true;
      }
      if (q.bank && q.bank.length >= 2) {
        newQ.bank = shuffleArray(q.bank);
        hasChanges = true;
      }
      if (hasChanges) {
        const updated = [...questions];
        updated[qIdx] = newQ;
        setQuestions(updated);
        showToast(`🔀 Đã đảo ngẫu nhiên các ô điền từ của Câu ${q.order || qIdx + 1}!`);
      }
    }
  };

  const handleShuffleAllAnswers = () => {
    let count = 0;
    const updated = questions.map((q, qIdx) => {
      // 1. Single Choice & Multiple Choice
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const opts = q.options || [];
        if (opts.length >= 2) {
          const originalCorrect = Array.isArray(q.correctAnswers)
            ? q.correctAnswers
            : (q.correctAnswers ? [q.correctAnswers] : []);

          const optsWithFlag = opts.map(opt => ({
            ...opt,
            isOriginallyCorrect: Boolean(opt.highlighted || originalCorrect.includes(opt.label))
          }));

          const shuffled = shuffleArray(optsWithFlag);
          const newOpts = shuffled.map((opt, idx) => {
            const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
            return {
              ...opt,
              label: newLabel,
              full_text: `${newLabel}. ${opt.text || ''}`,
              highlighted: opt.isOriginallyCorrect
            };
          });
          const newCorrect = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
          count++;
          return {
            ...q,
            options: newOpts,
            correctAnswers: newCorrect
          };
        }
      }
      // 2. True / False
      else if (q.type === 'true_false') {
        const newQ = { ...q, shuffledButtons: shuffleArray(['Đúng', 'Sai']) };
        let modified = false;

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
          modified = true;
        }

        if (q.options && q.options.length >= 2) {
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

          newQ.options = newOpts;
          newQ.correctAnswers = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
          modified = true;
        }

        if (modified) count++;
        return newQ;
      }
      // 3. Drag & Drop
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
          const shuffledItems = shuffleArray(rawItems).map((it, idx) => ({
            ...it,
            blank: idx + 1,
            text: cleanItemText(it.text) || it.text
          }));
          count++;
          return {
            ...q,
            bank: shuffledBank,
            items: shuffledItems
          };
        }

        count++;
        return {
          ...q,
          bank: shuffledBank
        };
      }
      // 4. Matching
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
          count++;
          return {
            ...q,
            pairs: shuffledPairs,
            shuffledRights: scrambledRights,
            correctAnswers: shuffledPairs.map(p => `${p.left} → ${p.right}`)
          };
        }
      }
      // 5. Fill Blank
      else if (q.type === 'fill_blank') {
        const newQ = { ...q };
        let modified = false;

        const blankCount = Math.max(
          q.blankCount || 0,
          (q.correctAnswers || []).length,
          1
        );
        if (blankCount >= 2) {
          newQ.shuffledBlanks = createScrambledBlanks(blankCount);
          modified = true;
        }

        if (q.options && q.options.length >= 2) {
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

          newQ.options = newOpts;
          newQ.correctAnswers = newOpts.filter(o => o.isOriginallyCorrect).map(o => o.label);
          modified = true;
        }

        if (q.bank && q.bank.length >= 2) {
          newQ.bank = shuffleArray(q.bank);
          modified = true;
        }

        if (modified) count++;
        return newQ;
      }
      return q;
    });
    setQuestions(updated);
    showToast(`🔀 Đã đảo ngẫu nhiên toàn bộ đáp án của ${count} câu hỏi trong bài thi!`);
  };

  const handleShuffleAllQuestions = () => {
    if (questions.length < 2) return;
    const shuffled = shuffleArray(questions);
    const renumbered = shuffled.map((q, idx) => ({
      ...q,
      order: idx + 1,
      content: cleanQuestionPrompt(q.content)
    }));
    setQuestions(renumbered);
    showToast(`🔀 Đã đảo ngẫu nhiên thứ tự các câu hỏi (thứ tự 1 → ${questions.length})!`);
  };

  const filteredQuestions = questions.filter(q => {
    if (filterType === 'all') return true;
    if (filterType === 'warning') return !q.hasHighlight || q.warning;
    return q.type === filterType;
  });

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // OPTIONS CRUD (Single Choice & Multiple Choice)
  // -------------------------------------------------------------
  const handleSingleChoiceSelect = (qIdx, label) => {
    const q = questions[qIdx];
    const newOptions = (q.options || []).map(opt => ({
      ...opt,
      highlighted: opt.label === label
    }));
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      options: newOptions,
      correctAnswers: [label],
      hasHighlight: true,
      highlightSource: 'Người dùng chọn thủ công',
      warning: null
    };
    setQuestions(updated);
  };

  const handleMultiChoiceToggle = (qIdx, label) => {
    const q = questions[qIdx];
    const currentAnswers = new Set(q.correctAnswers || []);
    if (currentAnswers.has(label)) {
      currentAnswers.delete(label);
    } else {
      currentAnswers.add(label);
    }
    const newAnswers = Array.from(currentAnswers);
    const newOptions = (q.options || []).map(opt => ({
      ...opt,
      highlighted: currentAnswers.has(opt.label)
    }));

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      options: newOptions,
      correctAnswers: newAnswers,
      hasHighlight: newAnswers.length > 0,
      highlightSource: 'Người dùng điều chỉnh',
      warning: newAnswers.length === 0 ? '⚠ Cần chọn ít nhất một đáp án đúng' : null
    };
    setQuestions(updated);
  };

  const handleUpdateOptionText = (qIdx, optIdx, newText) => {
    const q = questions[qIdx];
    const newOptions = [...(q.options || [])];
    newOptions[optIdx] = {
      ...newOptions[optIdx],
      text: newText,
      full_text: `${newOptions[optIdx].label}. ${newText}`
    };
    const updated = [...questions];
    updated[qIdx] = { ...q, options: newOptions };
    setQuestions(updated);
  };

  const handleAddOption = (qIdx) => {
    const q = questions[qIdx];
    const currentOpts = q.options || [];
    const nextLabel = ALPHABET[currentOpts.length] || `Opt${currentOpts.length + 1}`;
    const newOption = {
      label: nextLabel,
      text: '',
      full_text: `${nextLabel}. `,
      highlighted: false,
      highlightColor: null
    };
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      options: [...currentOpts, newOption]
    };
    setQuestions(updated);
  };

  const handleDeleteOption = (qIdx, optIdx) => {
    const q = questions[qIdx];
    const currentOpts = q.options || [];
    const removedOpt = currentOpts[optIdx];
    const remaining = currentOpts.filter((_, idx) => idx !== optIdx);

    const reLabeled = remaining.map((opt, idx) => {
      const newLabel = ALPHABET[idx] || `Opt${idx + 1}`;
      return {
        ...opt,
        label: newLabel,
        full_text: `${newLabel}. ${opt.text}`
      };
    });

    const newCorrect = (q.correctAnswers || [])
      .filter(ans => ans !== removedOpt.label)
      .map(ans => {
        const oldIdx = currentOpts.findIndex(o => o.label === ans);
        return (oldIdx !== -1 && oldIdx < reLabeled.length) ? reLabeled[oldIdx].label : ans;
      });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      options: reLabeled,
      correctAnswers: newCorrect,
      hasHighlight: newCorrect.length > 0
    };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // STATEMENTS CRUD (True / False)
  // -------------------------------------------------------------
  const handleToggleStatementAnswer = (qIdx, stIdx, newAnswer) => {
    const q = questions[qIdx];
    const newStatements = [...(q.statements || [])];
    newStatements[stIdx] = {
      ...newStatements[stIdx],
      correctAnswer: newAnswer,
      highlighted: true
    };
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      statements: newStatements,
      correctAnswers: newStatements.map(s => s.correctAnswer),
      hasHighlight: true
    };
    setQuestions(updated);
  };

  const handleUpdateStatementText = (qIdx, stIdx, text) => {
    const q = questions[qIdx];
    const newStatements = [...(q.statements || [])];
    newStatements[stIdx] = {
      ...newStatements[stIdx],
      content: text
    };
    const updated = [...questions];
    updated[qIdx] = { ...q, statements: newStatements };
    setQuestions(updated);
  };

  const handleAddStatement = (qIdx) => {
    const q = questions[qIdx];
    const currentStatements = q.statements || [];
    const newSt = {
      id: `st_${Date.now()}_${currentStatements.length + 1}`,
      order: currentStatements.length + 1,
      content: `Mệnh đề số ${currentStatements.length + 1}...`,
      correctAnswer: 'Đúng',
      options: ['Đúng', 'Sai'],
      highlighted: true
    };
    const newStatements = [...currentStatements, newSt];
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      statements: newStatements,
      correctAnswers: newStatements.map(s => s.correctAnswer),
      hasHighlight: true
    };
    setQuestions(updated);
  };

  const handleDeleteStatement = (qIdx, stIdx) => {
    const q = questions[qIdx];
    const newStatements = (q.statements || []).filter((_, idx) => idx !== stIdx);
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      statements: newStatements,
      correctAnswers: newStatements.map(s => s.correctAnswer)
    };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // FILL BLANK
  // -------------------------------------------------------------
  const getQuestionBlankCount = (q) => {
    if (q.blankCount && q.blankCount > 1) return q.blankCount;
    const content = q.content || '';
    const blankRegex = /(_{2,}\s*(?:\(\s*\d+\s*\)|\[\s*\d+\s*\])?|\[\s*(?:\.{2,}|blank|ô\s*trống|_+|\d+|\.\.\.)\s*\]|\(\s*(?:\d+|\.{2,})\s*\)|\.{3,})/g;
    const matches = content.match(blankRegex) || [];
    return Math.max(matches.length, (q.correctAnswers || []).length, 1);
  };

  const handleFillBlankChange = (qIdx, text) => {
    const answers = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const q = questions[qIdx];
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      correctAnswers: answers,
      hasHighlight: answers.length > 0,
      warning: answers.length === 0 ? '⚠ Vui lòng nhập từ đáp án' : null
    };
    setQuestions(updated);
  };

  const handleMultiFillBlankChange = (qIdx, bIdx, text) => {
    const q = questions[qIdx];
    const newAnswers = [...(q.correctAnswers || [])];
    while (newAnswers.length <= bIdx) {
      newAnswers.push('');
    }
    newAnswers[bIdx] = text;
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      correctAnswers: newAnswers,
      hasHighlight: newAnswers.some(a => Boolean(a && a.trim()))
    };
    setQuestions(updated);
  };

  const handleSetBlankCount = (qIdx, newCount) => {
    const q = questions[qIdx];
    const count = Math.max(1, newCount);
    const newAnswers = [...(q.correctAnswers || [])];
    while (newAnswers.length < count) {
      newAnswers.push('');
    }
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      blankCount: count,
      correctAnswers: newAnswers.slice(0, count)
    };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // DRAG & DROP BLANK & BANK CRUD
  // -------------------------------------------------------------
  const getQuestionBank = (q) => {
    if (Array.isArray(q.bank) && q.bank.length > 0) {
      return q.bank;
    }
    const fromItems = (q.items || []).flatMap(it => {
      if (Array.isArray(it.correctAnswers) && it.correctAnswers.length > 0) {
        return it.correctAnswers;
      }
      if (it.correctAnswer) {
        return String(it.correctAnswer).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
      }
      return [];
    });
    return Array.from(new Set(fromItems));
  };

  const handleAddBankWord = (qIdx) => {
    const q = questions[qIdx];
    const currentBank = getQuestionBank(q);
    const newWord = `Từ kéo thả ${currentBank.length + 1}`;
    const updatedBank = [...currentBank, newWord];
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      bank: updatedBank
    };
    setQuestions(updated);
  };

  const handleUpdateBankWord = (qIdx, wordIdx, newVal) => {
    const q = questions[qIdx];
    const currentBank = [...getQuestionBank(q)];
    const oldVal = currentBank[wordIdx];
    currentBank[wordIdx] = newVal;

    const newItems = (q.items || []).map(it => {
      const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
        ? [...it.correctAnswers]
        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);
      const replaced = curAnswers.map(a => a === oldVal ? newVal : a);
      return {
        ...it,
        correctAnswer: replaced.join(', '),
        correctAnswers: replaced
      };
    });

    const allCorrect = [];
    newItems.forEach(it => {
      (it.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      bank: currentBank,
      items: newItems,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  const handleDeleteBankWord = (qIdx, wordIdx) => {
    const q = questions[qIdx];
    const currentBank = getQuestionBank(q);
    const wordToRemove = currentBank[wordIdx];
    const updatedBank = currentBank.filter((_, idx) => idx !== wordIdx);

    const newItems = (q.items || []).map(it => {
      const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
        ? it.correctAnswers.filter(w => w !== wordToRemove)
        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(w => w && w !== wordToRemove) : []);
      return {
        ...it,
        correctAnswer: curAnswers.join(', '),
        correctAnswers: curAnswers
      };
    });

    const allCorrect = [];
    newItems.forEach(it => {
      (it.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      bank: updatedBank,
      items: newItems,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  // Chọn/sửa vị trí đáp án cho một từ trong hộp từ
  const handleSetWordSlot = (qIdx, word, targetSlot) => {
    const q = questions[qIdx];
    const newItems = (q.items || []).map(it => {
      const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
        ? [...it.correctAnswers]
        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);

      if (targetSlot === 'distractor' || !targetSlot) {
        const filtered = curAnswers.filter(w => w !== word);
        return {
          ...it,
          correctAnswer: filtered.join(', '),
          correctAnswers: filtered
        };
      }

      if (String(it.blank) === String(targetSlot)) {
        if (!curAnswers.includes(word)) {
          curAnswers.push(word);
        }
        return {
          ...it,
          correctAnswer: curAnswers.join(', '),
          correctAnswers: curAnswers
        };
      } else {
        const filtered = curAnswers.filter(w => w !== word);
        return {
          ...it,
          correctAnswer: filtered.join(', '),
          correctAnswers: filtered
        };
      }
    });

    const allCorrect = [];
    newItems.forEach(it => {
      (it.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  // Bật/tắt gán từ vào 1 vị trí cụ thể (hỗ trợ 1 từ thuộc nhiều vị trí)
  const handleToggleWordSlot = (qIdx, word, blankNum) => {
    const q = questions[qIdx];
    const newItems = (q.items || []).map(it => {
      const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
        ? [...it.correctAnswers]
        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);

      if (String(it.blank) === String(blankNum)) {
        let updatedList;
        if (curAnswers.includes(word)) {
          updatedList = curAnswers.filter(w => w !== word);
        } else {
          updatedList = [...curAnswers, word];
        }
        return {
          ...it,
          correctAnswer: updatedList.join(', '),
          correctAnswers: updatedList
        };
      }
      return it;
    });

    const allCorrect = [];
    newItems.forEach(it => {
      (it.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  // Thêm từ trực tiếp vào 1 câu trống từ hộp từ hoặc gõ
  const handleAddWordToBlank = (qIdx, itIdx, word) => {
    if (!word) return;
    const cleanWord = word.trim();
    if (!cleanWord) return;
    const q = questions[qIdx];
    const newItems = [...(q.items || [])];
    const it = newItems[itIdx];
    const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
      ? [...it.correctAnswers]
      : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);

    if (!curAnswers.includes(cleanWord)) {
      curAnswers.push(cleanWord);
    }
    newItems[itIdx] = {
      ...it,
      correctAnswer: curAnswers.join(', '),
      correctAnswers: curAnswers
    };

    let currentBank = [...getQuestionBank(q)];
    if (!currentBank.includes(cleanWord)) {
      currentBank.push(cleanWord);
    }

    const allCorrect = [];
    newItems.forEach(item => {
      (item.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      bank: currentBank,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  // Xóa từ khỏi 1 câu trống
  const handleRemoveWordFromBlank = (qIdx, itIdx, word) => {
    const q = questions[qIdx];
    const newItems = [...(q.items || [])];
    const it = newItems[itIdx];
    const curAnswers = it.correctAnswers && it.correctAnswers.length > 0
      ? it.correctAnswers.filter(w => w !== word)
      : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(w => w && w !== word) : []);

    newItems[itIdx] = {
      ...it,
      correctAnswer: curAnswers.join(', '),
      correctAnswers: curAnswers
    };

    const allCorrect = [];
    newItems.forEach(item => {
      (item.correctAnswers || []).forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  // Chỉnh sửa số thứ tự vị trí ô trống
  const handleUpdateBlankNumber = (qIdx, itIdx, newBlankNum) => {
    const q = questions[qIdx];
    const newItems = [...(q.items || [])];
    newItems[itIdx] = {
      ...newItems[itIdx],
      blank: newBlankNum
    };
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems
    };
    setQuestions(updated);
  };

  const handleShuffleBank = (qIdx) => {
    const q = questions[qIdx];
    const currentBank = getQuestionBank(q);
    const shuffled = shuffleArray(currentBank);
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      bank: shuffled
    };
    setQuestions(updated);
  };

  const handleUpdateBlankItem = (qIdx, itIdx, field, val) => {
    const q = questions[qIdx];
    const newItems = [...(q.items || [])];
    let currentBank = [...getQuestionBank(q)];

    if (field === 'correctAnswer') {
      const parsedTokens = String(val).split(/[,;]+/).map(w => w.trim()).filter(Boolean);
      newItems[itIdx] = {
        ...newItems[itIdx],
        correctAnswer: val,
        correctAnswers: parsedTokens
      };

      // Add any new tokens into currentBank if not present
      parsedTokens.forEach(token => {
        if (!currentBank.includes(token)) {
          currentBank.push(token);
        }
      });
    } else {
      newItems[itIdx] = { ...newItems[itIdx], [field]: val };
    }

    const allCorrect = [];
    newItems.forEach(it => {
      const tokens = it.correctAnswers && it.correctAnswers.length > 0
        ? it.correctAnswers
        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);
      tokens.forEach(t => {
        if (!allCorrect.includes(t)) allCorrect.push(t);
      });
    });

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      bank: currentBank,
      correctAnswers: allCorrect
    };
    setQuestions(updated);
  };

  const handleAddBlankItem = (qIdx) => {
    const q = questions[qIdx];
    const currentItems = q.items || [];
    const nextBlankNum = currentItems.length + 1;
    const defaultAns = `Đáp án ${nextBlankNum}`;
    const newItem = {
      blank: nextBlankNum,
      text: `${nextBlankNum}. _____ nội dung vị trí trống`,
      correctAnswer: defaultAns,
      highlighted: true
    };
    const newItems = [...currentItems, newItem];
    const currentBank = getQuestionBank(q);
    const updatedBank = currentBank.includes(defaultAns) ? currentBank : [...currentBank, defaultAns];

    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      bank: updatedBank,
      correctAnswers: newItems.map(it => it.correctAnswer),
      hasHighlight: true
    };
    setQuestions(updated);
  };

  const handleDeleteBlankItem = (qIdx, itIdx) => {
    const q = questions[qIdx];
    const newItems = (q.items || []).filter((_, idx) => idx !== itIdx);
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      items: newItems,
      correctAnswers: newItems.map(it => it.correctAnswer)
    };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // MATCHING PAIRS CRUD
  // -------------------------------------------------------------
  const handlePairChange = (qIdx, pairIdx, field, val) => {
    const q = questions[qIdx];
    const newPairs = [...(q.pairs || [])];
    newPairs[pairIdx] = { ...newPairs[pairIdx], [field]: val };
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      pairs: newPairs,
      correctAnswers: newPairs.map(p => `${p.left} → ${p.right}`)
    };
    setQuestions(updated);
  };

  const handleAddPair = (qIdx) => {
    const q = questions[qIdx];
    const currentPairs = q.pairs || [];
    const newPair = {
      id: `pair_${Date.now()}_${currentPairs.length + 1}`,
      left: '',
      right: '',
      highlighted: true
    };
    const newPairs = [...currentPairs, newPair];
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      pairs: newPairs,
      correctAnswers: newPairs.map(p => `${p.left} → ${p.right}`),
      hasHighlight: true
    };
    setQuestions(updated);
  };

  const handleDeletePair = (qIdx, pairIdx) => {
    const q = questions[qIdx];
    const newPairs = (q.pairs || []).filter((_, idx) => idx !== pairIdx);
    const updated = [...questions];
    updated[qIdx] = {
      ...q,
      pairs: newPairs,
      correctAnswers: newPairs.map(p => `${p.left} → ${p.right}`)
    };
    setQuestions(updated);
  };

  // -------------------------------------------------------------
  // FULL QUESTION ADD / DELETE
  // -------------------------------------------------------------
  const handleAddQuestion = () => {
    const nextOrder = questions.length + 1;
    const newQ = {
      id: `q_${Date.now()}`,
      order: nextOrder,
      type: 'single_choice',
      content: `Nội dung câu hỏi số ${nextOrder}...`,
      options: [
        { label: 'A', text: 'Phương án A', full_text: 'A. Phương án A', highlighted: true, highlightColor: 'yellow' },
        { label: 'B', text: 'Phương án B', full_text: 'B. Phương án B', highlighted: false, highlightColor: null },
        { label: 'C', text: 'Phương án C', full_text: 'C. Phương án C', highlighted: false, highlightColor: null },
        { label: 'D', text: 'Phương án D', full_text: 'D. Phương án D', highlighted: false, highlightColor: null }
      ],
      correctAnswers: ['A'],
      statements: [],
      items: [],
      pairs: [],
      hasHighlight: true,
      highlightSource: 'Tạo mới thủ công',
      warning: null
    };
    setQuestions([...questions, newQ]);
  };

  const handleDeleteQuestion = (qIdx) => {
    if (!window.confirm(`Bạn có chắc muốn xóa Câu ${questions[qIdx].order || qIdx + 1}?`)) return;
    const remaining = questions.filter((_, idx) => idx !== qIdx);
    const renumbered = remaining.map((q, idx) => ({ ...q, order: idx + 1 }));
    setQuestions(renumbered);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(quiz.id, title, questions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Lỗi lưu bài thi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const warningCount = questions.filter(q => !q.hasHighlight || q.warning).length;

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem',
        background: '#ffffff',
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> Về trang chủ
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  maxWidth: '500px'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = 'transparent'}
                title="Bấm để đổi tên bài thi"
              />
              <Edit2 size={16} style={{ color: '#94a3b8' }} />
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', paddingLeft: '8px' }}>
              Tổng số câu hỏi: <strong>{questions.length}</strong> câu &bull; Đã mở tính năng sửa chữ & thêm đáp án
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleShuffleAllQuestions}
            style={{ borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 600 }}
            title="Đảo ngẫu nhiên thứ tự các câu hỏi trong đề thi"
          >
            <Shuffle size={16} style={{ color: '#7c3aed' }} /> Đảo câu hỏi
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleShuffleAllAnswers}
            style={{ borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 600 }}
            title="Đảo ngẫu nhiên vị trí các đáp án trong toàn bộ đề thi"
          >
            <Shuffle size={16} style={{ color: '#7c3aed' }} /> Đảo tất cả đáp án
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleAddQuestion}
            style={{ borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 600 }}
          >
            <Plus size={16} /> + Thêm câu hỏi mới
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSaveAll}
            disabled={isSaving}
          >
            <Save size={16} /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onStartQuiz(quiz.id)}
            style={{ padding: '0.65rem 1.4rem' }}
          >
            <Play size={16} /> Bắt đầu làm bài thi
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          background: '#f5f3ff',
          border: '1.5px solid #ddd6fe',
          color: '#6d28d9',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <Shuffle size={18} style={{ color: '#7c3aed' }} /> {toastMessage}
        </div>
      )}

      {/* Guide Banner */}
      <div style={{
        background: '#f5f3ff',
        border: '1px solid #ddd6fe',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.925rem',
        lineHeight: 1.5
      }}>
        <Sparkles size={22} style={{ color: '#7c3aed', flexShrink: 0 }} />
        <div>
          <strong style={{ color: '#6d28d9' }}>Mẹo chỉnh sửa trước khi kiểm tra:</strong>
          <span style={{ marginLeft: '0.35rem', color: '#334155' }}>
            Bạn có thể <strong>gõ trực tiếp vào các ô chữ</strong> để sửa câu hỏi và phương án, bấm nút <strong>"+ Thêm phương án"</strong> ở mỗi câu để tạo thêm đáp án mới (E, F...), bấm <strong>"Chọn làm đáp án đúng"</strong> để thay đổi đáp án, hoặc bấm biểu tượng <strong>Thùng rác</strong> để xóa!
          </span>
        </div>
      </div>

      {saveSuccess && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} /> Đã lưu thành công các chỉnh sửa vào cơ sở dữ liệu!
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
        marginBottom: '1.25rem'
      }}>
        <button
          className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('all')}
        >
          Tất cả ({questions.length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'single_choice' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('single_choice')}
        >
          Chọn 1 ({questions.filter(q => q.type === 'single_choice').length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'multiple_choice' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('multiple_choice')}
        >
          Chọn nhiều ({questions.filter(q => q.type === 'multiple_choice').length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'true_false' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('true_false')}
        >
          Đúng / Sai ({questions.filter(q => q.type === 'true_false').length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'fill_blank' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('fill_blank')}
        >
          Điền từ ({questions.filter(q => q.type === 'fill_blank').length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'drag_drop_blank' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('drag_drop_blank')}
        >
          Kéo thả ô ({questions.filter(q => q.type === 'drag_drop_blank').length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'matching' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('matching')}
        >
          Ghép đôi ({questions.filter(q => q.type === 'matching').length})
        </button>
        {warningCount > 0 && (
          <button
            className={`btn btn-sm ${filterType === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderColor: '#fde68a',
              background: filterType === 'warning' ? '#d97706' : '#fffbeb',
              color: filterType === 'warning' ? '#ffffff' : '#92400e'
            }}
            onClick={() => setFilterType('warning')}
          >
            <AlertTriangle size={14} /> Cần kiểm tra ({warningCount})
          </button>
        )}
      </div>

      {/* Question Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filteredQuestions.map((q) => {
          const qActualIndex = questions.findIndex(orig => orig.id === q.id);

          return (
            <div
              key={q.id}
              className="card"
              style={{
                borderLeft: q.hasHighlight ? '4px solid #10b981' : '4px solid #f59e0b',
                position: 'relative'
              }}
            >
              {/* Question Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#7c3aed',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem'
                  }}>
                    {q.order || qActualIndex + 1}
                  </span>

                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                    Câu {q.order || qActualIndex + 1}
                  </span>

                  <select
                    value={q.type}
                    onChange={(e) => handleUpdateQuestion(qActualIndex, 'type', e.target.value)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: '#334155',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    {QUESTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>


                  {q.hasHighlight ? (
                    <span className="badge badge-success" title={q.highlightSource}>
                      <CheckCircle2 size={14} /> ✓ {q.highlightSource || 'Word Highlight'}
                    </span>
                  ) : (
                    <span className="badge badge-warning" title={q.warning}>
                      <AlertTriangle size={14} /> {q.warning || 'Chưa có Highlight'}
                    </span>
                  )}

                  <button
                    onClick={() => handleDeleteQuestion(qActualIndex)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title="Xóa câu hỏi này"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Editable Question Content */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  ✏ Nội dung câu hỏi (Gõ để sửa):
                </label>
                <textarea
                  value={q.content || ''}
                  onChange={(e) => handleUpdateQuestion(qActualIndex, 'content', e.target.value)}
                  rows={Math.min(12, Math.max(2, (q.content || '').split('\n').length))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '1rem',
                    color: '#0f172a',
                    fontWeight: 500,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none',
                    background: '#ffffff',
                    whiteSpace: 'pre-wrap',
                    tabSize: 4,
                    fontFamily: (q.content || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              {/* ---------------- 1. SINGLE CHOICE ---------------- */}
              {q.type === 'single_choice' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                      ✏ Các phương án trả lời (Gõ vào ô để sửa chữ, bấm nút để chọn đáp án đúng):
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddOption(qActualIndex)}
                      style={{
                        fontSize: '0.8rem',
                        borderColor: '#ddd6fe',
                        color: '#7c3aed',
                        background: '#f5f3ff',
                        fontWeight: 700
                      }}
                    >
                      <Plus size={15} /> + Thêm phương án
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(q.options || []).map((opt, optIdx) => {
                      const isCorrect = (q.correctAnswers || []).includes(opt.label);
                      return (
                        <div
                          key={opt.label + '_' + optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            background: isCorrect ? '#ecfdf5' : '#ffffff',
                            border: isCorrect ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Option Badge */}
                          <div
                            className="option-badge"
                            style={{
                              background: isCorrect ? '#10b981' : '#f1f5f9',
                              color: isCorrect ? '#ffffff' : '#475569',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSingleChoiceSelect(qActualIndex, opt.label)}
                            title="Bấm để chọn làm đáp án đúng"
                          >
                            {opt.label}
                          </div>

                          {/* Editable Text Area for single choice option */}
                          <textarea
                            value={opt.text !== undefined ? opt.text : (opt.full_text || '')}
                            onChange={(e) => handleUpdateOptionText(qActualIndex, optIdx, e.target.value)}
                            placeholder={`Gõ nội dung phương án ${opt.label}...`}
                            rows={Math.min(8, Math.max(1, (opt.text || opt.full_text || '').split('\n').length))}
                            style={{
                              flex: 1,
                              border: '1.5px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.95rem',
                              fontWeight: isCorrect ? 700 : 500,
                              background: '#ffffff',
                              outline: 'none',
                              color: '#0f172a',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              tabSize: 4,
                              resize: 'vertical',
                              fontFamily: (opt.text || opt.full_text || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                          />

                          {/* Toggle Correct Button */}
                          <button
                            type="button"
                            onClick={() => handleSingleChoiceSelect(qActualIndex, opt.label)}
                            style={{
                              border: 'none',
                              background: isCorrect ? '#10b981' : '#f1f5f9',
                              color: isCorrect ? '#ffffff' : '#64748b',
                              borderRadius: '8px',
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isCorrect ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                            {isCorrect ? 'Đáp án đúng' : 'Chọn làm đáp án đúng'}
                          </button>

                          {/* Delete Option */}
                          {(q.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(qActualIndex, optIdx)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              title="Xóa phương án này"
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------------- 2. MULTIPLE CHOICE ---------------- */}
              {q.type === 'multiple_choice' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                      ✏ Các phương án trả lời (Gõ vào ô để sửa chữ, bấm nút để chọn nhiều đáp án đúng):
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddOption(qActualIndex)}
                      style={{
                        fontSize: '0.8rem',
                        borderColor: '#ddd6fe',
                        color: '#7c3aed',
                        background: '#f5f3ff',
                        fontWeight: 700
                      }}
                    >
                      <Plus size={15} /> + Thêm phương án
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(q.options || []).map((opt, optIdx) => {
                      const isCorrect = (q.correctAnswers || []).includes(opt.label);
                      return (
                        <div
                          key={opt.label + '_' + optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            background: isCorrect ? '#ecfdf5' : '#ffffff',
                            border: isCorrect ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div
                            className="option-badge"
                            style={{
                              background: isCorrect ? '#10b981' : '#f1f5f9',
                              color: isCorrect ? '#ffffff' : '#475569',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            onClick={() => handleMultiChoiceToggle(qActualIndex, opt.label)}
                            title="Bấm để bật/tắt đáp án đúng"
                          >
                            {opt.label}
                          </div>

                          <textarea
                            value={opt.text !== undefined ? opt.text : (opt.full_text || '')}
                            onChange={(e) => handleUpdateOptionText(qActualIndex, optIdx, e.target.value)}
                            placeholder={`Gõ nội dung phương án ${opt.label}...`}
                            rows={Math.min(8, Math.max(1, (opt.text || opt.full_text || '').split('\n').length))}
                            style={{
                              flex: 1,
                              border: '1.5px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.95rem',
                              fontWeight: isCorrect ? 700 : 500,
                              background: '#ffffff',
                              outline: 'none',
                              color: '#0f172a',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              tabSize: 4,
                              resize: 'vertical',
                              fontFamily: (opt.text || opt.full_text || '').includes('\n') ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                          />

                          <button
                            type="button"
                            onClick={() => handleMultiChoiceToggle(qActualIndex, opt.label)}
                            style={{
                              border: 'none',
                              background: isCorrect ? '#10b981' : '#f1f5f9',
                              color: isCorrect ? '#ffffff' : '#64748b',
                              borderRadius: '8px',
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isCorrect ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                            {isCorrect ? 'Đáp án đúng' : 'Chọn đúng'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteOption(qActualIndex, optIdx)}
                            disabled={(q.options || []).length <= 2}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: (q.options || []).length <= 2 ? '#cbd5e1' : '#94a3b8',
                              cursor: (q.options || []).length <= 2 ? 'not-allowed' : 'pointer',
                              padding: '6px',
                              borderRadius: '6px'
                            }}
                            title="Xóa phương án này"
                            onMouseEnter={(e) => {
                              if ((q.options || []).length > 2) e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              if ((q.options || []).length > 2) e.currentTarget.style.color = '#94a3b8';
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------------- 3. TRUE / FALSE ---------------- */}
              {q.type === 'true_false' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                      ✏ Các phát biểu Đúng / Sai (Gõ vào ô để sửa nội dung mệnh đề):
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddStatement(qActualIndex)}
                      style={{ fontSize: '0.8rem', borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 700 }}
                    >
                      <Plus size={15} /> + Thêm mệnh đề
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(q.statements || []).map((st, stIdx) => (
                      <div
                        key={st.id || stIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1.5px solid #e2e8f0',
                          gap: '0.75rem'
                        }}
                      >
                        <span style={{ fontWeight: 800, color: '#18181b', fontSize: '0.9rem', minWidth: '22px' }}>
                          {stIdx + 1}.
                        </span>

                        <input
                          type="text"
                          value={st.content || ''}
                          onChange={(e) => handleUpdateStatementText(qActualIndex, stIdx, e.target.value)}
                          placeholder="Gõ nội dung phát biểu..."
                          style={{
                            flex: 1,
                            padding: '0.5rem 0.75rem',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            background: '#ffffff',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />

                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${st.correctAnswer === 'Đúng' ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => handleToggleStatementAnswer(qActualIndex, stIdx, 'Đúng')}
                          >
                            Đúng {st.correctAnswer === 'Đúng' && '✓'}
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${st.correctAnswer === 'Sai' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggleStatementAnswer(qActualIndex, stIdx, 'Sai')}
                          >
                            Sai {st.correctAnswer === 'Sai' && '✓'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStatement(qActualIndex, stIdx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px'
                          }}
                          title="Xóa mệnh đề này"
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------- 4. FILL BLANK ---------------- */}
              {q.type === 'fill_blank' && (() => {
                const blankCount = getQuestionBlankCount(q);
                if (blankCount <= 1) {
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700, margin: 0 }}>
                          ✏ Từ / Cụm từ đáp án đúng (Gõ vào ô để sửa, ngăn cách bằng dấu phẩy nếu có nhiều từ tương đương):
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSetBlankCount(qActualIndex, 2)}
                          style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#7c3aed', background: '#f5f3ff', borderColor: '#ddd6fe' }}
                          title="Thêm khoảng trống thứ 2 vào câu hỏi"
                        >
                          + Thêm ô trống
                        </button>
                      </div>
                      <input
                        type="text"
                        defaultValue={(q.correctAnswers || []).join(', ')}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#cbd5e1';
                          handleFillBlankChange(qActualIndex, e.target.value);
                        }}
                        placeholder="Gõ từ đáp án đúng (ví dụ: Hà Nội, Ha Noi)..."
                        style={{
                          width: '100%',
                          padding: '0.75rem 0.95rem',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: '#18181b',
                          background: '#ffffff',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                      />
                    </div>
                  );
                }

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                        ✏ Đáp án đúng cho từng ô trống ({blankCount} ô trống theo thứ tự):
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSetBlankCount(qActualIndex, blankCount + 1)}
                          style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#7c3aed', background: '#f5f3ff', borderColor: '#ddd6fe' }}
                        >
                          + Thêm ô trống
                        </button>
                        {blankCount > 1 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetBlankCount(qActualIndex, blankCount - 1)}
                            style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#ef4444' }}
                          >
                            - Bớt ô trống
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {Array.from({ length: blankCount }, (_, bIdx) => {
                        const curAns = (q.correctAnswers || [])[bIdx] || '';
                        return (
                          <div
                            key={bIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              background: '#f8fafc',
                              padding: '0.6rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <span style={{
                              background: '#ede9fe',
                              color: '#7c3aed',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              minWidth: '85px',
                              textAlign: 'center'
                            }}>
                              Ô trống {bIdx + 1}
                            </span>
                            <input
                              type="text"
                              defaultValue={curAns}
                              key={`${qActualIndex}_${bIdx}_${curAns}`}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e1';
                                handleMultiFillBlankChange(qActualIndex, bIdx, e.target.value);
                              }}
                              placeholder={`Đáp án đúng cho ô trống ${bIdx + 1} (dùng dấu / hoặc , nếu có từ đồng nghĩa)...`}
                              style={{
                                flex: 1,
                                padding: '0.6rem 0.85rem',
                                borderRadius: '6px',
                                border: '1.5px solid #cbd5e1',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: '#18181b',
                                background: '#ffffff',
                                outline: 'none'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ---------------- 5. DRAG & DROP BLANK ---------------- */}
              {q.type === 'drag_drop_blank' && (() => {
                const bankWords = getQuestionBank(q);
                return (
                  <div>
                    {/* HỘP CHỨA CÁC ĐÁP ÁN KÉO THẢ (WORD BANK) */}
                    <div style={{
                      background: '#ffffff',
                      border: '1.5px solid #ddd6fe',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <h5 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                            <Package size={18} style={{ color: '#7c3aed' }} />
                            Hộp chứa các đáp án kéo thả ({bankWords.length} từ)
                          </h5>
                          <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
                            Chứa toàn bộ các từ học sinh sẽ nhìn thấy để kéo thả. Bạn có thể <strong>thêm các đáp án gây nhiễu / từ bổ sung</strong>, chỉnh sửa trực tiếp chữ hoặc xóa bớt.
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleShuffleBank(qActualIndex)}
                            style={{ fontSize: '0.8rem', borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 600 }}
                            title="Xáo trộn thứ tự các từ trong hộp"
                          >
                            <Shuffle size={14} style={{ color: '#7c3aed' }} /> Đảo thứ tự hộp
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddBankWord(qActualIndex)}
                            style={{ fontSize: '0.8rem', background: '#7c3aed', color: '#ffffff', border: '1px solid #7c3aed', fontWeight: 700 }}
                          >
                            <Plus size={14} /> + Thêm từ vào hộp kéo
                          </button>
                        </div>
                      </div>

                      {/* Danh sách các chip từ trong hộp */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                        {bankWords.map((word, wIdx) => {
                          const matchedItems = (q.items || []).filter(it => {
                            const ansList = it.correctAnswers && it.correctAnswers.length > 0
                              ? it.correctAnswers
                              : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(s => s.trim()) : []);
                            return ansList.includes(word);
                          });
                          const slotMatch = matchedItems.length > 0;
                          const isMultiPopoverOpen = activeMultiWord === `${qActualIndex}_${wIdx}`;

                          let selectVal = 'distractor';
                          if (matchedItems.length === 1) {
                            selectVal = String(matchedItems[0].blank);
                          } else if (matchedItems.length > 1) {
                            selectVal = 'multiple';
                          }

                          return (
                            <div
                              key={wIdx}
                              style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.75rem',
                                background: slotMatch ? '#f5f3ff' : '#ffffff',
                                border: slotMatch ? '2px solid #7c3aed' : '1.5px dashed #cbd5e1',
                                borderRadius: '10px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <GripVertical size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                              <input
                                type="text"
                                value={word}
                                onChange={(e) => handleUpdateBankWord(qActualIndex, wIdx, e.target.value)}
                                placeholder="Gõ từ..."
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '0.925rem',
                                  fontWeight: 700,
                                  color: slotMatch ? '#7c3aed' : '#334155',
                                  outline: 'none',
                                  minWidth: '70px',
                                  width: `${Math.max(75, (word.length + 1) * 9)}px`
                                }}
                              />

                              {/* BỘ CHỌN VỊ TRÍ ĐÁP ÁN THỦ CÔNG */}
                              <select
                                value={selectVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'multi_modal') {
                                    setActiveMultiWord(`${qActualIndex}_${wIdx}`);
                                  } else {
                                    handleSetWordSlot(qActualIndex, word, val);
                                  }
                                }}
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  padding: '3px 6px',
                                  borderRadius: '7px',
                                  border: slotMatch ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                                  background: slotMatch ? '#7c3aed' : '#f1f5f9',
                                  color: slotMatch ? '#ffffff' : '#475569',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                                title="Bấm để chọn vị trí đáp án cho từ này hoặc đặt làm từ gây nhiễu"
                              >
                                <option value="distractor" style={{ background: '#ffffff', color: '#475569' }}>
                                  Bổ sung (Gây nhiễu)
                                </option>
                                {(q.items || []).map((it) => (
                                  <option key={it.blank} value={String(it.blank)} style={{ background: '#ffffff', color: '#1e293b' }}>
                                    Vị trí {it.blank}
                                  </option>
                                ))}
                                {matchedItems.length > 1 && (
                                  <option value="multiple" style={{ background: '#ffffff', color: '#7c3aed' }}>
                                    Nhiều vị trí ({matchedItems.map(m => m.blank).join(', ')})
                                  </option>
                                )}
                                <option value="multi_modal" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: 'bold' }}>
                                  ⚙ Tùy chọn nhiều vị trí...
                                </option>
                              </select>

                              {/* Nút popover chọn nhiều vị trí */}
                              <button
                                type="button"
                                onClick={() => setActiveMultiWord(isMultiPopoverOpen ? null : `${qActualIndex}_${wIdx}`)}
                                style={{
                                  border: 'none',
                                  background: isMultiPopoverOpen ? '#ddd6fe' : 'transparent',
                                  color: slotMatch ? '#7c3aed' : '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderRadius: '4px'
                                }}
                                title="Gán từ này vào nhiều vị trí cùng lúc"
                              >
                                <Layers size={13} />
                              </button>

                              {/* Popover chọn nhiều vị trí */}
                              {isMultiPopoverOpen && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    zIndex: 50,
                                    marginTop: '6px',
                                    background: '#ffffff',
                                    border: '1.5px solid #ddd6fe',
                                    borderRadius: '10px',
                                    padding: '0.65rem 0.85rem',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                                    minWidth: '220px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', paddingBottom: '0.35rem', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#1e293b' }}>
                                      Vị trí của "{word}":
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveMultiWord(null)}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto' }}>
                                    {(q.items || []).map(it => {
                                      const ansList = it.correctAnswers && it.correctAnswers.length > 0
                                        ? it.correctAnswers
                                        : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(s => s.trim()) : []);
                                      const isChecked = ansList.includes(word);
                                      return (
                                        <label
                                          key={it.blank}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.45rem',
                                            fontSize: '0.8rem',
                                            color: '#334155',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleWordSlot(qActualIndex, word, it.blank)}
                                          />
                                          <span>
                                            <strong>Vị trí {it.blank}</strong>
                                            {it.text ? ` (${it.text.replace(/^.*_{2,}.*$/, '').substring(0, 16)}...)` : ''}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <div style={{ marginTop: '0.45rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleSetWordSlot(qActualIndex, word, 'distractor');
                                        setActiveMultiWord(null);
                                      }}
                                      style={{ fontSize: '0.725rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                      Gỡ khỏi tất cả vị trí
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Nút xóa từ */}
                              <button
                                type="button"
                                onClick={() => handleDeleteBankWord(qActualIndex, wIdx)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title="Xóa từ này khỏi hộp"
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CÁC VỊ TRÍ Ô TRỐNG CẦN ĐIỀN */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                        ✏ Các câu có ô trống cần điền (Chỉnh sửa số vị trí và chọn đáp án thủ công cho từng câu):
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddBlankItem(qActualIndex)}
                        style={{ fontSize: '0.8rem', borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 700 }}
                      >
                        <Plus size={15} /> + Thêm vị trí trống
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {(q.items || []).map((it, itIdx) => {
                        const itemAnsList = (it.correctAnswers && it.correctAnswers.length > 0)
                          ? it.correctAnswers
                          : (it.correctAnswer ? String(it.correctAnswer).split(/[,;]+/).map(w => w.trim()).filter(Boolean) : []);

                        const unusedBankWords = bankWords.filter(w => !itemAnsList.includes(w));

                        return (
                          <div
                            key={itIdx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.65rem',
                              padding: '0.85rem 1rem',
                              background: '#ffffff',
                              borderRadius: '12px',
                              border: '1.5px solid #e2e8f0',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            {/* Dòng 1: Số vị trí (sửa được) + Nội dung câu + Nút xóa */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                <span className="badge badge-blue" style={{ fontSize: '0.8rem', fontWeight: 800 }}>Vị trí</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={it.blank}
                                  onChange={(e) => handleUpdateBlankNumber(qActualIndex, itIdx, parseInt(e.target.value) || 1)}
                                  style={{
                                    width: '46px',
                                    padding: '4px 6px',
                                    fontWeight: 800,
                                    borderRadius: '8px',
                                    border: '1.5px solid #ddd6fe',
                                    textAlign: 'center',
                                    fontSize: '0.9rem',
                                    color: '#7c3aed',
                                    background: '#f5f3ff',
                                    outline: 'none'
                                  }}
                                  title="Chỉnh sửa số thứ tự vị trí ô trống (chỉnh thủ công)"
                                />
                              </div>

                              <input
                                type="text"
                                value={it.text || ''}
                                onChange={(e) => handleUpdateBlankItem(qActualIndex, itIdx, 'text', e.target.value)}
                                placeholder="Mô tả câu có chỗ trống (ví dụ: 1. _____ dùng để...)"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem 0.75rem',
                                  border: '1.5px solid #cbd5e1',
                                  borderRadius: '8px',
                                  fontSize: '0.925rem',
                                  background: '#ffffff',
                                  outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                              />

                              <button
                                type="button"
                                onClick={() => handleDeleteBlankItem(qActualIndex, itIdx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '6px'
                                }}
                                title="Xóa câu ô trống này"
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Dòng 2: Danh sách đáp án được chọn cho vị trí này + Menu chọn nhanh */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              padding: '0.45rem 0.65rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 800, flexShrink: 0 }}>
                                Đáp án đúng ({itemAnsList.length}):
                              </span>

                              {/* Hiển thị các thẻ đáp án đã chọn */}
                              {itemAnsList.map((ansWord, aIdx) => (
                                <span
                                  key={aIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    color: '#065f46',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.825rem',
                                    fontWeight: 700
                                  }}
                                >
                                  <span>{ansWord}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveWordFromBlank(qActualIndex, itIdx, ansWord)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#065f46',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    title={`Xóa "${ansWord}" khỏi Vị trí ${it.blank}`}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#065f46'}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}

                              {/* Menu chọn đáp án nhanh từ Hộp từ */}
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddWordToBlank(qActualIndex, itIdx, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                style={{
                                  fontSize: '0.775rem',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #ddd6fe',
                                  background: '#ffffff',
                                  color: '#7c3aed',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                                title="Bấm để chọn từ trong Hộp từ vào vị trí này"
                              >
                                <option value="">+ Chọn từ từ Hộp từ...</option>
                                {unusedBankWords.map((w, idx) => (
                                  <option key={idx} value={w}>+ {w}</option>
                                ))}
                              </select>

                              {/* Ô nhập nhanh đáp án mới */}
                              <input
                                type="text"
                                placeholder="+ Gõ từ mới rồi nhấn Enter..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                      handleAddWordToBlank(qActualIndex, itIdx, val);
                                      e.currentTarget.value = '';
                                    }
                                  }
                                }}
                                style={{
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  minWidth: '160px',
                                  background: '#ffffff'
                                }}
                                title="Gõ từ mới rồi nhấn Enter hoặc dấu phẩy để thêm vào vị trí này"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ---------------- 6. MATCHING ---------------- */}
              {q.type === 'matching' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
                      ✏ Các cặp ghép đôi (Thuật ngữ cột trái ↔ Định nghĩa cột phải):
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddPair(qActualIndex)}
                      style={{ fontSize: '0.8rem', borderColor: '#ddd6fe', color: '#7c3aed', background: '#f5f3ff', fontWeight: 700 }}
                    >
                      <Plus size={15} /> + Thêm cặp ghép
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(q.pairs || []).map((p, pIdx) => (
                      <div
                        key={p.id || pIdx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1.5fr auto',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1.5px solid #e2e8f0'
                        }}
                      >
                        <input
                          type="text"
                          value={p.left || ''}
                          onChange={(e) => handlePairChange(qActualIndex, pIdx, 'left', e.target.value)}
                          placeholder="Gõ thuật ngữ bên trái..."
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontWeight: 700,
                            background: '#ffffff',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                        <span style={{ color: '#7c3aed', fontWeight: 800, fontSize: '1.1rem' }}>→</span>
                        <input
                          type="text"
                          value={p.right || ''}
                          onChange={(e) => handlePairChange(qActualIndex, pIdx, 'right', e.target.value)}
                          placeholder="Gõ định nghĩa bên phải..."
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            background: '#ffffff',
                            outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePair(qActualIndex, pIdx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '6px'
                          }}
                          title="Xóa cặp này"
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Save & Start bar */}
      <div style={{
        position: 'sticky',
        bottom: '1.5rem',
        marginTop: '2rem',
        background: '#ffffff',
        padding: '1rem 1.5rem',
        borderRadius: '14px',
        border: '1px solid #cbd5e1',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 40
      }}>
        <div>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>{title}</span>
          <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
            ({questions.length} câu hỏi)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleAddQuestion}>
            <Plus size={16} /> Thêm câu hỏi mới
          </button>
          <button className="btn btn-secondary" onClick={handleSaveAll} disabled={isSaving}>
            <Save size={16} /> Lưu thay đổi
          </button>
          <button className="btn btn-primary" onClick={() => onStartQuiz(quiz.id)}>
            <Play size={16} /> Bắt đầu làm bài thi
          </button>
        </div>
      </div>
    </div>
  );
}
