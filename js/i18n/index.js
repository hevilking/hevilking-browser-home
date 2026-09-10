import { DEFAULT_LANGUAGE, loadSavedLanguage, normalizeLanguage, translate } from './messages.js';

export { DEFAULT_LANGUAGE, LocalizedError } from './messages.js';

const attributes = ['title', 'placeholder', 'aria-label', 'alt'];
const selector = ['[data-i18n]', ...attributes.map(name => `[data-i18n-${name}]`)].join(',');
const parameters = new WeakMap();
const listeners = new Set();
let currentLanguage = DEFAULT_LANGUAGE;

export const getLanguage = () => currentLanguage;
export const t = (key, values) => translate(currentLanguage, key, values);

function renderBinding(element, attribute, key) {
    const value = parameters.get(element)?.get(attribute) || {};
    const text = t(key, typeof value === 'function' ? value() : value);
    if (attribute === 'textContent') {
        if (element.textContent !== text) element.textContent = text;
    } else if (element.getAttribute(attribute) !== text) {
        element.setAttribute(attribute, text);
    }
}

function renderElement(element) {
    if (element.dataset.i18n) renderBinding(element, 'textContent', element.dataset.i18n);
    for (const name of attributes) {
        const key = element.getAttribute(`data-i18n-${name}`);
        if (key) renderBinding(element, name, key);
    }
}

export function applyTranslations(root = document) {
    if (root.matches?.(selector)) renderElement(root);
    root.querySelectorAll(selector).forEach(renderElement);
}

function bind(element, attribute, key, values) {
    const marker = attribute === 'textContent' ? 'data-i18n' : `data-i18n-${attribute}`;
    if (!parameters.has(element)) parameters.set(element, new Map());
    parameters.get(element).set(attribute, values);
    element.setAttribute(marker, key);
    renderBinding(element, attribute, key);
}

export function setText(element, key, values = {}) {
    bind(element, 'textContent', key, values);
}

export function setAttributeText(element, attribute, key, values = {}) {
    if (!attributes.includes(attribute)) throw new Error(`不支持翻译的属性：${attribute}`);
    bind(element, attribute, key, values);
}

export function setLanguage(language) {
    currentLanguage = normalizeLanguage(language);
    document.documentElement.lang = currentLanguage;
    // 只更新已标记的文案，保留表单、焦点、卡片及缩略图节点。
    applyTranslations();
    listeners.forEach(listener => listener(currentLanguage));
}

export function initializeLanguage() {
    setLanguage(loadSavedLanguage());
}

export function onLanguageChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
