/*
  FabVocab — application state container.

  A single source of truth for the dictionary, shared across all four pages
  via localStorage. The Store owns the `words` array, exposes intent-named
  actions that mutate it, persists after every change, and notifies
  subscribers so the DOM can re-render from state (unidirectional flow:
  event → action → persist → notify → render).
*/

import { SEED_WORDS } from './data.js';
import { loadWords, saveWords } from './storage.js';
import { createWord, applyAnswer } from './model.js';

export class Store {
  #words;
  #subscribers = new Set();
  #saveOk = true;

  constructor() {
    // Load validated words, or fall back to a deep copy of the seed.
    const loaded = loadWords();
    this.#words = loaded ?? SEED_WORDS.map((word) => ({ ...word, examples: [...word.examples] }));
    if (!loaded) this.#persist();
  }

  /** @returns {Array} a shallow copy so callers can't mutate state directly. */
  get words() {
    return this.#words.slice();
  }

  /** Did the last write to storage succeed? The UI can surface failures. */
  get saveOk() {
    return this.#saveOk;
  }

  /** Find a single word by id (or null). */
  getWord(id) {
    return this.#words.find((word) => word.id === id) ?? null;
  }

  /** True when a word already exists with this spelling (case-insensitive). */
  hasWord(spelling, exceptId = null) {
    const needle = spelling.trim().toLowerCase();
    return this.#words.some(
      (word) => word.id !== exceptId && word.word.toLowerCase() === needle,
    );
  }

  /* ----------------------------- actions ----------------------------- */

  /** Add a new word built from raw form values. @returns the created word. */
  addWord(values) {
    const word = createWord(values);
    this.#words = [word, ...this.#words];
    this.#commit();
    return word;
  }

  /** Patch an existing word by id with the given fields. */
  updateWord(id, patch) {
    this.#words = this.#words.map((word) =>
      word.id === id ? { ...word, ...patch } : word,
    );
    this.#commit();
  }

  /** Remove a word by id. */
  deleteWord(id) {
    this.#words = this.#words.filter((word) => word.id !== id);
    this.#commit();
  }

  /** Append an example to a word (used on the detail screen). */
  addExample(id, text) {
    const clean = text.trim();
    if (!clean) return;
    const word = this.getWord(id);
    if (!word) return;
    this.updateWord(id, { examples: [...word.examples, clean] });
  }

  /** Record a quiz answer, updating streak/status/stats via the model. */
  recordAnswer(id, isCorrect) {
    const word = this.getWord(id);
    if (!word) return { transition: 'none' };
    const { word: next, transition } = applyAnswer(word, isCorrect);
    this.updateWord(id, next);
    return { transition };
  }

  /* --------------------------- subscriptions -------------------------- */

  /** Subscribe to state changes. @returns an unsubscribe function. */
  subscribe(listener) {
    this.#subscribers.add(listener);
    return () => this.#subscribers.delete(listener);
  }

  /* ----------------------------- internals ---------------------------- */

  #commit() {
    this.#persist();
    for (const listener of this.#subscribers) listener(this);
  }

  #persist() {
    this.#saveOk = saveWords(this.#words);
  }
}
