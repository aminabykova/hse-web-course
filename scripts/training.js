/*
  FabVocab — Training page controller (the quiz engine).

  Builds a quiz session from the dictionary (direction, difficulty, length),
  renders question / color-hint / feedback as states of a single screen,
  grades answers through the store (which updates streaks and statuses), and
  summarises the run on the results screen. All three screens are projections
  of the in-memory `session` object; the hash router switches between them.
*/

import { Store } from './store.js';
import { el, icon, render, qs } from './dom.js';
import { isDusty, colorCounts, assessmentFor } from './model.js';
import {
  STATUS,
  FEEDBACK,
  QUESTION_OPTIONS,
  MIN_WORDS_TO_TRAIN,
  HARD_MODE_MIN_PER_COLOR,
} from './data.js';
import { initRouter, toHash } from './router.js';

const store = new Store();

/** Map a color id to its CSS custom property for the full-screen hint. */
const HINT_BG = {
  white: '--paper',
  gray: '--gray',
  black: '--ink',
  red: '--red',
  yellow: '--yellow',
  green: '--green',
  blue: '--blue',
  pink: '--pink',
};

/** @type {null | object} the live quiz session. */
let session = null;

/* ------------------------------------------------------------------ */
/* Session building                                                    */
/* ------------------------------------------------------------------ */

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Words usable as question targets (hard mode needs 4 of their color). */
function eligibleTargets(words, mode) {
  if (mode !== 'hard') return words;
  const counts = colorCounts(words);
  return words.filter((word) => counts[word.color] >= HARD_MODE_MIN_PER_COLOR);
}

/** Pick up to `count` distinct targets, biased toward words needing work. */
function pickTargets(words, count, mode) {
  const eligible = eligibleTargets(words, mode);
  const weighted = [];
  for (const word of eligible) {
    let weight = 1;
    if (isDusty(word)) weight = 3;
    else if (word.status !== STATUS.MASTERED) weight = 2;
    for (let i = 0; i < weight; i += 1) weighted.push(word);
  }

  const chosen = [];
  const seen = new Set();
  for (const word of shuffle(weighted)) {
    if (chosen.length >= count) break;
    if (seen.has(word.id)) continue;
    seen.add(word.id);
    chosen.push(word);
  }
  return chosen;
}

/** Build one question with a correct answer and up to three distractors. */
function buildQuestion(target, words, direction, mode) {
  const answerOf = (word) => (direction === 'word' ? word.definition : word.word);
  const correctText = answerOf(target);
  const used = new Set([correctText]);

  const sameColor = shuffle(words.filter((w) => w.id !== target.id && w.color === target.color));
  const others = shuffle(words.filter((w) => w.id !== target.id && w.color !== target.color));
  const order = mode === 'hard' ? [...sameColor, ...others] : shuffle([...sameColor, ...others]);

  const distractors = [];
  for (const word of order) {
    if (distractors.length >= QUESTION_OPTIONS - 1) break;
    const text = answerOf(word);
    if (used.has(text)) continue;
    used.add(text);
    distractors.push(text);
  }

  const options = shuffle([
    { text: correctText, correct: true },
    ...distractors.map((text) => ({ text, correct: false })),
  ]);

  return {
    wordId: target.id,
    word: target.word,
    color: target.color,
    pos: target.pos,
    prompt: direction === 'word' ? target.word : target.definition,
    options,
  };
}

function buildQuestions({ direction, mode, count }) {
  const words = store.words;
  return pickTargets(words, count, mode)
    .map((target) => buildQuestion(target, words, direction, mode))
    .filter((question) => question.options.length >= 2);
}

/* ------------------------------------------------------------------ */
/* Hint background                                                     */
/* ------------------------------------------------------------------ */

function applyHintBackground(colorId) {
  document.body.style.background = colorId && HINT_BG[colorId] ? `var(${HINT_BG[colorId]})` : '';
}

/* ------------------------------------------------------------------ */
/* Setup screen                                                        */
/* ------------------------------------------------------------------ */

function renderSetup() {
  const form = qs('#setup-form');
  if (!form) return;
  const words = store.words;
  const canTrain = words.length >= MIN_WORDS_TO_TRAIN;
  const counts = colorCounts(words);
  const hardAvailable = Object.values(counts).some((count) => count >= HARD_MODE_MIN_PER_COLOR);

  const hardInput = form.querySelector('input[name="setup-difficulty"][value="hard"]');
  if (hardInput) {
    hardInput.disabled = !hardAvailable;
    if (!hardAvailable && hardInput.checked) {
      const regular = form.querySelector('input[name="setup-difficulty"][value="regular"]');
      if (regular) regular.checked = true;
    }
  }

  const hardNote = qs('#hard-mode-note');
  if (hardNote) {
    hardNote.textContent = hardAvailable ? 'Same color chaos' : 'Not enough words of one color (need 4).';
  }

  const start = qs('#setup-start');
  if (start) start.disabled = !canTrain;

  const note = qs('#setup-note');
  if (note) {
    note.hidden = canTrain;
    if (!canTrain) note.textContent = `You need at least ${MIN_WORDS_TO_TRAIN} words to play. Go catch some.`;
  }
}

function startQuiz() {
  const form = qs('#setup-form');
  if (!form || store.words.length < MIN_WORDS_TO_TRAIN) return;

  const direction = form.elements['setup-direction'].value;
  const mode = form.elements['setup-difficulty'].value;
  const count = Number(form.elements['setup-count'].value) || 5;

  const questions = buildQuestions({ direction, mode, count });
  if (questions.length === 0) return;

  session = {
    direction,
    mode,
    questions,
    index: 0,
    correctCount: 0,
    answered: false,
    selectedIndex: null,
    hintUsed: false,
    lastCorrect: false,
    transitions: { mastered: [], demoted: [], dusted: [] },
  };
  location.hash = toHash('quiz-question');
}

/* ------------------------------------------------------------------ */
/* Question screen                                                     */
/* ------------------------------------------------------------------ */

function instructionText(question) {
  if (session.hintUsed) return 'Select the option with matching color hint';
  return session.direction === 'word' ? 'Select the correct meaning' : 'Select the correct word';
}

function buildProgress() {
  const total = session.questions.length;
  const filled = session.index + 1;
  const segments = Array.from({ length: total }, (_, index) =>
    el('i', { class: index < filled ? 'filled' : '' }),
  );
  return el('div', { class: 'quiz-progress' }, [
    el('p', { class: 'quiz-progress-label', id: 'quiz-progress-label', text: `${filled} / ${total}` }),
    el('progress', {
      class: 'sr-only',
      max: total,
      value: filled,
      attrs: { 'aria-labelledby': 'quiz-progress-label' },
    }, [`${filled} / ${total}`]),
    el('div', { class: 'progress-segments', attrs: { 'aria-hidden': 'true' } }, segments),
  ]);
}

function buildOption(option, index, checkButton) {
  const classes = ['answer-card'];
  if (session.answered) {
    if (option.correct) classes.push('answer-correct');
    else if (index === session.selectedIndex) classes.push('answer-wrong');
  }

  const input = el('input', {
    class: 'native-radio',
    type: 'radio',
    name: 'quiz-answer',
    value: String(index),
    checked: session.selectedIndex === index,
    disabled: session.answered,
    onChange: () => {
      session.selectedIndex = index;
      if (checkButton) checkButton.disabled = false;
    },
  });

  const label = el('span', { text: option.text });
  if (session.answered && option.correct) {
    label.append(el('span', { class: 'sr-only', text: ' (Correct answer)' }));
  } else if (session.answered && index === session.selectedIndex) {
    label.append(el('span', { class: 'sr-only', text: ' (Incorrect answer)' }));
  }

  return el('label', { class: classes.join(' ') }, [input, label]);
}

function buildFeedbackMessage() {
  if (session.lastCorrect) {
    const phrase = FEEDBACK.correct[Math.floor(Math.random() * FEEDBACK.correct.length)];
    return el('p', { class: 'feedback-message' }, [
      el('span', { text: phrase }),
      el('span', { class: 'points-earned', text: '+1 point' }),
    ]);
  }
  const phrase = FEEDBACK.wrong[Math.floor(Math.random() * FEEDBACK.wrong.length)];
  return el('p', { class: 'feedback-message', text: phrase });
}

function buildActions() {
  if (session.answered) {
    const isLast = session.index >= session.questions.length - 1;
    return el('div', { class: 'quiz-actions' }, [
      el('button', {
        class: 'button button-primary',
        type: 'button',
        text: isLast ? 'See results' : 'Next question',
        onClick: nextQuestion,
      }),
    ]);
  }

  const buttons = [];
  if (!session.hintUsed) {
    buttons.push(
      el('button', { class: 'button button-secondary', type: 'button', text: 'Show color', onClick: showHint }),
    );
  }
  const checkButton = el('button', {
    class: 'button button-primary',
    type: 'button',
    text: 'Check',
    disabled: session.selectedIndex == null,
    onClick: checkAnswer,
  });
  buttons.push(checkButton);
  return { node: el('div', { class: 'quiz-actions' }, buttons), checkButton };
}

function renderQuestion() {
  const section = qs('#quiz-question');
  const root = qs('#quiz-root');
  if (!section || !root || !session) return;

  const question = session.questions[session.index];
  const showCategory = session.hintUsed || session.answered;

  // Toggle the state classes the CSS keys on.
  section.classList.toggle('hint-screen', session.hintUsed && !session.answered);
  section.classList.toggle('feedback-screen', session.answered);
  section.classList.toggle('correct-screen', session.answered && session.lastCorrect);
  section.classList.toggle('wrong-screen', session.answered && !session.lastCorrect);
  applyHintBackground(session.hintUsed ? question.color : null);

  const prompt = el('div', { class: 'word-prompt' }, [
    el('h2', { id: 'quiz-word', text: question.prompt }),
    showCategory ? el('span', { class: 'word-category', text: question.pos }) : null,
  ]);

  const actions = buildActions();
  const actionsNode = actions.node || actions;
  const checkButton = actions.checkButton || null;

  const grid = el('div', { class: 'answer-grid' },
    question.options.map((option, index) => buildOption(option, index, checkButton)),
  );

  const answerArea = el('div', { class: 'answer-area' }, [
    session.answered ? buildFeedbackMessage() : null,
    el('fieldset', { attrs: { 'aria-labelledby': 'quiz-instruction quiz-word' } }, [
      el('legend', { class: 'sr-only', text: 'Answers' }),
      grid,
    ]),
  ]);

  render(root,
    buildProgress(),
    el('p', { class: 'quiz-instruction', id: 'quiz-instruction', text: instructionText(question) }),
    prompt,
    answerArea,
    actionsNode,
  );
}

/* ------------------------------------------------------------------ */
/* Answer handling                                                     */
/* ------------------------------------------------------------------ */

function showHint() {
  if (!session || session.answered) return;
  session.hintUsed = true;
  renderQuestion();
}

function checkAnswer() {
  if (!session || session.answered || session.selectedIndex == null) return;
  const question = session.questions[session.index];
  const correct = Boolean(question.options[session.selectedIndex]?.correct);

  session.answered = true;
  session.lastCorrect = correct;
  if (correct) session.correctCount += 1;

  const { transition } = store.recordAnswer(question.wordId, correct);
  if (transition === 'mastered') session.transitions.mastered.push(question.word);
  else if (transition === 'demoted') session.transitions.demoted.push(question.word);
  else if (transition === 'dusted') session.transitions.dusted.push(question.word);

  renderQuestion();
}

function nextQuestion() {
  if (!session) return;
  if (session.index >= session.questions.length - 1) {
    location.hash = toHash('training-results');
    return;
  }
  session.index += 1;
  session.answered = false;
  session.selectedIndex = null;
  session.hintUsed = false;
  session.lastCorrect = false;
  applyHintBackground(null);
  renderQuestion();
}

/* ------------------------------------------------------------------ */
/* Results screen                                                      */
/* ------------------------------------------------------------------ */

function buildResultGroup(modifier, title, words, open) {
  const children = [
    el('summary', {}, [
      el('span', { text: title }),
      el('span', { class: 'word-count', text: `${words.length} ${words.length === 1 ? 'word' : 'words'}` }),
      icon('icon-chevron'),
    ]),
  ];
  if (words.length) {
    children.push(el('ul', {}, words.map((word) => el('li', { text: word }))));
  }
  return el('details', { class: `result-group ${modifier}`, open: open && words.length > 0 }, children);
}

function renderResults() {
  const root = qs('#results-root');
  if (!root || !session) return;

  const total = session.questions.length;
  const fraction = total ? session.correctCount / total : 0;

  render(root,
    el('div', { class: 'score-card' }, [
      el('p', { class: 'score-total', attrs: { 'aria-label': `${session.correctCount} out of ${total}` }, text: `${session.correctCount}/${total}` }),
      el('p', { class: 'score-assessment', text: assessmentFor(fraction) }),
    ]),
    el('div', { class: 'result-groups' }, [
      buildResultGroup('freshly-learned', 'freshly learned', session.transitions.mastered, true),
      buildResultGroup('back-to-bench', 'back to the bench', session.transitions.demoted, false),
      buildResultGroup('dusted-off', 'dusted off', session.transitions.dusted, false),
    ]),
    el('div', { class: 'result-actions' }, [
      el('a', { class: 'button button-primary', href: toHash('training-setup'), text: 'One more?' }),
      el('a', { class: 'button button-secondary', href: 'index.html', text: "That's it for today" }),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function updateTitle(screen) {
  const title = qs('#training-mobile-title');
  if (!title) return;
  const titles = {
    'training-setup': 'Quiz setup',
    'quiz-question': 'Quiz',
    'training-results': 'Training complete',
  };
  title.textContent = titles[screen] || 'Quiz setup';
}

function onRoute(screen) {
  updateTitle(screen);
  if (screen !== 'quiz-question') applyHintBackground(null);

  if (screen === 'quiz-question') {
    if (!session) {
      location.hash = toHash('training-setup');
      return;
    }
    renderQuestion();
  } else if (screen === 'training-results') {
    if (!session) {
      location.hash = toHash('training-setup');
      return;
    }
    renderResults();
  } else {
    renderSetup();
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

qs('#setup-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  startQuiz();
});

const resolveRoute = initRouter({
  screenSelector: '.training-screen',
  defaultId: 'training-setup',
  onChange: onRoute,
});

resolveRoute();
