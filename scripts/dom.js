/*
  FabVocab — DOM utilities.

  Small helpers for building and querying the DOM safely. Every piece of
  text goes in through `textContent` (never `innerHTML`), so user-entered
  words, definitions and examples can never be interpreted as markup
  (criterion: safe HTML insertion / XSS). Query helpers null-check so a
  missing element degrades gracefully instead of throwing.
*/

/**
 * Create an element.
 * @param {string} tag
 * @param {Object} [props] - class/text/attrs/dataset/handlers. `text` is set
 *   via textContent; `html` is intentionally unsupported.
 * @param {Array<Node|string>} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;

    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        node.dataset[dataKey] = dataValue;
      }
    } else if (key === 'attrs') {
      for (const [attrName, attrValue] of Object.entries(value)) {
        if (attrValue != null && attrValue !== false) {
          node.setAttribute(attrName, attrValue);
        }
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      // Plain DOM properties (id, type, value, href, disabled, checked, ...).
      node[key] = value;
    }
  }

  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** Create an inline SVG that references one of the shared `<symbol>` icons. */
export function icon(id, className = 'interface-icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  // href is a fragment id controlled by us, never user data.
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

/** Remove every child of a node. */
export function clear(node) {
  if (!node) return;
  node.replaceChildren();
}

/** Replace a node's children with the given nodes. */
export function render(node, ...children) {
  if (!node) return;
  node.replaceChildren(...children.flat().filter((child) => child != null && child !== false));
}

/** Null-safe single query. */
export function qs(selector, scope = document) {
  return scope ? scope.querySelector(selector) : null;
}

/** Query returning a real array (never throws on a missing scope). */
export function qsa(selector, scope = document) {
  return scope ? Array.from(scope.querySelectorAll(selector)) : [];
}
