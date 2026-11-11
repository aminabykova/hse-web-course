/*
  FabVocab — Clipboard API wrapper (HW #3: browser API integration).

  Isolates all access to `navigator.clipboard` in one module so the page
  controllers never touch the API directly:
    - `clipboardStatus()` — feature detection. The API only exists in secure
      contexts (HTTPS or localhost); opening the pages via file:// makes it
      unavailable, which the UI must survive.
    - `readClipboardText()` / `writeClipboardText()` — async read/write with
      typed errors (`ClipboardError.code`: 'unsupported' | 'denied' | 'empty'
      | 'failed') so callers can show a specific message per failure cause.
    - `cleanPastedText()` — normalises clipboard text before it lands in a
      field: strips the surrounding quotes/punctuation copied along with a
      word, collapses whitespace, and (for single-line fields) keeps only the
      first non-empty line.

  Note: reading needs the browser's go-ahead (user activation / permission /
  paste prompt depending on the browser), which is why every read failure
  tells the user they can still paste manually — that path always works.
*/

export class ClipboardError extends Error {
  /**
   * @param {'unsupported'|'denied'|'empty'|'failed'} code machine-readable cause
   * @param {string} [detail] original error message for 'failed'
   */
  constructor(code, detail = '') {
    super(detail || code);
    this.name = 'ClipboardError';
    this.code = code;
  }
}

/**
 * Is the async Clipboard API usable at all?
 * @returns {{ supported: boolean, reason: 'insecure'|'unsupported'|null }}
 */
export function clipboardStatus() {
  if (!window.isSecureContext) return { supported: false, reason: 'insecure' };
  if (!('clipboard' in navigator) || typeof navigator.clipboard.readText !== 'function') {
    return { supported: false, reason: 'unsupported' };
  }
  return { supported: true, reason: null };
}

/**
 * Read plain text from the system clipboard.
 * @returns {Promise<string>} the clipboard text (never empty/whitespace-only)
 * @throws {ClipboardError} unsupported / denied / empty / failed
 */
export async function readClipboardText() {
  const status = clipboardStatus();
  if (!status.supported) throw new ClipboardError('unsupported', status.reason);

  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (error) {
    // NotAllowedError: permission refused or no user activation. Anything
    // else is a transient read failure — the caller offers manual paste.
    if (error && error.name === 'NotAllowedError') throw new ClipboardError('denied');
    throw new ClipboardError('failed', error?.message || 'read failed');
  }

  if (!text || !text.trim()) throw new ClipboardError('empty');
  return text;
}

/**
 * Write plain text to the system clipboard.
 * @param {string} text
 * @returns {Promise<void>}
 * @throws {ClipboardError} unsupported / denied / failed
 */
export async function writeClipboardText(text) {
  const status = clipboardStatus();
  if (!status.supported) throw new ClipboardError('unsupported', status.reason);

  try {
    await navigator.clipboard.writeText(String(text));
  } catch (error) {
    if (error && error.name === 'NotAllowedError') throw new ClipboardError('denied');
    throw new ClipboardError('failed', error?.message || 'write failed');
  }
}

/* ------------------------------------------------------------------ */
/* Pasted-text normalisation                                           */
/* ------------------------------------------------------------------ */

/** Characters people copy around a word: quotes, brackets, dashes, commas. */
const EDGE_JUNK = /^[\s"'“”‘’«»([{—–-]+|[\s"'“”‘’»)\]},.;:—–-]+$/g;

/**
 * Quotes/brackets only — used for multiline text, where trailing `.,;:` are
 * real punctuation, not copy debris.
 */
const QUOTE_JUNK = /^[\s"'“”‘’«»([{]+|[\s"'“”‘’»)\]}]+$/g;

/**
 * Normalise text that came from the clipboard.
 * @param {string} text raw clipboard text
 * @param {object} [options]
 * @param {boolean} [options.multiline] keep line breaks (textarea) instead of
 *   taking the first non-empty line and collapsing to one line
 * @returns {string} cleaned text
 */
export function cleanPastedText(text, { multiline = false } = {}) {
  if (!text) return '';
  const edge = multiline ? QUOTE_JUNK : EDGE_JUNK;
  const cleanLine = (line) => line.replace(edge, '').replace(/[ \t]+/g, ' ').trim();
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map(cleanLine);
  if (multiline) return lines.join('\n').trim();
  return lines.find((line) => line) ?? '';
}
