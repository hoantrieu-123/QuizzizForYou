/**
 * Frontend High-Speed Data Caching & Prefetching Service
 * Provides in-memory SWR (Stale-While-Revalidate) caching for quizzes and tree.
 * Enables 0ms response time on user clicks for preloaded/cached data.
 */
import { apiUrl } from '../apiConfig';

const quizDetailCache = new Map();
const inFlightRequests = new Map();
let quizzesListCache = null;
let treeCache = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh

/**
 * Get quiz details from cache or fetch from API.
 * If in cache, returns immediately (0ms).
 */
export async function getQuizDetail(quizId, { forceRefresh = false } = {}) {
  if (!quizId) return null;

  // 1. Check memory cache
  if (!forceRefresh && quizDetailCache.has(quizId)) {
    const entry = quizDetailCache.get(quizId);
    // Silent background revalidation if older than 1 minute
    if (Date.now() - entry.timestamp > 60 * 1000) {
      prefetchQuizDetail(quizId, true);
    }
    return entry.data;
  }

  // 2. Prevent duplicate concurrent in-flight requests for the same quiz
  if (inFlightRequests.has(quizId)) {
    return inFlightRequests.get(quizId);
  }

  // 3. Fetch from server
  const fetchPromise = (async () => {
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quizId}`));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Không thể tải bài thi`);
      }
      const json = await res.json();
      const quiz = json.quiz || json;
      quizDetailCache.set(quizId, { data: quiz, timestamp: Date.now() });
      return quiz;
    } finally {
      inFlightRequests.delete(quizId);
    }
  })();

  inFlightRequests.set(quizId, fetchPromise);
  return fetchPromise;
}

/**
 * Preload quiz details in background (e.g. on mouse hover or list view).
 * Highly efficient: human hover-to-click delay (150-400ms) allows
 * the quiz to be 100% ready in memory before the user even clicks!
 */
export function prefetchQuizDetail(quizId, force = false) {
  if (!quizId) return;
  if (!force && quizDetailCache.has(quizId)) {
    const entry = quizDetailCache.get(quizId);
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return;
    }
  }
  if (inFlightRequests.has(quizId)) return;

  // Low priority background fetch
  const p = fetch(apiUrl(`/api/quizzes/${quizId}`))
    .then(res => res.ok ? res.json() : null)
    .then(json => {
      if (json?.quiz) {
        quizDetailCache.set(quizId, { data: json.quiz, timestamp: Date.now() });
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlightRequests.delete(quizId);
    });

  inFlightRequests.set(quizId, p);
}

/**
 * Check if a quiz is already available synchronously in memory.
 */
export function getCachedQuizSync(quizId) {
  if (quizDetailCache.has(quizId)) {
    return quizDetailCache.get(quizId).data;
  }
  return null;
}

/**
 * Update quiz in cache directly (e.g. after edit or save).
 */
export function updateCachedQuiz(quizId, quizData) {
  if (!quizId || !quizData) return;
  quizDetailCache.set(quizId, { data: quizData, timestamp: Date.now() });
}

/**
 * Remove quiz from cache (e.g. after delete).
 */
export function removeCachedQuiz(quizId) {
  if (!quizId) return;
  quizDetailCache.delete(quizId);
  inFlightRequests.delete(quizId);
}

/**
 * Invalidate all cached data.
 */
export function clearDataCache() {
  quizDetailCache.clear();
  inFlightRequests.clear();
  quizzesListCache = null;
  treeCache = null;
}

