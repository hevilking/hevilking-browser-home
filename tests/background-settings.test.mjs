import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BACKGROUND_SETTINGS } from '../js/background/config.js';
import { backgroundSourceKey, isImageMode, normalizeBackgroundSettings, normalizeColor, sameBackgroundSettings } from '../js/background/settings-model.js';

test('合法零值会保留，异常参数会归一化到支持的范围', () => {
    const settings = normalizeBackgroundSettings({ overlayOpacity: 0, uiGlassBlur: 0, rotateIntervalSec: 95,
        filters: { blur: 0, brightness: 999, saturate: -1, contrast: 'not-a-number' } });
    assert.equal(settings.overlayOpacity, 0);
    assert.equal(settings.uiGlassBlur, 0);
    assert.equal(settings.filters.blur, 0);
    assert.equal(settings.filters.brightness, 140);
    assert.equal(settings.filters.saturate, 50);
    assert.equal(settings.filters.contrast, 100);
    assert.equal(settings.rotateIntervalSec, 100);
});

test('草稿和默认值不共享嵌套对象', () => {
    const first = normalizeBackgroundSettings();
    const second = normalizeBackgroundSettings();
    first.filters.blur = 12;
    first.sourcePolicy.fallbackOrder.push('custom');
    assert.equal(second.filters.blur, 0);
    assert.equal(DEFAULT_BACKGROUND_SETTINGS.filters.blur, 0);
    assert.deepEqual(second.sourcePolicy.fallbackOrder, ['local', 'bing', 'picsum']);
});

test('补丁保留已有参数，空数值使用已有值', () => {
    const base = normalizeBackgroundSettings({ mode: 'local', uiGlassBlur: 13, filters: { brightness: 112 } });
    const next = normalizeBackgroundSettings({ overlayOpacity: 0, uiGlassBlur: '', filters: { saturate: 88 } }, base);
    assert.equal(next.mode, 'local');
    assert.equal(next.uiGlassBlur, 13);
    assert.equal(next.filters.brightness, 112);
    assert.equal(next.filters.saturate, 88);
    assert.equal(next.overlayOpacity, 0);
});

test('颜色值支持简写和省略井号，非法值不进入配置', () => {
    assert.equal(normalizeColor('#AbC'), '#aabbcc');
    assert.equal(normalizeColor('123ABC'), '#123abc');
    assert.equal(normalizeColor('#12'), null);
    assert.equal(normalizeColor('red'), null);
    assert.equal(normalizeBackgroundSettings({ solidColor: 'invalid' }).solidColor, DEFAULT_BACKGROUND_SETTINGS.solidColor);
});

test('只改变滤镜无需换图，改变背景来源或颜色需要更新画面', () => {
    const base = normalizeBackgroundSettings({ mode: 'local' });
    const filtered = normalizeBackgroundSettings({ filters: { blur: 8 }, overlayOpacity: 15 }, base);
    assert.equal(backgroundSourceKey(base), backgroundSourceKey(filtered));
    assert.notEqual(backgroundSourceKey(base), backgroundSourceKey({ ...base, mode: 'online' }));
    assert.notEqual(backgroundSourceKey({ ...base, mode: 'solid', solidColor: '#112233' }),
        backgroundSourceKey({ ...base, mode: 'solid', solidColor: '#445566' }));
    assert.equal(isImageMode('gradient'), false);
    assert.equal(isImageMode('mixed'), true);
});

test('比较配置时统一颜色及默认值，恢复默认可消除改动', () => {
    assert.equal(sameBackgroundSettings({ mode: 'solid', solidColor: '#ABC' }, { mode: 'solid', solidColor: '#aabbcc' }), true);
    assert.equal(sameBackgroundSettings({}, DEFAULT_BACKGROUND_SETTINGS), true);
    assert.equal(sameBackgroundSettings({ overlayOpacity: 0 }, DEFAULT_BACKGROUND_SETTINGS), false);
});
