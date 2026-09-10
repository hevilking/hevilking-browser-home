import chinese from './zh-CN.js';
import english from './en.js';

export const DEFAULT_LANGUAGE = 'zh-CN';
export const LANGUAGE_STORAGE_KEY = 'interfaceLanguage';
export const messages = { 'zh-CN': chinese, en: english };

export function normalizeLanguage(language) {
    return language === 'en' ? 'en' : DEFAULT_LANGUAGE;
}

export function loadSavedLanguage(storage = globalThis.localStorage) {
    try {
        return normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
        return DEFAULT_LANGUAGE;
    }
}

// 缺失文案逐项回退中文，参数只做文字替换，不作为 HTML 解释。
export function translate(language, key, values = {}, catalogues = messages) {
    const locale = normalizeLanguage(language);
    let entry = catalogues[locale]?.[key] ?? catalogues[DEFAULT_LANGUAGE]?.[key];
    if (entry && typeof entry === 'object') {
        const plural = new Intl.PluralRules(locale).select(Number(values.count ?? 0));
        entry = entry[plural] ?? entry.other;
    }
    if (typeof entry !== 'string') return key;
    return entry.replace(/\{(\w+)\}/g, (placeholder, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : placeholder);
}

// 异步操作保留错误标识，在展示时按当前语言生成提示。
export class LocalizedError extends Error {
    constructor(key, values = {}) {
        super(key);
        this.name = 'LocalizedError';
        this.key = key;
        this.values = values;
    }
}
