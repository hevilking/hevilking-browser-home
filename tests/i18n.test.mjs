import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messages, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguage, loadSavedLanguage, translate, LocalizedError } from '../js/i18n/messages.js';
import { saveSettingsPreferences } from '../js/settings/preferences.js';

function memoryStorage(initial = {}, failedKey = null) {
    const entries = new Map(Object.entries(initial));
    return {
        getItem: key => entries.get(key) ?? null,
        setItem(key, value) {
            if (key === failedKey) throw new Error('模拟存储写入失败');
            entries.set(key, String(value));
        },
        removeItem: key => entries.delete(key)
    };
}

test('首次使用、损坏配置和无法读取存储都默认中文，已保存英文可恢复', () => {
    assert.equal(DEFAULT_LANGUAGE, 'zh-CN');
    for (const value of [null, undefined, '', 'fr', 'en-US', 'EN']) {
        assert.equal(normalizeLanguage(value), 'zh-CN');
    }
    assert.equal(loadSavedLanguage(memoryStorage()), 'zh-CN');
    assert.equal(loadSavedLanguage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'en' })), 'en');
    assert.equal(loadSavedLanguage({ getItem() { throw new Error('模拟读取失败'); } }), 'zh-CN');
});

test('两份词典覆盖相同文案及参数，英文没有遗留中文', () => {
    assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages['zh-CN']).sort());
    const placeholders = text => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
    for (const [key, chinese] of Object.entries(messages['zh-CN'])) {
        const variants = typeof messages.en[key] === 'string' ? [messages.en[key]] : Object.values(messages.en[key]);
        for (const english of variants) {
            assert.ok(english.trim(), `${key} 不能为空`);
            assert.doesNotMatch(english, /\p{Script=Han}/u, key);
            assert.deepEqual(placeholders(english), placeholders(chinese), `${key} 的参数应一致`);
        }
    }
});

test('翻译处理英文单复数、逐项中文回退，并保留用户传入的文字', () => {
    assert.equal(translate('en', 'metadata.added', { count: 1 }), 'Imported 1 new shortcut.');
    assert.equal(translate('en', 'metadata.added', { count: 2 }), 'Imported 2 new shortcuts.');
    assert.equal(translate('en', 'metadata.added', { count: 0 }), 'Imported 0 new shortcuts.');
    assert.equal(translate('en', 'common.cancel', {}, { en: {}, 'zh-CN': { 'common.cancel': '取消' } }), '取消');
    assert.equal(translate('unknown', 'common.save'), '保存');
    assert.equal(translate('en', 'common.deleteNamed', { name: '我的网站 <img src=x>' }), 'Delete 我的网站 <img src=x>');
    const error = new LocalizedError('gallery.countLimit', { count: 30 });
    assert.equal(translate('en', error.key, error.values), 'You can save up to 30 local images.');
});

test('保存语言和背景时兼容旧配置，并保留合法零值', () => {
    const storage = memoryStorage({ backgroundSettings: '{"mode":"solid","overlayOpacity":20}' });
    const saved = saveSettingsPreferences({ mode: 'solid', overlayOpacity: 0, solidColor: '#abc' }, 'en', storage);
    assert.equal(loadSavedLanguage(storage), 'en');
    assert.equal(saved.overlayOpacity, 0);
    assert.equal(saved.solidColor, '#aabbcc');
    assert.deepEqual(JSON.parse(storage.getItem('backgroundSettings')), saved);
});

test('背景保存失败时恢复原语言记录，首次使用则清除临时记录', () => {
    for (const previous of [null, 'en']) {
        const oldBackground = '{"mode":"solid","solidColor":"#123456"}';
        const storage = memoryStorage({ backgroundSettings: oldBackground,
            ...(previous ? { [LANGUAGE_STORAGE_KEY]: previous } : {}) }, 'backgroundSettings');
        assert.throws(() => saveSettingsPreferences({ mode: 'gradient' }, previous ? 'zh-CN' : 'en', storage));
        assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), previous);
        assert.equal(storage.getItem('backgroundSettings'), oldBackground);
    }
});

test('语言写入失败时不提交背景，已有英文选择保持有效', () => {
    const oldBackground = '{"mode":"local"}';
    const storage = memoryStorage({ backgroundSettings: oldBackground, [LANGUAGE_STORAGE_KEY]: 'en' }, LANGUAGE_STORAGE_KEY);
    assert.throws(() => saveSettingsPreferences({ mode: 'gradient' }, 'zh-CN', storage));
    assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), 'en');
    assert.equal(storage.getItem('backgroundSettings'), oldBackground);
    // 语言没有变化时无需重写，因此仍可独立保存背景。
    saveSettingsPreferences({ mode: 'solid' }, 'en', storage);
    assert.equal(JSON.parse(storage.getItem('backgroundSettings')).mode, 'solid');
    const legacy = memoryStorage({ backgroundSettings: oldBackground }, LANGUAGE_STORAGE_KEY);
    saveSettingsPreferences({ mode: 'solid' }, 'zh-CN', legacy);
    assert.equal(legacy.getItem(LANGUAGE_STORAGE_KEY), null);
    assert.equal(JSON.parse(legacy.getItem('backgroundSettings')).mode, 'solid');
});
