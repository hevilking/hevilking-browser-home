import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguage } from '../i18n/messages.js';
import { saveBackgroundSettings } from '../background/storage.js';

// 在同一同步提交中保存语言和背景；背景写入失败时撤回语言，保留面板草稿。
export function saveSettingsPreferences(background, language, storage = globalThis.localStorage) {
    const previous = storage.getItem(LANGUAGE_STORAGE_KEY);
    const next = normalizeLanguage(language);
    const changed = previous === null ? next !== DEFAULT_LANGUAGE : previous !== next;
    if (changed) storage.setItem(LANGUAGE_STORAGE_KEY, next);
    try {
        return saveBackgroundSettings(background, storage);
    } catch (error) {
        if (changed) {
            if (previous === null) storage.removeItem(LANGUAGE_STORAGE_KEY);
            else storage.setItem(LANGUAGE_STORAGE_KEY, previous);
        }
        throw error;
    }
}
