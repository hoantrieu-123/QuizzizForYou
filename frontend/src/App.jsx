import React, { useState } from 'react';
import Navbar from './components/Navbar';
import UploadSection from './components/UploadSection';
import QuizList from './components/QuizList';
import PreviewEditor from './components/PreviewEditor';
import QuizPlayer from './components/QuizPlayer';
import ResultView from './components/ResultView';
import { apiUrl } from './apiConfig';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentResult, setCurrentResult] = useState(null);
  const [refreshListTrigger, setRefreshListTrigger] = useState(0);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);

  const handleUploadSuccess = (quiz) => {
    setCurrentQuiz(quiz);
    setCurrentView('preview');
    setRefreshListTrigger(prev => prev + 1);
  };

  const handleSelectQuiz = async (quizId) => {
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}`));
      const data = await res.json();
      setCurrentQuiz(data.quiz);
      setCurrentView('preview');
    } catch (err) {
      alert('Không thể tải bài thi: ' + err.message);
    }
  };

  const handleStartQuiz = async (quizId, customQuestions = null) => {
    try {
      if (customQuestions && customQuestions.length > 0 && currentQuiz) {
        setCurrentQuiz({ ...currentQuiz, questions: customQuestions });
        setPlayerSessionKey(prev => prev + 1);
        setCurrentView('player');
        return;
      }
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}`));
      const data = await res.json();
      setCurrentQuiz(data.quiz);
      setPlayerSessionKey(prev => prev + 1);
      setCurrentView('player');
    } catch (err) {
      alert('Không thể bắt đầu làm bài: ' + err.message);
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
    setCurrentQuiz(data.quiz);
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
    } catch (err) {
      alert('Lỗi nộp bài: ' + err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentView={currentView} onNavigate={(view) => setCurrentView(view)} />

      <main className="main-container" style={{ flex: 1 }}>
        {/* VIEW 1: HOME */}
        {currentView === 'home' && (
          <div>
            <UploadSection onUploadSuccess={handleUploadSuccess} />
            <QuizList
              onSelectQuiz={handleSelectQuiz}
              onStartQuiz={handleStartQuiz}
              refreshTrigger={refreshListTrigger}
            />
          </div>
        )}

        {/* VIEW 2: PREVIEW & EDIT */}
        {currentView === 'preview' && currentQuiz && (
          <PreviewEditor
            quiz={currentQuiz}
            onSave={handleSaveQuiz}
            onStartQuiz={handleStartQuiz}
            onBack={() => setCurrentView('home')}
          />
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
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        color: '#94a3b8',
        fontSize: '0.85rem',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff'
      }}>
      </footer>
    </div>
  );
}

