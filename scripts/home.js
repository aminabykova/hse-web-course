/*
  FabVocab — Home page controller.

  Projects the shared store onto the dashboard: vocabulary stats, the
  "getting dusty" reminder, today's pick and the train/add actions. The
  dashboard, the beginner gate (too few words to train) and the empty state
  are all chosen from data, not from the hash — so the screen reflects state.
*/

import { Store } from './store.js';
import { el, render, qs } from './dom.js';
import { computeStats, todaysPick } from './model.js';
import { MIN_WORDS_TO_TRAIN } from './data.js';
import { toHash } from './router.js';

const store = new Store();

/** One labelled statistic cell. */
function statCell(label, value, modifier) {
  return el('div', { class: `vocabulary-stat ${modifier || ''}`.trim() }, [
    el('dt', { class: 'stat-label', text: label }),
    el('dd', { class: 'stat-value', text: String(value) }),
  ]);
}

/** Build the whole overview subtree from current state. */
function buildOverview(words) {
  const stats = computeStats(words);
  const canTrain = words.length >= MIN_WORDS_TO_TRAIN;
  const pick = todaysPick(words);
  const children = [];

  children.push(
    el('dl', { class: 'vocabulary-statistics', attrs: { 'aria-label': 'Vocabulary statistics' } }, [
      statCell('Total', stats.total),
      statCell('New', stats.new),
      statCell('Learning', stats.learning, 'stat-learning'),
      statCell('Mastered', stats.mastered, 'stat-mastered'),
    ]),
  );

  if (stats.dusty > 0) {
    children.push(
      el('p', { class: 'practice-reminder' }, [
        `${stats.dusty} ${stats.dusty === 1 ? 'word is' : 'words are'} getting dusty! `,
        el('span', {
          class: 'reminder-continuation',
          text: 'Practice them before they fade from your memory.',
        }),
      ]),
    );
  }

  if (pick) {
    children.push(
      el('article', { class: 'todays-pick', attrs: { 'aria-labelledby': 'featured-word' } }, [
        el('p', { class: 'pick-eyebrow', text: "Today's Pick" }),
        el('div', { class: 'pick-entry' }, [
          el('h2', { class: 'pick-word', id: 'featured-word' }, [
            el('a', { href: `dictionary.html${toHash('word-detail', pick.id)}`, text: pick.word }),
          ]),
          el('p', { class: 'pick-definition', text: pick.definition }),
        ]),
        el('p', { class: 'pick-part-of-speech', text: pick.pos }),
      ]),
    );
  }

  if (!canTrain) {
    children.push(
      el('p', { class: 'training-requirement', id: 'training-requirement' }, [
        `You need at least ${MIN_WORDS_TO_TRAIN} words to play.`,
        el('br'),
        'Go catch some.',
      ]),
    );
  }

  const trainAction = canTrain
    ? el('a', { class: 'button button-primary action-train', href: 'training.html', text: "Let's train" })
    : el('button', {
        class: 'button button-primary action-train',
        type: 'button',
        disabled: true,
        text: "Let's train",
        attrs: { 'aria-describedby': 'training-requirement' },
      });

  children.push(
    el('div', { class: 'vocabulary-actions' }, [
      trainAction,
      el('a', {
        class: 'button button-secondary action-add',
        href: `dictionary.html${toHash('add-word')}`,
        text: '+ Add a word',
      }),
    ]),
  );

  return children;
}

/** Choose the dashboard vs. empty state and render from the store. */
function renderHome() {
  const words = store.words;
  const dashboard = qs('#home');
  const empty = qs('#home-empty');
  const content = qs('.home-content');
  const overview = qs('#home-overview');
  if (!dashboard || !empty) return;

  const isEmpty = words.length === 0;
  dashboard.classList.toggle('is-active', !isEmpty);
  empty.classList.toggle('is-active', isEmpty);
  if (content) content.classList.toggle('is-empty', isEmpty);

  if (!isEmpty && overview) render(overview, buildOverview(words));
}

store.subscribe(renderHome);
renderHome();
