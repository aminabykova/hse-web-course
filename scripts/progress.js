/*
  FabVocab — Progress page controller.

  Renders the statistics panels (status distribution, color distribution,
  added-vs-mastered monthly chart, recently mastered) entirely from the
  shared store. Bar proportions are computed from counts and written as
  inline flex-grow / height, so the charts are a true projection of state
  rather than the fixed geometry of the static mock-up.
*/

import { Store } from './store.js';
import { el, icon, render, qs } from './dom.js';
import { computeStats, colorCounts, monthlyStats, recentlyMastered } from './model.js';
import { COLORS, COLOR_IDS } from './data.js';
import { toHash } from './router.js';

const store = new Store();

function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

/** A labelled panel: heading + content card. */
function panel(heading, content, modifier = '') {
  return el('section', { class: `progress-panel ${modifier}`.trim() }, [
    el('h2', { class: 'panel-heading', text: heading }),
    content,
  ]);
}

/* ------------------------------- panels ------------------------------- */

function statusPanel(words) {
  const stats = computeStats(words);
  const total = stats.total;
  const masteredFresh = Math.max(stats.mastered - stats.dusty, 0);

  const parts = [
    { id: 'new', label: 'New', count: stats.new },
    { id: 'learning', label: 'Learning', count: stats.learning },
    { id: 'mastered', label: 'Mastered', count: masteredFresh },
    { id: 'dusty', label: 'Dusty', count: stats.dusty },
  ];

  const bar = el('div', { class: 'status-distribution', attrs: { 'aria-hidden': 'true' } },
    parts.map((part) => {
      const segment = el('span', { class: `status-segment status-${part.id}` });
      segment.style.flexGrow = String(part.count);
      return segment;
    }),
  );

  const legend = el('dl', { class: 'status-legend' },
    parts.map((part) =>
      el('div', { class: 'legend-entry' }, [
        el('dt', {}, [el('span', { class: `legend-dot status-${part.id}`, attrs: { 'aria-hidden': 'true' } }), part.label]),
        el('dd', { text: `${percent(part.count, total)}%` }),
      ]),
    ),
  );

  return panel('Vocabulary Stats', el('div', { class: 'statistics-card vocabulary-card' }, [bar, legend]), 'vocabulary-panel');
}

function colorPanel(words) {
  const counts = colorCounts(words);
  const total = words.length;

  const bar = el('div', { class: 'color-distribution', attrs: { 'aria-hidden': 'true' } },
    COLOR_IDS.map((id) => {
      const segment = el('span', { class: `color-segment color-${id}` });
      segment.style.flexGrow = String(counts[id]);
      return segment;
    }),
  );

  const ranked = COLORS.map((color) => ({
    label: color.label,
    count: counts[color.id],
    pct: percent(counts[color.id], total),
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const most = ranked[0];
  const rest = ranked.slice(1);

  const details = el('details', { class: 'color-breakdown' }, [
    el('summary', { class: 'color-summary' }, [
      el('span', { text: most ? `Most: ${most.label} ${most.pct}%` : 'No words yet' }),
      icon('icon-chevron'),
    ]),
    el('ul', { class: 'color-shares' },
      rest.map((entry) => el('li', {}, [el('span', { text: entry.label }), el('span', { text: `${entry.pct}%` })])),
    ),
  ]);

  return panel('Color Stats', el('div', { class: 'statistics-card color-card' }, [bar, details]), 'color-panel');
}

function monthlyPanel(words) {
  const months = monthlyStats(words, 3);
  const max = Math.max(1, ...months.flatMap((month) => [month.added, month.mastered]));

  const makeBar = (modifier, value) => {
    const bar = el('span', { class: `monthly-bar ${modifier}` });
    bar.style.height = `${Math.round((value / max) * 100)}%`;
    return bar;
  };

  const chart = el('div', { class: 'monthly-chart', attrs: { 'aria-hidden': 'true' } },
    months.map((month) =>
      el('div', { class: 'month-group' }, [
        el('div', { class: 'month-bars' }, [makeBar('bar-added', month.added), makeBar('bar-mastered', month.mastered)]),
        el('span', { class: 'month-label', text: month.label }),
      ]),
    ),
  );

  const legend = el('figcaption', { class: 'monthly-legend' }, [
    el('span', {}, [el('span', { class: 'legend-dot status-new', attrs: { 'aria-hidden': 'true' } }), 'Added']),
    el('span', {}, [el('span', { class: 'legend-dot status-mastered', attrs: { 'aria-hidden': 'true' } }), 'Mastered']),
  ]);

  return panel('Added vs Mastered (Monthly)', el('figure', { class: 'statistics-card monthly-card' }, [chart, legend]), 'monthly-panel');
}

function recentPanel(words) {
  const recent = recentlyMastered(words, 5);

  const items = recent.length
    ? recent.map((word) =>
        el('li', {}, [
          el('a', { class: 'recent-word', href: `dictionary.html${toHash('word-detail', word.id)}` }, [
            el('span', { class: 'recent-word-name', text: word.word }),
            el('span', { class: 'recent-word-status', text: 'Mastered' }),
          ]),
        ]),
      )
    : [el('li', {}, [el('span', { class: 'recent-word-name', text: 'Nothing mastered yet — keep training.' })])];

  return panel('Recently Mastered', el('ul', { class: 'recent-words' }, items), 'recent-panel');
}

/* ------------------------------- render ------------------------------- */

function renderProgress() {
  const words = store.words;
  const populated = qs('#progress');
  const empty = qs('#progress-empty');
  const content = qs('.progress-content');
  if (!populated || !empty) return;

  const isEmpty = words.length === 0;
  populated.classList.toggle('is-active', !isEmpty);
  empty.classList.toggle('is-active', isEmpty);
  if (content) content.classList.toggle('is-empty', isEmpty);

  if (!isEmpty) {
    render(populated,
      el('h1', { class: 'sr-only', id: 'progress-heading', text: 'Progress' }),
      statusPanel(words),
      colorPanel(words),
      monthlyPanel(words),
      recentPanel(words),
    );
  }
}

store.subscribe(renderProgress);
renderProgress();
