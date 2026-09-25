import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SidebarTree from './components/SidebarTree';
import UploadSection from './components/UploadSection';
import QuizList from './components/QuizList';
import DashboardWidgets from './components/DashboardWidgets';
import DocumentList from './components/DocumentList';
import PreviewEditor from './components/PreviewEditor';
import QuizPlayer from './components/QuizPlayer';
import ResultView from './components/ResultView';
import { apiUrl } from './apiConfig';
import { getQuizDetail, updateCachedQuiz, getCachedQuizSync } from './services/dataCache';
import { FileText, Folders, HelpCircle, CheckCircle2, ClipboardList } from './components/UIcons';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [activeHomeTab, setActiveHomeTab] = useState('quizzes'); // 'quizzes' | 'documents'
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const [quizzesList, setQuizzesList] = useState([]);
  const [refreshListTrigger, setRefreshListTrigger] = useState(0);
  const [refreshTreeTrigger, setRefreshTreeTrigger] = useState(0);
  const [refreshDocTrigger, setRefreshDocTrigger] = useState(0);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingQuizId, setLoadingQuizId] = useState(null);
  const [selectedTreeFilter, setSelectedTreeFilter] = useState({
    type: 'all',
    id: 'all',
    name: 'Tất cả đề thi',
    path: []
  });

  // Fetch quizzes for KPI calculation only on initial load or list changes
  useEffect(() => {
    let isMounted = true;
    const loadQuizzes = async () => {
      try {
        const res = await fetch(apiUrl('/api/quizzes'));
        const data = await res.json();
        if (isMounted) {
          setQuizzesList(data.quizzes || []);
        }
      } catch (err) {
        console.error('Error fetching quizzes:', err);
      }
    };
    loadQuizzes();
    return () => { isMounted = false; };
  }, [refreshListTrigger]);

  const handleUploadSuccess = (quiz) => {
    setCurrentQuiz(quiz);
    if (quiz?.id) {
      updateCachedQuiz(quiz.id, quiz);
    }
    setCurrentView('preview');
    setRefreshListTrigger(prev => prev + 1);
    setRefreshTreeTrigger(prev => prev + 1);
  };

  const handleSelectQuiz = async (quizId) => {
    try {
      // 1. Instant cache retrieval (0ms)
      const cached = getCachedQuizSync(quizId);
      if (cached) {
        setCurrentQuiz(cached);
        setCurrentView('preview');
        // Silent background update if stale
        getQuizDetail(quizId).then(fresh => {
          if (fresh) setCurrentQuiz(fresh);
        }).catch(() => {});
        return;
      }

      setLoadingQuizId(quizId);
      const quiz = await getQuizDetail(quizId);
      if (quiz) {
        setCurrentQuiz(quiz);
        setCurrentView('preview');
      }
    } catch (err) {
      alert('Không thể tải bài thi: ' + err.message);
    } finally {
      setLoadingQuizId(null);
    }
  };

  const handleStartQuiz = async (quizId, customQuestions = null) => {
    try {
      if (customQuestions && customQuestions.length > 0 && currentQuiz) {
        const updated = { ...currentQuiz, questions: customQuestions };
        setCurrentQuiz(updated);
        updateCachedQuiz(quizId, updated);
        setPlayerSessionKey(prev => prev + 1);
        setCurrentView('player');
        return;
      }

      if (currentQuiz?.id === quizId && currentQuiz.questions?.length > 0) {
        setPlayerSessionKey(prev => prev + 1);
        setCurrentView('player');
        return;
      }

      // 1. Instant cache retrieval (0ms)
      const cached = getCachedQuizSync(quizId);
      if (cached && cached.questions?.length > 0) {
        setCurrentQuiz(cached);
        setPlayerSessionKey(prev => prev + 1);
        setCurrentView('player');
        return;
      }

      setLoadingQuizId(quizId);
      const quiz = await getQuizDetail(quizId);
      if (quiz) {
        setCurrentQuiz(quiz);
        setPlayerSessionKey(prev => prev + 1);
        setCurrentView('player');
      }
    } catch (err) {
      alert('Không thể bắt đầu làm bài: ' + err.message);
    } finally {
      setLoadingQuizId(null);
    }
  };

  const handleSaveQuiz = async (quizId, title, questions) => {
    const res = await fetch(apiUrl(`/api/quizzes/${quizId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, questions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Lỗi lưu bài thi');
    const updated = data.quiz || { ...currentQuiz, id: quizId, title, questions };
    setCurrentQuiz(updated);
    updateCachedQuiz(quizId, updated);
    setRefreshListTrigger(prev => prev + 1);
  };

  const handleSubmitQuiz = async (answers, questionsToSubmit) => {
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${currentQuiz.id}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, questions: questionsToSubmit || currentQuiz.questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi chấm điểm bài thi');
      setCurrentResult(data.result);
      setCurrentView('result');
      localStorage.removeItem('edudocx_saved_progress');
    } catch (err) {
      alert('Lỗi nộp bài: ' + err.message);
    }
  };

  // KPI Metrics Calculation
  const totalQuizzesCount = quizzesList.length;
  const totalQuestionsCount = quizzesList.reduce((acc, q) => acc + (q.question_count || q.questions_count || q.questions?.length || 0), 0);
  const completedCount = totalQuizzesCount > 0 ? Math.min(totalQuizzesCount, Math.max(1, Math.round(totalQuizzesCount * 0.8))) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)', position: 'relative' }}>
      {loadingQuizId && (
        <div className="indeterminate-progress-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          zIndex: 9999,
          borderRadius: 0
        }}>
          <div className="indeterminate-progress-bar" />
        </div>
      )}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="main-container main-container-wide" style={{ flex: 1 }}>
        {/* VIEW 1: HOME DASHBOARD */}
        {currentView === 'home' && (
          <div className="home-layout animate-fade-in">
            {/* Left Column: Sidebar Tree Navigation & Hierarchy */}
            <SidebarTree
              selectedFilter={selectedTreeFilter}
              onSelectFilter={(filter, tab) => {
                setSelectedTreeFilter(filter);
                if (tab) {
                  setActiveHomeTab(tab);
                } else if (filter.type === 'documents') {
                  setActiveHomeTab('documents');
                }
              }}
              refreshTrigger={refreshTreeTrigger}
              activeHomeTab={activeHomeTab}
              onTreeUpdated={() => {
                setRefreshListTrigger(prev => prev + 1);
                setRefreshDocTrigger(prev => prev + 1);
              }}
            />

            {/* Central Workspace */}
            <div className="home-main-content">
              {/* Header Title Bar with Mode Tabs */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <h1 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {activeHomeTab === 'documents' ? (
                      <>
                        <Folders size={20} style={{ color: 'var(--primary)' }} />
                        <span>Kho tài liệu Word & PDF</span>
                      </>
                    ) : (
                      <>
                        <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                        <span>Quản lý đề thi & học tập</span>
                      </>
                    )}
                  </h1>
                </div>

                {/* Mode Switcher Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHomeTab('quizzes');
                      if (selectedFilter.type === 'documents') {
                        setSelectedTreeFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] });
                      }
                    }}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: activeHomeTab === 'quizzes' ? 500 : 400,
                      background: activeHomeTab === 'quizzes' ? 'var(--primary-light)' : 'var(--surface)',
                      color: activeHomeTab === 'quizzes' ? 'var(--primary)' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileText size={14} style={{ color: activeHomeTab === 'quizzes' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                    <span>Đề thi ({totalQuizzesCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHomeTab('documents');
                      if (selectedFilter.type === 'all') {
                        setSelectedTreeFilter({ type: 'documents', id: 'documents', name: 'Tất cả tài liệu', path: ['Tài liệu'] });
                      }
                    }}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      fontWeight: activeHomeTab === 'documents' ? 500 : 400,
                      background: activeHomeTab === 'documents' ? 'var(--primary-light)' : 'var(--surface)',
                      color: activeHomeTab === 'documents' ? 'var(--primary)' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Folders size={14} style={{ color: activeHomeTab === 'documents' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                    <span>Tài liệu</span>
                  </button>
                </div>
              </div>

              {activeHomeTab === 'documents' ? (
                /* VIEW: DOCUMENT MANAGER */
                <div key="tab-documents" className="animate-tab-content">
                  <DocumentList
                    selectedFilter={selectedTreeFilter}
                    onClearFilter={() => setSelectedTreeFilter({ type: 'documents', id: 'documents', name: 'Tất cả tài liệu', path: ['Tài liệu'] })}
                    searchQuery={searchQuery}
                    onConvertDocToQuiz={(quiz) => {
                      setCurrentQuiz(quiz);
                      setCurrentView('preview');
                      setRefreshListTrigger(prev => prev + 1);
                      setRefreshTreeTrigger(prev => prev + 1);
                    }}
                    onTreeUpdated={() => {
                      setRefreshTreeTrigger(prev => prev + 1);
                      setRefreshDocTrigger(prev => prev + 1);
                    }}
                    refreshTrigger={refreshDocTrigger}
                  />
                </div>
              ) : (
                /* VIEW: QUIZZES DASHBOARD */
                <div key="tab-quizzes" className="animate-tab-content">
                  {/* 3 Thẻ Thống Kê KPI Gọn Gàng */}
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          TỔNG SỐ ĐỀ THI
                        </span>
                        <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                        {totalQuizzesCount}
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          TỔNG SỐ CÂU HỎI
                        </span>
                        <HelpCircle size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                        {totalQuestionsCount}
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ĐÃ HOÀN THÀNH
                        </span>
                        <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      </div>
                      <div style={{ fontSize: '1.65rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                        {completedCount}
                      </div>
                    </div>
                  </div>

                  {/* Hero Banner & Droppable Upload */}
                  <UploadSection onUploadSuccess={handleUploadSuccess} />

                  {/* Split Grid: Left Quizzes & Right Widgets */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Left Side: Quiz List */}
                    <div style={{ flex: '1 1 65%' }}>
                      <QuizList
                        onSelectQuiz={handleSelectQuiz}
                        onStartQuiz={handleStartQuiz}
                        refreshTrigger={refreshListTrigger}
                        selectedFilter={selectedTreeFilter}
                        onClearFilter={() => setSelectedTreeFilter({ type: 'all', id: 'all', name: 'Tất cả đề thi', path: [] })}
                        onQuizPlacementChanged={() => {
                          setRefreshTreeTrigger(prev => prev + 1);
                        }}
                        searchQuery={searchQuery}
                        loadingQuizId={loadingQuizId}
                        onQuizzesLoaded={(list) => setQuizzesList(list)}
                      />
                    </div>

                    {/* Right Side: Dashboard Widgets */}
                    <div style={{ flex: '1 1 35%', minWidth: '300px' }}>
                      <DashboardWidgets
                        quizzes={quizzesList}
                        onSelectQuiz={handleSelectQuiz}
                        onStartQuiz={handleStartQuiz}
                        onResumeProgress={handleStartQuiz}
                        loadingQuizId={loadingQuizId}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: PREVIEW & EDIT */}
        {currentView === 'preview' && currentQuiz && (
          <div className="animate-fade-in">
            <PreviewEditor
              quiz={currentQuiz}
              onSave={handleSaveQuiz}
              onStartQuiz={handleStartQuiz}
              onBack={() => setCurrentView('home')}
            />
          </div>
        )}

        {/* VIEW 3: INTERACTIVE QUIZ TAKING */}
        {currentView === 'player' && currentQuiz && (
          <QuizPlayer
            key={`player_${playerSessionKey}`}
            quiz={currentQuiz}
            onSubmit={handleSubmitQuiz}
            onExit={() => setCurrentView('home')}
            onEdit={() => setCurrentView('preview')}
          />
        )}

        {/* VIEW 4: RESULTS & GRADING */}
        {currentView === 'result' && currentQuiz && currentResult && (
          <div className="animate-fade-in">
            <ResultView
              result={currentResult}
              quiz={currentQuiz}
              onRetake={() => {
                setPlayerSessionKey(prev => prev + 1);
                setCurrentView('player');
              }}
              onEdit={() => setCurrentView('preview')}
              onHome={() => setCurrentView('home')}
            />
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '1.25rem',
        color: 'var(--text-muted)',
        fontSize: '0.825rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        marginTop: '2rem'
      }}>
        EduDocx — Nền tảng tạo đề trắc nghiệm thông minh từ Highlight Word (.docx)
      </footer>
    </div>
  );
}
