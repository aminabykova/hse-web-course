/*
  FabVocab — model helpers (pure functions).

  Derivations and selectors over the word data: status/dusty logic, the
  learning loop (grading an answer), aggregate statistics for Home and
  Progress, and small formatting utilities. Keeping these pure (no DOM, no
  storage) makes the DOM a projection of state and keeps the logic testable.
*/

import {
  STATUS,
  MASTERY_STREAK,
  DUSTY_AFTER_DAYS,
  COLORS,
  COLOR_IDS,
  ASSESSMENTS,
} from './data.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an ISO date string and now (null → Infinity). */
export function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / DAY_MS);
}

/** A mastered word untouched for too long is "getting dusty" (derived flag). */
export function isDusty(word) {
  return word.status === STATUS.MASTERED && daysSince(word.lastPracticed) > DUSTY_AFTER_DAYS;
}

/** Percentage of correct answers, 0 when never practised. */
export function successRate(word) {
  if (!word.timesPracticed) return 0;
  return Math.round((word.correctCount / word.timesPracticed) * 100);
}

/** Short label for a word's status, e.g. "learning 3/5" or "dusty". */
export function statusLabel(word) {
  if (isDusty(word)) return 'dusty';
  if (word.status === STATUS.LEARNING) return `learning ${word.streak}/${MASTERY_STREAK}`;
  return word.status;
}

/** Human color label from a color id. */
export function colorLabel(colorId) {
  const match = COLORS.find((color) => color.id === colorId);
  return match ? match.label : colorId;
}

/** Create a fully-formed new word record from raw form values. */
export function createWord({ word, pos, color, definition, translation = '', example = '' }) {
  const today = new Date().toISOString().slice(0, 10);
  const examples = example.trim() ? [example.trim()] : [];
  return {
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    word: word.trim(),
    pos,
    color,
    definition: definition.trim(),
    translation: translation.trim(),
    examples,
    status: STATUS.NEW,
    streak: 0,
    timesPracticed: 0,
    correctCount: 0,
    dateAdded: today,
    lastPracticed: null,
    masteredDate: null,
    language: 'en',
  };
}

/**
 * Grade one answer, returning an updated copy of the word plus a transition
 * tag describing what happened this turn (used for the results screen).
 * @returns {{ word: object, transition: 'mastered'|'demoted'|'dusted'|'none' }}
 */
export function applyAnswer(word, isCorrect) {
  const today = new Date().toISOString().slice(0, 10);
  const wasDusty = isDusty(word);
  const next = {
    ...word,
    timesPracticed: word.timesPracticed + 1,
    lastPracticed: today,
  };

  let transition = 'none';

  if (isCorrect) {
    next.correctCount = word.correctCount + 1;
    next.streak = word.streak + 1;
    if (next.streak >= MASTERY_STREAK && word.status !== STATUS.MASTERED) {
      next.status = STATUS.MASTERED;
      next.masteredDate = today;
      transition = 'mastered';
    } else if (next.streak >= MASTERY_STREAK) {
      next.status = STATUS.MASTERED;
    } else {
      next.status = STATUS.LEARNING;
    }
    // A correct answer on a dusty word freshens it.
    if (wasDusty && transition === 'none') transition = 'dusted';
  } else {
    // A mistake resets the streak and sends the word back to learning.
    next.streak = 0;
    if (word.status === STATUS.MASTERED) transition = 'demoted';
    next.status = STATUS.LEARNING;
  }

  return { word: next, transition };
}

/** Aggregate counts used by Home and Progress. */
export function computeStats(words) {
  const stats = {
    total: words.length,
    new: 0,
    learning: 0,
    mastered: 0,
    dusty: 0,
  };
  for (const word of words) {
    stats[word.status] = (stats[word.status] ?? 0) + 1;
    if (isDusty(word)) stats.dusty += 1;
  }
  return stats;
}

/** Count of words per color id, in palette order. */
export function colorCounts(words) {
  const counts = Object.fromEntries(COLOR_IDS.map((id) => [id, 0]));
  for (const word of words) {
    if (counts[word.color] != null) counts[word.color] += 1;
  }
  return counts;
}

/**
 * Added vs. mastered counts for the last `months` calendar months.
 * @returns {Array<{ key:string, label:string, added:number, mastered:number }>}
 */
export function monthlyStats(words, months = 3) {
  const now = new Date();
  const buckets = [];
  const index = new Map();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = {
      key,
      label: date.toLocaleString('en', { month: 'short' }),
      added: 0,
      mastered: 0,
    };
    buckets.push(bucket);
    index.set(key, bucket);
  }

  const keyOf = (isoDate) => {
    const date = new Date(isoDate);
    return `${date.getFullYear()}-${date.getMonth()}`;
  };

  for (const word of words) {
    if (word.dateAdded) {
      const bucket = index.get(keyOf(word.dateAdded));
      if (bucket) bucket.added += 1;
    }
    if (word.masteredDate) {
      const bucket = index.get(keyOf(word.masteredDate));
      if (bucket) bucket.mastered += 1;
    }
  }

  return buckets;
}

/** Mastered words, most recently mastered first. */
export function recentlyMastered(words, limit = 5) {
  return words
    .filter((word) => word.status === STATUS.MASTERED)
    .sort((a, b) => Date.parse(b.masteredDate || 0) - Date.parse(a.masteredDate || 0))
    .slice(0, limit);
}

/**
 * The "today's pick" word: stable for a given day, biased toward words that
 * need attention (dusty first, then anything not yet mastered, then any).
 */
export function todaysPick(words) {
  if (!words.length) return null;
  const dusty = words.filter(isDusty);
  const pending = words.filter((word) => word.status !== STATUS.MASTERED);
  const pool = dusty.length ? dusty : pending.length ? pending : words;

  const daySeed = Math.floor(Date.now() / DAY_MS);
  return pool[daySeed % pool.length];
}

/** Pick the assessment line for a final quiz score fraction. */
export function assessmentFor(fraction) {
  return (ASSESSMENTS.find((entry) => fraction >= entry.min) || ASSESSMENTS.at(-1)).text;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** `05.10.2026` short date, or em dash for never. */
export function formatShortDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** `Added Jan 12, 2026` long date for the detail card. */
export function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
