/*
  FabVocab — Dictionary page controller.

  Owns the list (search / color / part-of-speech / status filters, sortable
  columns), the add and edit forms (validation + persistence), the word
  detail view and the delete confirmation modal. Every screen is rendered
  from the shared store; the hash router decides which one is visible.
*/

import { Store } from './store.js';
import { el, icon, render, qs, qsa } from './dom.js';
import {
  isDusty,
  statusLabel,
  colorLabel,
  successRate,
  formatShortDate,
  formatLongDate,
} from './model.js';
import { COLORS, PARTS_OF_SPEECH, FEEDBACK, MASTERY_STREAK, STATUS } from './data.js';
import { initRouter, toHash } from './router.js';

const store = new Store();

/** Colors that need light text on the detail card. */
const DARK_CARD_COLORS = new Set(['gray', 'black', 'red', 'green', 'blue']);

const sortState = { key: null, dir: 'asc' };
let resolveRoute = () => {};
let pendingDeleteId = null;

/* ------------------------------------------------------------------ */
/* Form scaffolding (POS options + color swatches)                     */
/* ------------------------------------------------------------------ */

function fillPosSelect(select) {
  if (!select) return;
  render(select, PARTS_OF_SPEECH.map((pos) => el('option', { value: pos, text: pos })));
}

function fillColorPicker(container) {
  if (!container) return;
  const name = `${container.dataset.colorPicker}-color`;
  render(
    container,
    COLORS.map((color) =>
      el('label', { class: `color-option color-${color.id}`, attrs: { for: `${name}-${color.id}` } }, [
        el('input', {
          id: `${name}-${color.id}`,
          type: 'radio',
          name,
          value: color.id,
          attrs: { 'aria-label': color.label },
        }),
      ]),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* List: selection, sorting, rendering                                 */
/* ------------------------------------------------------------------ */

function checkedValue(name) {
  const input = qs(`#dictionary-filters input[name="${name}"]:checked`);
  return input ? input.value : '';
}

function selectWords() {
  let list = store.words;

  const query = (qs('#word-search')?.value || '').trim().toLowerCase();
  if (query) {
    list = list.filter(
      (word) =>
        word.word.toLowerCase().includes(query) ||
        word.definition.toLowerCase().includes(query) ||
        word.translation.toLowerCase().includes(query),
    );
  }

  const color = checkedValue('filter-color');
  if (color) list = list.filter((word) => word.color === color);

  const pos = checkedValue('speech-filter');
  if (pos) list = list.filter((word) => word.pos === pos);

  const status = checkedValue('status-filter');
  if (status) {
    list = list.filter((word) => (status === 'dusty' ? isDusty(word) : word.status === status));
  }

  if (sortState.key) list = sortWords(list, sortState.key, sortState.dir);
  return list;
}

function sortWords(list, key, dir) {
  const factor = dir === 'asc' ? 1 : -1;
  const valueOf = (word) => {
    switch (key) {
      case 'word': return word.word.toLowerCase();
      case 'pos': return word.pos;
      case 'status': return [STATUS.NEW, STATUS.LEARNING, STATUS.MASTERED].indexOf(word.status);
      case 'date': return word.lastPracticed ? Date.parse(word.lastPracticed) : 0;
      default: return 0;
    }
  };
  return [...list].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av < bv) return -factor;
    if (av > bv) return factor;
    return 0;
  });
}

function buildStatusCell(word) {
  if (isDusty(word)) {
    return el('td', { class: 'word-status' }, [el('span', { class: 'status-badge status-dusty', text: 'dusty' })]);
  }
  if (word.status === STATUS.MASTERED) {
    return el('td', { class: 'word-status' }, [el('span', { class: 'status-badge status-mastered', text: 'mastered' })]);
  }
  return el('td', { class: 'word-status', text: statusLabel(word) });
}

function buildRow(word) {
  const dateCell = word.lastPracticed
    ? el('td', { class: 'word-date' }, [
        el('time', { attrs: { datetime: word.lastPracticed }, text: formatShortDate(word.lastPracticed) }),
      ])
    : el('td', { class: 'word-date', text: '—', attrs: { 'aria-label': 'Not yet practiced' } });

  return el('tr', { class: 'word-row' }, [
    el('td', { class: 'word-color' }, [
      el('span', { class: `word-dot color-${word.color}`, attrs: { 'aria-label': colorLabel(word.color) } }),
    ]),
    el('th', { class: 'word-title', scope: 'row' }, [
      el('a', { class: 'word-link', href: toHash('word-detail', word.id), text: word.word }),
    ]),
    el('td', { class: 'word-speech', text: word.pos }),
    buildStatusCell(word),
    dateCell,
  ]);
}

function renderList() {
  const tbody = qs('#word-tbody');
  const note = qs('#dictionary-empty-note');
  if (!tbody) return;

  const rows = selectWords();
  render(tbody, rows.map(buildRow));
  if (note) note.hidden = rows.length > 0;
}

function updateSortIndicators() {
  for (const th of qsa('.word-table thead th[data-sort-col]')) {
    const key = th.dataset.sortCol;
    const active = sortState.key === key;
    th.setAttribute('aria-sort', active ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  }
}

/* ------------------------------------------------------------------ */
/* Detail view                                                         */
/* ------------------------------------------------------------------ */

function infoCard(heading, body) {
  return el('section', { class: 'info-card' }, [el('h2', { text: heading }), ...[].concat(body)]);
}

function buildPracticeCard(word) {
  const earned = Math.min(word.streak, MASTERY_STREAK);
  const bars = Array.from({ length: MASTERY_STREAK }, (_, index) =>
    el('span', { class: index < earned ? 'earned' : '' }),
  );
  const headingWord = isDusty(word)
    ? 'Dusty'
    : word.status.charAt(0).toUpperCase() + word.status.slice(1);

  return el('section', { class: 'info-card practice-card' }, [
    el('h2', { text: 'Practice progress' }),
    el('div', { class: 'practice-heading' }, [
      el('strong', { text: headingWord }),
      el('span', { text: `${earned} / ${MASTERY_STREAK} Points` }),
    ]),
    el('div', { class: 'practice-bars', attrs: { 'aria-hidden': 'true' } }, bars),
    el('dl', { class: 'practice-stats' }, [
      el('div', {}, [el('dt', { text: 'Times practiced' }), el('dd', { text: String(word.timesPracticed) })]),
      el('div', {}, [el('dt', { text: 'Success rate' }), el('dd', { text: `${successRate(word)}%` })]),
    ]),
  ]);
}

function buildExamplesCard(word) {
  const input = el('input', { placeholder: 'Add another example', attrs: { 'aria-label': 'Add another example' } });
  const submit = () => {
    const value = input.value.trim();
    if (!value) return;
    store.addExample(word.id, value);
    reportSaveState();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });

  const examples = word.examples.length
    ? word.examples.map((example) => el('p', { text: example }))
    : [el('p', { class: 'ghost', text: 'No examples yet — add one below.' })];

  return el('section', { class: 'info-card' }, [
    el('h2', { text: 'Examples' }),
    ...examples,
    el('div', { class: 'example-field' }, [
      input,
      el('button', { type: 'button', attrs: { 'aria-label': 'Add example' }, onClick: submit }, [icon('icon-plus')]),
    ]),
  ]);
}

function renderDetail(word) {
  const root = qs('#detail-root');
  if (!root) return;

  const cardClass = `word-card color-${word.color}${DARK_CARD_COLORS.has(word.color) ? ' word-card-dark' : ''}`;

  const controls = el('div', { class: 'detail-controls' }, [
    el('a', { class: 'button button-secondary button-compact back-link', href: toHash('dictionary') }, [
      icon('icon-chevron'),
      'Back',
    ]),
    el('a', { class: 'button button-secondary button-compact edit-link', href: toHash('edit-word', word.id), text: 'Edit word' }),
    el('button', {
      class: 'button button-secondary button-compact delete-link',
      type: 'button',
      attrs: { 'aria-label': 'Delete word' },
      onClick: () => openDeleteModal(word.id),
    }, [icon('icon-trash')]),
  ]);

  const header = el('header', { class: cardClass }, [
    el('h1', { id: 'detail-heading', text: word.word }),
    el('div', { class: 'word-card-meta' }, [
      el('span', { class: 'speech-badge', text: word.pos }),
      el('time', { attrs: { datetime: word.dateAdded }, text: `Added ${formatLongDate(word.dateAdded)}` }),
    ]),
  ]);

  const translationBody = word.translation
    ? el('p', { attrs: { lang: 'ru' }, text: word.translation })
    : el('p', { class: 'ghost', text: 'No translation yet.' });

  const information = el('div', { class: 'detail-information' }, [
    infoCard('Definition', el('p', { text: word.definition })),
    infoCard('Translation', translationBody),
    buildExamplesCard(word),
    buildPracticeCard(word),
  ]);

  render(root, controls, el('div', { class: 'detail-layout' }, [header, information]));
}

/* ------------------------------------------------------------------ */
/* Forms: read + validation                                            */
/* ------------------------------------------------------------------ */

function readForm(form) {
  const colorChecked = form.querySelector('input[name$="-color"]:checked');
  return {
    word: form.elements.word.value.trim(),
    pos: form.elements.pos.value,
    color: colorChecked ? colorChecked.value : '',
    definition: form.elements.definition.value.trim(),
    translation: form.elements.translation.value.trim(),
    example: form.elements.example.value.trim(),
  };
}

function clearErrors(form) {
  for (const node of qsa('.field-error', form)) node.remove();
  for (const node of qsa('[aria-invalid="true"]', form)) node.removeAttribute('aria-invalid');
  for (const node of qsa('.color-error', form)) node.classList.remove('color-error');
}

function setFieldError(form, name, message) {
  const input = form.elements[name];
  const wrap = input?.closest('.form-field');
  if (!input || !wrap) return input ?? null;
  input.setAttribute('aria-invalid', 'true');
  wrap.append(el('p', { class: 'field-error', text: message }));
  return input;
}

function setColorError(form, message) {
  const fieldset = form.querySelector('[data-color-picker]')?.closest('.form-field');
  if (!fieldset) return;
  fieldset.classList.add('color-error');
  fieldset.append(el('p', { class: 'field-error', text: message }));
}

/** Validate a word form; returns { valid, values, focus }. */
function validate(form, { exceptId = null } = {}) {
  clearErrors(form);
  const values = readForm(form);
  let focus = null;

  if (!values.word) {
    focus = setFieldError(form, 'word', "This one's required.") || focus;
  } else if (store.hasWord(values.word, exceptId)) {
    focus = setFieldError(form, 'word', 'Slow down — this one already lives in your dictionary.') || focus;
  }

  if (!values.definition) {
    const node = setFieldError(form, 'definition', "This one's required.");
    focus = focus || node;
  }

  if (!values.color) {
    setColorError(form, 'Pick a color — any color.');
    focus = focus || form.querySelector('input[name$="-color"]');
  }

  return { valid: !focus, values, focus };
}

function fillEditForm(word) {
  const form = qs('#edit-form');
  if (!form) return;
  clearErrors(form);
  form.elements.word.value = word.word;
  form.elements.pos.value = word.pos;
  form.elements.definition.value = word.definition;
  form.elements.translation.value = word.translation;
  form.elements.example.value = '';
  const colorInput = form.querySelector(`input[name="edit-color"][value="${word.color}"]`);
  if (colorInput) colorInput.checked = true;
  form.dataset.editId = word.id;
}

/* ------------------------------------------------------------------ */
/* Toast + delete modal                                                */
/* ------------------------------------------------------------------ */

let toastTimer = 0;

function showToast(message) {
  const toast = qs('#dictionary-toast');
  const text = qs('#dictionary-toast-text');
  if (!toast || !text) return;
  text.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, 3200);
}

function hideToast() {
  const toast = qs('#dictionary-toast');
  if (!toast) return;
  toast.classList.remove('is-visible');
  toast.hidden = true;
}

/** If the last store write failed, tell the user their change wasn't saved. */
function reportSaveState() {
  if (!store.saveOk) showToast("Heads up — couldn't save. Your storage may be full.");
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  const modal = qs('#delete-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
  qs('#delete-confirm')?.focus();
}

function closeDeleteModal() {
  pendingDeleteId = null;
  const modal = qs('#delete-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

/* ------------------------------------------------------------------ */
/* Routing + chrome                                                    */
/* ------------------------------------------------------------------ */

function updateChrome(screen) {
  const title = qs('#dictionary-mobile-title');
  const titles = { 'add-word': 'New word', 'edit-word': 'Edit word', 'word-detail': '' };
  if (title) title.textContent = screen in titles ? titles[screen] : 'Dictionary';
  document.body.classList.toggle('screen-detail', screen === 'word-detail');
}

function onRoute(screen, param) {
  updateChrome(screen);
  // A stale modal shouldn't survive navigation.
  if (screen !== 'word-detail' && screen !== 'edit-word') closeDeleteModal();

  if (screen === 'word-detail') {
    const word = store.getWord(param);
    if (!word) {
      location.hash = toHash('dictionary');
      return;
    }
    renderDetail(word);
  } else if (screen === 'edit-word') {
    const word = store.getWord(param);
    if (!word) {
      location.hash = toHash('dictionary');
      return;
    }
    fillEditForm(word);
  } else if (screen === 'add-word') {
    const form = qs('#add-form');
    if (form) {
      form.reset();
      clearErrors(form);
    }
  } else {
    renderList();
  }
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function wireFilters() {
  const filtersForm = qs('#dictionary-filters');
  if (!filtersForm) return;

  filtersForm.addEventListener('change', renderList);

  // Let a second click on a selected radio clear it (toggle-off).
  for (const input of qsa('input[type="radio"]', filtersForm)) {
    input.addEventListener('mousedown', () => {
      input.dataset.wasChecked = input.checked ? 'yes' : 'no';
    });
    input.addEventListener('click', () => {
      if (input.dataset.wasChecked === 'yes') {
        input.checked = false;
        renderList();
      }
    });
  }

  qs('#filter-reset')?.addEventListener('click', () => {
    filtersForm.reset();
    const search = qs('#word-search');
    if (search) search.value = '';
    for (const input of qsa('input[type="radio"]', filtersForm)) input.dataset.wasChecked = 'no';
    renderList();
  });

  qs('#word-search')?.addEventListener('input', renderList);
}

function wireSort() {
  for (const button of qsa('.word-table thead .table-sort')) {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = 'asc';
      }
      updateSortIndicators();
      renderList();
    });
  }
}

function wireForms() {
  qs('#add-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { valid, values, focus } = validate(form);
    if (!valid) {
      focus?.focus();
      return;
    }
    store.addWord(values);
    if (!store.saveOk) {
      reportSaveState();
    } else {
      showToast(FEEDBACK.toastAdded[Math.floor(Math.random() * FEEDBACK.toastAdded.length)]);
    }
    form.reset();
    clearErrors(form);
    qs('#add-text')?.focus();
  });

  qs('#edit-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.dataset.editId;
    if (!id) return;
    const { valid, values, focus } = validate(form, { exceptId: id });
    if (!valid) {
      focus?.focus();
      return;
    }
    const existing = store.getWord(id);
    const patch = {
      word: values.word,
      pos: values.pos,
      color: values.color,
      definition: values.definition,
      translation: values.translation,
    };
    if (values.example) patch.examples = [...(existing?.examples || []), values.example];
    store.updateWord(id, patch);
    reportSaveState();
    location.hash = toHash('word-detail', id);
  });

  qs('#edit-delete')?.addEventListener('click', () => {
    const id = qs('#edit-form')?.dataset.editId;
    if (id) openDeleteModal(id);
  });
}

function wireModal() {
  qs('#delete-confirm')?.addEventListener('click', () => {
    const id = pendingDeleteId;
    closeDeleteModal();
    if (!id) return;
    store.deleteWord(id);
    reportSaveState();
    location.hash = toHash('dictionary');
  });

  qs('#delete-cancel')?.addEventListener('click', closeDeleteModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!qs('#delete-modal')?.hidden) closeDeleteModal();
    }
  });

  qs('#dictionary-toast-dismiss')?.addEventListener('click', hideToast);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

fillPosSelect(qs('#add-speech'));
fillPosSelect(qs('#edit-speech'));
fillColorPicker(qs('[data-color-picker="add"]'));
fillColorPicker(qs('[data-color-picker="edit"]'));

wireFilters();
wireSort();
wireForms();
wireModal();

resolveRoute = initRouter({
  screenSelector: '.dictionary-screen',
  defaultId: 'dictionary',
  onChange: onRoute,
});

// Re-render the active screen whenever state changes.
store.subscribe(() => resolveRoute());
resolveRoute();
