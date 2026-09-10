import {
    BACKGROUND_SETTINGS_KEY,
    BACKGROUND_RUNTIME_CACHE_KEY,
    BACKGROUND_SETTINGS_VERSION,
    DEFAULT_RUNTIME_CACHE
} from './config.js';
import { normalizeBackgroundSettings } from './settings-model.js';

function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') {
        return { ...base };
    }

    const merged = { ...base };
    Object.keys(patch).forEach((key) => {
        const baseValue = merged[key];
        const patchValue = patch[key];

        if (Array.isArray(baseValue) && Array.isArray(patchValue)) {
            merged[key] = [...patchValue];
            return;
        }

        if (
            baseValue &&
            patchValue &&
            typeof baseValue === 'object' &&
            typeof patchValue === 'object' &&
            !Array.isArray(baseValue) &&
            !Array.isArray(patchValue)
        ) {
            merged[key] = deepMerge(baseValue, patchValue);
            return;
        }

        merged[key] = patchValue;
    });

    return merged;
}

export function loadBackgroundSettings() {
    const raw = localStorage.getItem(BACKGROUND_SETTINGS_KEY);
    if (!raw) {
        return normalizeBackgroundSettings();
    }

    try {
        const parsed = JSON.parse(raw);
        const merged = normalizeBackgroundSettings(parsed);
        if (!merged.version || merged.version < BACKGROUND_SETTINGS_VERSION) {
            merged.version = BACKGROUND_SETTINGS_VERSION;
        }
        return merged;
    } catch (error) {
        console.error('读取背景设置失败，将使用默认值:', error);
        return normalizeBackgroundSettings();
    }
}

export function saveBackgroundSettings(settings, storage = localStorage) {
    const merged = normalizeBackgroundSettings(settings);
    merged.version = BACKGROUND_SETTINGS_VERSION;
    storage.setItem(BACKGROUND_SETTINGS_KEY, JSON.stringify(merged));
    return merged;
}

export function loadRuntimeCache() {
    const raw = localStorage.getItem(BACKGROUND_RUNTIME_CACHE_KEY);
    if (!raw) {
        return { ...DEFAULT_RUNTIME_CACHE };
    }

    try {
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_RUNTIME_CACHE, parsed);
    } catch (error) {
        console.error('读取背景运行缓存失败，将使用默认值:', error);
        return { ...DEFAULT_RUNTIME_CACHE };
    }
}

export function saveRuntimeCache(cache) {
    const merged = deepMerge(DEFAULT_RUNTIME_CACHE, cache);
    localStorage.setItem(BACKGROUND_RUNTIME_CACHE_KEY, JSON.stringify(merged));
    return merged;
}

