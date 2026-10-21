/*
  FabVocab — persistence layer.

  Thin wrapper around localStorage that is defensive on every boundary
  (criterion: safe localStorage read/write + guarded JSON parsing):
    - reads are JSON-parsed inside try/catch and structurally validated
      field by field, so corrupt or partial data is dropped, not trusted;
    - writes are wrapped in try/catch so a full quota / unavailable storage
      returns false instead of throwing, letting the UI warn the user.
*/

import { STORAGE_KEY, COLOR_IDS, PARTS_OF_SPEECH, STATUS } from './data.js';

const VALID_STATUSES = new Set(Object.values(STATUS));
const VALID_COLORS = new Set(COLOR_IDS);
const VALID_POS = new Set(PARTS_OF_SPEECH);

/** A date is either null or a parseable date string. */
function isValidDate(value) {
  if (value == null) return true;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Validate one record's structure. Returns a sanitised word or null if the
 * required shape is missing. We check the actual fields, not just a version.
 */
function sanitizeWord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const { id, word, pos, color, definition } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof word !== 'string' || !word.trim()) return null;
  if (typeof definition !== 'string' || !definition.trim()) return null;
  if (!VALID_COLORS.has(color)) return null;
  if (!VALID_POS.has(pos)) return null;

  const status = VALID_STATUSES.has(raw.status) ? raw.status : STATUS.NEW;
  if (!isValidDate(raw.lastPracticed) || !isValidDate(raw.masteredDate)) return null;

  return {
    id,
    word: word.trim(),
    pos,
    color,
    definition: definition.trim(),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    examples: Array.isArray(raw.examples)
      ? raw.examples.filter((item) => typeof item === 'string' && item.trim())
      : [],
    status,
    streak: Number.isFinite(raw.streak) ? raw.streak : 0,
    timesPracticed: Number.isFinite(raw.timesPracticed) ? raw.timesPracticed : 0,
    correctCount: Number.isFinite(raw.correctCount) ? raw.correctCount : 0,
    dateAdded: isValidDate(raw.dateAdded) && raw.dateAdded
      ? raw.dateAdded
      : new Date().toISOString().slice(0, 10),
    lastPracticed: raw.lastPracticed ?? null,
    masteredDate: raw.masteredDate ?? null,
    language: 'en',
  };
}

/**
 * Load the stored dictionary.
 * @returns {Array|null} a validated array of words, or null when there is
 *   nothing usable stored (so the caller can fall back to the seed).
 */
export function loadWords() {
  let rawString;
  try {
    rawString = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked entirely (private mode / disabled cookies).
    return null;
  }
  if (!rawString) return null;

  let parsed;
  try {
    parsed = JSON.parse(rawString);
  } catch {
    // Corrupt JSON — discard it rather than crashing on boot.
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const words = parsed.map(sanitizeWord).filter(Boolean);
  return words.length ? words : null;
}

/**
 * Persist the dictionary.
 * @returns {boolean} true on success, false if storage refused the write.
 */
export function saveWords(words) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    return true;
  } catch {
    // Quota exceeded or storage unavailable — let the UI tell the user.
    return false;
  }
}
