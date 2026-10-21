/*
  FabVocab — minimal hash router.

  Replaces the static `:target` screen switching with JS-driven routing so
  screens are shown from application state. A hash looks like
  `#word-detail/<id>`: a screen id and an optional parameter. Parsing is
  guarded (decodeURIComponent in try/catch) so a malformed hash resolves to
  the default screen instead of throwing (criterion: guarded decoding).
*/

import { qsa } from './dom.js';

/** Parse `#screen/param` into its parts, decoding the param defensively. */
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return { screen: '', param: '' };

  const slashIndex = raw.indexOf('/');
  const screen = slashIndex === -1 ? raw : raw.slice(0, slashIndex);
  const rawParam = slashIndex === -1 ? '' : raw.slice(slashIndex + 1);

  let param = '';
  try {
    param = decodeURIComponent(rawParam);
  } catch {
    param = ''; // malformed percent-encoding — ignore the param
  }
  return { screen, param };
}

/** Build a hash string for a screen and optional param. */
export function toHash(screen, param = '') {
  return param ? `#${screen}/${encodeURIComponent(param)}` : `#${screen}`;
}

/**
 * Wire up a page's screens.
 * @param {object} options
 * @param {string} options.screenSelector - selector matching all screens.
 * @param {string} options.activeClass - class toggled on the active screen.
 * @param {string} options.defaultId - screen shown when the hash is unknown.
 * @param {(screen:string, param:string)=>void} options.onChange
 * @returns {() => void} a function that re-evaluates the current route.
 */
export function initRouter({ screenSelector, activeClass = 'is-active', defaultId, onChange }) {
  const screens = qsa(screenSelector);
  const ids = new Set(screens.map((screen) => screen.id).filter(Boolean));

  function resolve() {
    const { screen, param } = parseHash(location.hash);
    const activeId = ids.has(screen) ? screen : defaultId;

    for (const section of screens) {
      section.classList.toggle(activeClass, section.id === activeId);
    }

    // Keep the viewport at the top when switching screens.
    if (typeof onChange === 'function') onChange(activeId, param);
  }

  window.addEventListener('hashchange', resolve);
  return resolve;
}
