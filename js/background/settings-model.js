import { BACKGROUND_MODES, DEFAULT_BACKGROUND_SETTINGS } from './config.js';

export function isImageMode(mode) {
    return [BACKGROUND_MODES.MIXED, BACKGROUND_MODES.LOCAL, BACKGROUND_MODES.ONLINE].includes(mode);
}

export function normalizeColor(value) {
    const text = String(value || '').trim().replace(/^#/, '');
    if (/^[\da-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`;
    if (/^[\da-f]{3}$/i.test(text)) return `#${Array.from(text, part => part + part).join('').toLowerCase()}`;
    return null;
}

function boundedNumber(value, fallback, min, max, step = 1) {
    const number = value === '' || value === null ? NaN : Number(value);
    const finite = Number.isFinite(number) ? number : fallback;
    return Math.max(min, Math.min(max, Math.round(finite / step) * step));
}

// 保留旧配置字段，深拷贝嵌套参数，同时确保 0 等合法值不会被默认值覆盖。
export function normalizeBackgroundSettings(patch = {}, base = DEFAULT_BACKGROUND_SETTINGS) {
    const input = patch && typeof patch === 'object' ? patch : {};
    const merged = {
        ...base, ...input,
        filters: { ...base.filters, ...input.filters },
        sourcePolicy: { ...base.sourcePolicy, ...input.sourcePolicy }
    };
    if (!Object.values(BACKGROUND_MODES).includes(merged.mode)) merged.mode = base.mode;
    merged.autoRotate = merged.autoRotate === true;
    merged.rotateIntervalSec = boundedNumber(merged.rotateIntervalSec, base.rotateIntervalSec, 10, 1800, 10);
    merged.overlayOpacity = boundedNumber(merged.overlayOpacity, base.overlayOpacity, 0, 70);
    merged.uiGlassBlur = boundedNumber(merged.uiGlassBlur, base.uiGlassBlur, 0, 30);
    merged.solidColor = normalizeColor(merged.solidColor) || base.solidColor;
    if (typeof merged.gradientPreset !== 'string' || !/^(linear|radial)-gradient\(/.test(merged.gradientPreset)) {
        merged.gradientPreset = base.gradientPreset;
    }
    for (const [key, min, max] of [['blur', 0, 20], ['brightness', 60, 140], ['saturate', 50, 180], ['contrast', 50, 150]]) {
        merged.filters[key] = boundedNumber(merged.filters[key], base.filters[key], min, max);
    }
    return JSON.parse(JSON.stringify(merged));
}

export function backgroundSourceKey(settings) {
    if (settings.mode === BACKGROUND_MODES.SOLID) return `solid:${settings.solidColor}`;
    if (settings.mode === BACKGROUND_MODES.GRADIENT) return `gradient:${settings.gradientPreset}`;
    return settings.mode;
}

export function sameBackgroundSettings(first, second) {
    return JSON.stringify(normalizeBackgroundSettings(first)) === JSON.stringify(normalizeBackgroundSettings(second));
}
