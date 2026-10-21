/*
  FabVocab — seed data and shared constants.

  This module is the "model" source of content (criterion: data in JS
  structures). It exports the eight word colors, the parts of speech, the
  learning statuses, the copy used for quiz feedback, and a seed dictionary
  built from the owner's real word list. Everything downstream (store, pages)
  is a projection of these structures.
*/

/** The eight synesthetic word colors. Keys match the CSS `.color-*` classes. */
export const COLORS = [
  { id: 'white', label: 'White' },
  { id: 'gray', label: 'Gray' },
  { id: 'black', label: 'Black' },
  { id: 'red', label: 'Red' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'pink', label: 'Pink' },
];

export const COLOR_IDS = COLORS.map((color) => color.id);

/** Parts of speech offered in the add/edit form and the dictionary filter. */
export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'idiom',
  'expression',
];

/** Learning statuses. `dusty` is derived, never stored. */
export const STATUS = {
  NEW: 'new',
  LEARNING: 'learning',
  MASTERED: 'mastered',
};

/** Tuning constants for the learning loop. */
export const MASTERY_STREAK = 5; // correct answers in a row to master a word
export const QUESTION_OPTIONS = 4; // answers shown per quiz question
export const MIN_WORDS_TO_TRAIN = 5; // the "need at least 5 words to play" gate
export const HARD_MODE_MIN_PER_COLOR = 4; // same-color answers needed for hard mode
export const DUSTY_AFTER_DAYS = 30; // a mastered word unpractised this long gets dusty

/** Randomised copy, kept in the friendly BeReal-ish tone of the spec. */
export const FEEDBACK = {
  correct: ['Nailed it!', 'Easy.', 'Yep.', "Chef's kiss."],
  wrong: [
    'Ouch. It happens — this one will stick, promise.',
    'Not this time.',
    'So close!',
  ],
  toastAdded: ['Locked in. Next victim?', 'Saved. Go catch another.'],
};

/** Score assessment lines keyed by the fraction answered correctly. */
export const ASSESSMENTS = [
  { min: 0.9, text: 'Nailed basically all of it.' },
  { min: 0.7, text: 'Not bad, not bad at all.' },
  { min: 0.5, text: 'Middling — but progress is progress.' },
  { min: 0, text: "Rough one. They'll stick eventually." },
];

export const STORAGE_KEY = 'fabvocab.words.v1';

/* ------------------------------------------------------------------ */
/* Seed dictionary                                                     */
/* ------------------------------------------------------------------ */

/** @returns {string} an ISO `YYYY-MM-DD` date `n` days before today. */
function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().slice(0, 10);
}

/** Build a URL/id-safe slug from a word. */
function slug(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Normalise a terse seed descriptor into a full word record.
 * `added` / `practiced` / `mastered` are "days ago" offsets.
 */
function seed(entry) {
  return {
    id: slug(entry.word),
    word: entry.word,
    pos: entry.pos,
    color: entry.color,
    definition: entry.definition,
    translation: entry.translation || '',
    examples: entry.examples ? entry.examples.slice() : [],
    status: entry.status || STATUS.NEW,
    streak: entry.streak || 0,
    timesPracticed: entry.timesPracticed || 0,
    correctCount: entry.correctCount || 0,
    dateAdded: daysAgo(entry.added ?? 30),
    lastPracticed: entry.practiced == null ? null : daysAgo(entry.practiced),
    masteredDate: entry.mastered == null ? null : daysAgo(entry.mastered),
    language: 'en',
  };
}

const RAW_SEED = [
  // white
  { word: 'tentative', pos: 'adjective', color: 'white', definition: 'hesitant, not certain', status: 'learning', streak: 2, timesPracticed: 5, correctCount: 3, added: 24, practiced: 4 },
  { word: 'ajar', pos: 'adjective', color: 'white', definition: 'slightly open', status: 'new', added: 9 },
  { word: 'miniscule', pos: 'adjective', color: 'white', definition: 'extremely small, tiny', translation: 'крошечный', status: 'mastered', streak: 5, timesPracticed: 11, correctCount: 9, added: 68, practiced: 6, mastered: 12 },
  { word: 'benevolent', pos: 'adjective', color: 'white', definition: 'kind and well-meaning', status: 'learning', streak: 1, timesPracticed: 3, correctCount: 1, added: 40, practiced: 9 },
  { word: 'nascent', pos: 'adjective', color: 'white', definition: 'just coming into existence; emerging', status: 'new', added: 3 },

  // gray
  { word: 'falter', pos: 'verb', color: 'gray', definition: 'hesitate, move unsteadily', status: 'learning', streak: 3, timesPracticed: 6, correctCount: 4, added: 33, practiced: 3 },
  { word: 'strew', pos: 'verb', color: 'gray', definition: 'scatter', translation: 'разбрасывать', status: 'new', added: 7 },
  { word: 'qualm', pos: 'noun', color: 'gray', definition: 'a doubt, second thought, or worry', translation: 'сомнение', status: 'mastered', streak: 5, timesPracticed: 14, correctCount: 11, added: 77, practiced: 44, mastered: 50 },
  { word: 'raucous', pos: 'adjective', color: 'gray', definition: 'making a harsh and loud noise', translation: 'резкий, хриплый', status: 'learning', streak: 2, timesPracticed: 4, correctCount: 2, added: 20, practiced: 5 },
  { word: 'languid', pos: 'adjective', color: 'gray', definition: 'relaxed, leisurely, slow', translation: 'томный, вялый', status: 'mastered', streak: 6, timesPracticed: 13, correctCount: 12, added: 60, practiced: 10, mastered: 22 },

  // black
  { word: 'appalling', pos: 'adjective', color: 'black', definition: 'shocking, horrific', status: 'mastered', streak: 5, timesPracticed: 10, correctCount: 8, added: 71, practiced: 8, mastered: 15 },
  { word: 'astray', pos: 'adverb', color: 'black', definition: 'away from the correct path or direction', status: 'learning', streak: 1, timesPracticed: 2, correctCount: 1, added: 18, practiced: 6 },
  { word: 'plastered', pos: 'adjective', color: 'black', definition: 'very drunk', status: 'new', added: 5 },
  { word: 'ambush', pos: 'noun', color: 'black', definition: 'a surprise attack', translation: 'засада', status: 'learning', streak: 4, timesPracticed: 7, correctCount: 6, added: 45, practiced: 2 },
  { word: 'stern', pos: 'adjective', color: 'black', definition: 'serious, severe, strict', translation: 'строгий, суровый', status: 'mastered', streak: 5, timesPracticed: 12, correctCount: 10, added: 82, practiced: 41, mastered: 55 },
  { word: 'dread', pos: 'verb', color: 'black', definition: 'anticipate with fear', status: 'mastered', streak: 7, timesPracticed: 9, correctCount: 9, added: 52, practiced: 11, mastered: 19 },
  { word: 'ramshackle', pos: 'adjective', color: 'black', definition: 'falling to pieces', translation: 'обветшалый', status: 'new', added: 2 },

  // red
  { word: 'stifle', pos: 'verb', color: 'red', definition: 'suffocate; suppress', status: 'learning', streak: 2, timesPracticed: 5, correctCount: 3, added: 29, practiced: 4 },
  { word: 'deplete', pos: 'verb', color: 'red', definition: 'consume, use up, spend', status: 'new', added: 6 },
  { word: 'flunk', pos: 'verb', color: 'red', definition: 'fail to reach the required standard in a test', translation: 'провалить экзамен', examples: ['flunk the exam', 'flunk biology'], status: 'mastered', streak: 5, timesPracticed: 11, correctCount: 9, added: 64, practiced: 7, mastered: 14 },
  { word: 'grating', pos: 'adjective', color: 'red', definition: 'irritating', status: 'learning', streak: 3, timesPracticed: 6, correctCount: 4, added: 27, practiced: 3 },
  { word: 'scowl', pos: 'verb', color: 'red', definition: 'frown angrily', examples: ['scowl at someone'], status: 'new', added: 8 },
  { word: 'fizzle out', pos: 'idiom', color: 'red', definition: 'end or fail in a disappointing way', translation: 'выдохнуться', status: 'learning', streak: 1, timesPracticed: 3, correctCount: 1, added: 16, practiced: 5 },
  { word: 'queasy', pos: 'adjective', color: 'red', definition: 'nauseous, feeling sick', translation: 'подверженный тошноте', status: 'mastered', streak: 5, timesPracticed: 10, correctCount: 8, added: 58, practiced: 9, mastered: 20 },
  { word: 'insufferable', pos: 'adjective', color: 'red', definition: 'too extreme to bear; intolerable', status: 'new', added: 4 },

  // yellow
  { word: 'paragon', pos: 'noun', color: 'yellow', definition: 'a perfect example', status: 'mastered', streak: 6, timesPracticed: 12, correctCount: 11, added: 73, practiced: 6, mastered: 21 },
  { word: 'imbibe', pos: 'verb', color: 'yellow', definition: 'drink, absorb, consume', status: 'learning', streak: 2, timesPracticed: 4, correctCount: 2, added: 22, practiced: 4 },
  { word: 'slacker', pos: 'noun', color: 'yellow', definition: 'someone who avoids work or effort', translation: 'лодырь', status: 'new', added: 7 },
  { word: 'blab', pos: 'verb', color: 'yellow', definition: 'talk carelessly; disclose', translation: 'болтать, разболтать', status: 'learning', streak: 3, timesPracticed: 5, correctCount: 4, added: 31, practiced: 3 },
  { word: 'gleeful', pos: 'adjective', color: 'yellow', definition: 'delighted, joyful', translation: 'ликующий', status: 'mastered', streak: 5, timesPracticed: 13, correctCount: 10, added: 79, practiced: 46, mastered: 52 },
  { word: 'virtue', pos: 'noun', color: 'yellow', definition: 'good qualities; moral excellence', translation: 'добродетель', status: 'new', added: 3 },

  // green
  { word: 'propel', pos: 'verb', color: 'green', definition: 'drive or push forward', status: 'mastered', streak: 5, timesPracticed: 10, correctCount: 9, added: 66, practiced: 5, mastered: 17 },
  { word: 'savvy', pos: 'adjective', color: 'green', definition: 'sharp-witted, intelligent', status: 'learning', streak: 4, timesPracticed: 7, correctCount: 6, added: 38, practiced: 2 },
  { word: 'in spades', pos: 'expression', color: 'green', definition: 'to a very high degree', status: 'new', added: 9 },
  { word: 'thaw', pos: 'verb', color: 'green', definition: 'become friendlier; melt, soften', translation: 'оттаивать, смягчаться', status: 'learning', streak: 1, timesPracticed: 2, correctCount: 1, added: 14, practiced: 6 },
  { word: 'earnest', pos: 'adjective', color: 'green', definition: 'serious, solemn', translation: 'серьёзный', status: 'mastered', streak: 6, timesPracticed: 11, correctCount: 11, added: 55, practiced: 8, mastered: 18 },

  // blue
  { word: 'suffice', pos: 'verb', color: 'blue', definition: 'to be enough; meet requirements', status: 'learning', streak: 2, timesPracticed: 5, correctCount: 3, added: 26, practiced: 4 },
  { word: 'demarcate', pos: 'verb', color: 'blue', definition: 'separate or distinguish from', status: 'new', added: 6 },
  { word: 'uphold', pos: 'verb', color: 'blue', definition: 'confirm, sustain, maintain', status: 'mastered', streak: 5, timesPracticed: 12, correctCount: 10, added: 70, practiced: 7, mastered: 16 },
  { word: 'appraisal', pos: 'noun', color: 'blue', definition: 'assessment, evaluation', status: 'learning', streak: 3, timesPracticed: 6, correctCount: 4, added: 34, practiced: 3 },
  { word: 'streak', pos: 'noun', color: 'blue', definition: 'a characteristic or feature', translation: 'черта', examples: ['to have a mean streak'], status: 'new', added: 5 },
  { word: 'tenacious', pos: 'adjective', color: 'blue', definition: 'persistent, determined', status: 'mastered', streak: 5, timesPracticed: 14, correctCount: 12, added: 61, practiced: 10, mastered: 24 },

  // pink
  { word: 'apprehensive', pos: 'adjective', color: 'pink', definition: 'anxious', status: 'learning', streak: 2, timesPracticed: 4, correctCount: 2, added: 23, practiced: 5 },
  { word: 'eavesdrop', pos: 'verb', color: 'pink', definition: 'secretly listen to a conversation', translation: 'подслушивать', status: 'new', added: 8 },
  { word: 'epiphany', pos: 'noun', color: 'pink', definition: 'a moment of sudden, great revelation', status: 'mastered', streak: 5, timesPracticed: 10, correctCount: 8, added: 57, practiced: 9, mastered: 20 },
  { word: 'idolatry', pos: 'noun', color: 'pink', definition: 'the worship of idols', translation: 'идолопоклонство', status: 'new', added: 4 },
  { word: 'conjugal', pos: 'adjective', color: 'pink', definition: 'relating to marriage or spouses', translation: 'супружеский', status: 'learning', streak: 1, timesPracticed: 3, correctCount: 1, added: 19, practiced: 6 },
];

/** The full seed dictionary — a normalised copy used on first run. */
export const SEED_WORDS = RAW_SEED.map(seed);
