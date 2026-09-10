import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// 可通过参数指定环境已有的 Playwright 和浏览器，无需给扩展引入运行时依赖。
const { values } = parseArgs({ options: {
    playwright: { type: 'string' }, browser: { type: 'string' }, artifacts: { type: 'string' }
} });
const require = createRequire(import.meta.url);
const { chromium } = require(values.playwright || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (count = 8) => Array.from({ length: count }, (_, index) => ({
    name: `网站 ${index + 1}`, url: `https://shortcut-${index + 1}.example/`
}));
let server;
let browser;
let origin;

before(async () => {
    server = createServer(async (request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!path.startsWith(root + sep)) {
            response.writeHead(403).end();
            return;
        }
        try {
            const content = await readFile(path);
            const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.png': 'image/png', '.webp': 'image/webp' }[extname(path)] || 'application/octet-stream';
            response.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
            response.end(content);
        } catch {
            response.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, executablePath: values.browser });
    if (values.artifacts) await mkdir(values.artifacts, { recursive: true });
});

after(async () => {
    await browser?.close();
    await new Promise(resolve => server ? server.close(resolve) : resolve());
});

async function openPage(t, items = fixture(), options = {}) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 820 }, ...options });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await context.addInitScript(items => {
        if (location.protocol !== 'http:') return;
        if (!sessionStorage.getItem('shortcut-test-seeded')) {
            localStorage.setItem('shortcuts', JSON.stringify(items));
            localStorage.setItem('backgroundSettings', JSON.stringify({ mode: 'solid', solidColor: '#263c48' }));
            sessionStorage.setItem('shortcut-test-seeded', 'true');
        }
        window.shortcutTestWrites = 0;
        window.backgroundTestWrites = 0;
        window.backgroundRuntimeWrites = 0;
        window.languageTestWrites = 0;
        document.addEventListener('pointerdown', event => { window.shortcutTestPointer = event.pointerId; }, true);
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (this === localStorage && key === 'shortcuts') window.shortcutTestWrites++;
            if (this === localStorage && key === 'backgroundSettings') {
                window.backgroundTestWrites++;
                if (window.backgroundTestFailSave) throw new DOMException('模拟配置存储已满', 'QuotaExceededError');
            }
            if (this === localStorage && key === 'backgroundRuntimeCache') window.backgroundRuntimeWrites++;
            if (this === localStorage && key === 'interfaceLanguage') {
                window.languageTestWrites++;
                if (window.languageTestFailSave) throw new DOMException('模拟语言设置保存失败', 'QuotaExceededError');
            }
            if (this === localStorage && key === 'shortcuts' && window.shortcutTestFailSave) {
                throw new DOMException('模拟存储已满', 'QuotaExceededError');
            }
            return setItem.call(this, key, value);
        };
    }, items);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let popups = 0;
    context.on('page', popup => { popups++; popup.close().catch(() => {}); });
    t.after(async () => {
        await context.close();
        assert.deepEqual(errors, [], '页面不应出现 JavaScript 异常');
    });
    await page.goto(origin);
    await page.waitForFunction(count => document.querySelectorAll('#shortcuts > .shortcut').length === count, items.length);
    await page.evaluate(() => {
        window.shortcutTestWrites = 0;
        window.shortcutTestNodes = [...document.querySelectorAll('#shortcuts > .shortcut')];
    });
    return { page, context, popups: () => popups };
}

const cards = page => page.locator('#shortcuts > .shortcut');
const names = page => page.locator('#shortcuts > .shortcut .shortcut-name').allTextContents();
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('shortcuts')));
const writes = page => page.evaluate(() => window.shortcutTestWrites);
const idle = page => page.waitForFunction(() => !document.querySelector('.shortcut-drag-preview, .shortcuts.is-sorting'));

async function captureScreenshot(page, name) {
    if (!values.artifacts) return;
    // 截图跳过淡入过渡帧，检查文字对比度及最终布局。
    await page.screenshot({ path: resolve(values.artifacts, name), animations: 'disabled' });
}

async function pointAt(page, index, fraction = 0.5) {
    const rect = await cards(page).nth(index).boundingBox();
    return { x: rect.x + rect.width * fraction, y: rect.y + rect.height / 2 };
}

async function startDrag(page, index = 0) {
    const point = await pointAt(page, index);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 10, point.y);
    await page.waitForSelector('.shortcut-drag-preview');
    return point;
}

test('搜索禁止排序，筛选后的编辑和删除只影响正确的 ID', async t => {
    const items = ['A', 'B 匹配', 'C', 'D 匹配'].map((name, index) => ({ name, url: `https://item-${index}.example/` }));
    const { page } = await openPage(t, items);
    const initial = await saved(page);
    assert.equal(new Set(initial.map(item => item.id)).size, 4);
    await page.locator('#shortcutSearchBtn').click();
    await page.locator('#shortcutSearchInput').fill('匹配');
    assert.deepEqual(await names(page), ['B 匹配', 'D 匹配']);
    const from = await pointAt(page, 1);
    const to = await pointAt(page, 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('.shortcut-drag-preview').count(), 0);
    assert.deepEqual(await saved(page), initial);
    assert.equal(await writes(page), 0);
    assert.equal(await page.locator('#shortcutSortHelpTitle').textContent(), '清除搜索后可排序');
    assert.equal(await page.locator('#shortcutSortHelp').isVisible(), false);

    await cards(page).nth(1).hover();
    await cards(page).nth(1).locator('.shortcut-edit').click();
    assert.equal(await page.locator('#shortcutName').inputValue(), 'D 匹配');
    await page.locator('#shortcutName').fill('D 匹配 已编辑');
    await page.locator('#submitBtn').click();
    assert.equal((await saved(page))[3].id, initial[3].id);
    assert.equal((await saved(page))[3].name, 'D 匹配 已编辑');
    assert.equal(await page.locator('#shortcutSearchInput').inputValue(), '匹配');
    await cards(page).first().hover();
    await cards(page).first().locator('.shortcut-delete').click();
    assert.deepEqual((await saved(page)).map(item => item.id), [initial[0].id, initial[2].id, initial[3].id]);
    await page.locator('#clearShortcutSearchBtn').click();
    assert.deepEqual(await names(page), ['A', 'C', 'D 匹配 已编辑']);
});

test('鼠标阈值、实时预览、单次保存、节点复用和撤销', async t => {
    const { page, popups } = await openPage(t);
    const initial = await saved(page);
    const initialLayout = await page.locator('.shortcuts-container').boundingBox();
    const from = await pointAt(page, 0);
    const to = await pointAt(page, 2, 0.85);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 3, from.y);
    assert.equal(await page.locator('.shortcut-drag-preview').count(), 0);
    await page.mouse.move(from.x + 10, from.y);
    await page.waitForSelector('.shortcut-drag-preview');
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.waitForFunction(() => document.querySelectorAll('#shortcuts .shortcut-name')[2].textContent === '网站 1');
    assert.equal(await page.locator('.shortcut-sort-source').count(), 1);
    assert.deepEqual(await saved(page), initial);
    assert.equal(await writes(page), 0);
    await page.waitForFunction(() => [...document.querySelectorAll('#shortcuts > .shortcut')]
        .every(item => item.getAnimations().length === 0));
    await captureScreenshot(page, 'drag-preview.png');
    const preview = await names(page);
    await page.mouse.up();
    await idle(page);
    assert.deepEqual((await saved(page)).map(item => item.name), preview);
    assert.equal(await writes(page), 1);
    assert.equal(popups(), 0);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#shortcuts > .shortcut')]
        .every(item => window.shortcutTestNodes.includes(item))), true);
    assert.equal(await page.locator('#undoShortcutSortBtn').isVisible(), true);
    assert.deepEqual(await page.locator('.shortcuts-container').boundingBox(), initialLayout);
    await captureScreenshot(page, 'undo-toast.png');
    await page.locator('#undoShortcutSortBtn').click();
    assert.deepEqual(await saved(page), initial);
    assert.equal(await writes(page), 2);
    assert.equal(await page.evaluate(() => document.activeElement.closest('.shortcut')?.dataset.shortcutId), initial[0].id);
    await captureScreenshot(page, 'shortcuts-desktop.png');
});

test('跨行和末行空白可以放到末尾，刷新保持顺序', async t => {
    const { page, popups } = await openPage(t);
    const initial = await saved(page);
    const last = await pointAt(page, 7);
    const grid = await page.locator('#shortcuts').boundingBox();
    await startDrag(page);
    await page.mouse.move(grid.x + grid.width - 8, last.y, { steps: 12 });
    await page.waitForFunction(() => document.querySelector('#shortcuts > .shortcut:last-child .shortcut-name').textContent === '网站 1');
    await page.mouse.up();
    await idle(page);
    const expected = [...initial.slice(1), initial[0]];
    assert.deepEqual(await saved(page), expected);
    assert.equal(popups(), 0);
    await page.reload();
    await page.waitForSelector('#shortcuts > .shortcut');
    assert.deepEqual(await saved(page), expected);
    assert.deepEqual(await names(page), expected.map(item => item.name));
    assert.equal(await writes(page), 0, '已有 ID 在重新加载时不应再次迁移');
});

test('区域外松手和原位放下不写入数据，也不打开网站', async t => {
    const { page, popups } = await openPage(t);
    const initial = await saved(page);
    const to = await pointAt(page, 0, 0.2);
    await startDrag(page, 7);
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.waitForFunction(() => document.querySelector('#shortcuts .shortcut-name').textContent === '网站 8');
    await page.mouse.move(10, 10, { steps: 8 });
    await page.mouse.up();
    await idle(page);
    assert.deepEqual(await saved(page), initial);
    assert.deepEqual(await names(page), initial.map(item => item.name));

    const grid = await page.locator('#shortcuts').boundingBox();
    await startDrag(page);
    await page.mouse.move(grid.x + grid.width + 30, grid.y + 50, { steps: 10 });
    await page.mouse.up();
    await idle(page);
    assert.deepEqual(await names(page), initial.map(item => item.name));
    await startDrag(page);
    await page.mouse.up();
    await idle(page);
    assert.equal(await writes(page), 0);
    assert.equal(popups(), 0);
    assert.equal(await page.locator('#shortcutSortUndo').isVisible(), false);
});

test('空格和方向键不会启动排序，链接保留原生打开行为', async t => {
    const { page, popups } = await openPage(t);
    const initial = await saved(page);
    await cards(page).first().locator('.shortcut-link').focus();
    for (const key of ['Space', 'ArrowRight', 'ArrowDown', 'Home', 'End']) {
        await page.keyboard.press(key);
    }
    assert.equal(await page.locator('#shortcuts.is-sorting, .shortcut-drag-preview').count(), 0);
    assert.deepEqual(await saved(page), initial);
    assert.deepEqual(await names(page), initial.map(item => item.name));
    assert.equal(await writes(page), 0);
    assert.equal(popups(), 0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    assert.equal(popups(), 1);
});

test('长列表边缘自动滚动到底部，并保存实际预览顺序', async t => {
    const { page } = await openPage(t, fixture(60), { viewport: { width: 1100, height: 700 } });
    const grid = await page.locator('#shortcuts').boundingBox();
    await startDrag(page);
    await page.mouse.move(grid.x + grid.width - 8, grid.y + grid.height - 3, { steps: 12 });
    await page.waitForFunction(() => {
        const grid = document.querySelector('#shortcuts');
        return grid.scrollTop > 80 && grid.scrollHeight - grid.clientHeight - grid.scrollTop < 2;
    }, null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#shortcuts > .shortcut:last-child .shortcut-name').textContent === '网站 1');
    const preview = await names(page);
    assert.equal(await writes(page), 0);
    await page.mouse.up();
    await idle(page);
    assert.deepEqual((await saved(page)).map(item => item.name), preview);
    assert.equal(await writes(page), 1);
});

test('减少动画模式不缩放浮层，点击仍能正常打开网站', async t => {
    const { page, popups } = await openPage(t, fixture(), { reducedMotion: 'reduce' });
    await startDrag(page);
    assert.equal(await page.locator('.shortcut-drag-preview').evaluate(item => new DOMMatrix(getComputedStyle(item).transform).a), 1);
    await page.mouse.up();
    await idle(page);
    await cards(page).first().locator('.shortcut-link').click();
    await page.waitForTimeout(100);
    assert.equal(popups(), 1);
});

test('触屏长按拖动可提交，长按前滑动仍能滚动列表', async t => {
    const { page, context, popups } = await openPage(t, fixture(24), {
        viewport: { width: 480, height: 820 }, isMobile: true, hasTouch: true
    });
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }]
    });
    const from = await pointAt(page, 0);
    const to = await pointAt(page, 2, 0.85);
    await touch('touchStart', from.x, from.y);
    await page.waitForSelector('.shortcut-drag-preview', { timeout: 2000 });
    for (let step = 1; step <= 8; step++) {
        await touch('touchMove', from.x + (to.x - from.x) * step / 8, to.y);
    }
    await touch('touchEnd');
    await idle(page);
    assert.equal((await saved(page))[2].name, '网站 1');
    assert.equal(await writes(page), 1);
    assert.equal(popups(), 0);
    await captureScreenshot(page, 'shortcuts-touch.png');

    const grid = await page.locator('#shortcuts').boundingBox();
    const x = grid.x + grid.width / 2;
    const y = grid.y + Math.min(grid.height - 30, 200);
    await touch('touchStart', x, y);
    for (let step = 1; step <= 8; step++) await touch('touchMove', x, y - step * 16);
    await touch('touchEnd');
    await page.waitForFunction(() => document.querySelector('#shortcuts').scrollTop > 20);
    assert.equal(await page.locator('.shortcut-drag-preview').count(), 0);
    assert.equal(await writes(page), 1);
});

test('编辑按钮不会启动拖动，仍可正常打开编辑窗口', async t => {
    const { page } = await openPage(t);
    const initial = await saved(page);
    await cards(page).first().hover();
    const button = await cards(page).first().locator('.shortcut-edit').boundingBox();
    const to = await pointAt(page, 2);
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('.shortcut-drag-preview').count(), 0);
    await cards(page).first().hover();
    await cards(page).first().locator('.shortcut-edit').click();
    assert.equal(await page.locator('#addShortcutModal.active').count(), 1);
    assert.equal(await page.locator('#shortcutName').inputValue(), initial[0].name);
    await page.locator('#closeModal').click();
    assert.deepEqual(await saved(page), initial);
    assert.deepEqual(await names(page), initial.map(item => item.name));
    assert.equal(await writes(page), 0);
});

test('调整窗口、取消指针和外部数据更新会安全结束拖动', async t => {
    const { page } = await openPage(t);
    const initial = await saved(page);
    await startDrag(page);
    await page.setViewportSize({ width: 950, height: 760 });
    await idle(page);
    await page.mouse.up();
    assert.deepEqual(await saved(page), initial);
    await startDrag(page);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.shortcutTestPointer })));
    await page.mouse.up();
    await idle(page);
    assert.equal(await writes(page), 0);
    await startDrag(page);
    await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('shortcuts'));
        items.push({ id: 'external-item', name: '外部新增', url: 'https://external.example/' });
        const newValue = JSON.stringify(items);
        localStorage.setItem('shortcuts', newValue);
        window.dispatchEvent(new StorageEvent('storage', { key: 'shortcuts', newValue, storageArea: localStorage }));
    });
    await page.mouse.up();
    await idle(page);
    assert.deepEqual(await names(page), [...initial.map(item => item.name), '外部新增']);
    assert.equal((await saved(page)).length, initial.length + 1);
    assert.equal(await writes(page), 1, '拖动取消后不得覆盖外部新增的数据');
});

test('保存失败时恢复预览顺序，修复存储后可以继续排序', async t => {
    const { page } = await openPage(t);
    const initial = await saved(page);
    const to = await pointAt(page, 2, 0.85);
    await page.evaluate(() => { window.shortcutTestFailSave = true; });
    await startDrag(page);
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await idle(page);
    assert.deepEqual(await saved(page), initial);
    assert.deepEqual(await names(page), initial.map(item => item.name));
    assert.equal(await page.locator('#shortcutSortUndo').isVisible(), false);
    await page.evaluate(() => { window.shortcutTestFailSave = false; });
    await startDrag(page);
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await idle(page);
    assert.equal((await saved(page))[2].name, '网站 1');
});

test('导入旧格式补齐 ID，导出仍兼容原来的 name/url 格式', async t => {
    const { page } = await openPage(t, fixture(2));
    const initial = await saved(page);
    await page.evaluate(() => {
        window.prompt = () => JSON.stringify([
            { name: '重复网站', url: 'https://shortcut-1.example/' },
            { name: '新网站', url: 'https://new-shortcut.example/' }
        ]);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async text => { window.shortcutTestExport = JSON.parse(text); } }
        });
    });
    await page.locator('#importShortcutMetaBtn').click();
    const imported = await saved(page);
    assert.equal(imported.length, 3);
    assert.deepEqual(imported.slice(0, 2), initial);
    assert.equal(new Set(imported.map(item => item.id)).size, 3);
    await page.locator('#copyShortcutMetaBtn').click();
    const exported = await page.evaluate(() => window.shortcutTestExport);
    assert.equal(exported.version, 1);
    assert.deepEqual(exported.shortcuts, imported.map(({ name, url }) => ({ name, url })));
});

test('帮助气泡支持悬停、聚焦、点击和关闭，显示时不改变卡片布局', async t => {
    const { page } = await openPage(t);
    const trigger = page.locator('#dragHintBtn');
    const popup = page.locator('#shortcutSortHelp');
    const layout = await page.locator('.shortcuts-container').boundingBox();
    assert.equal(await popup.isVisible(), false);
    assert.equal(await page.locator('#shortcutSortFeedback').isVisible(), false);

    await trigger.hover();
    await popup.waitFor({ state: 'visible' });
    assert.match(await popup.textContent(), /鼠标左键/);
    assert.doesNotMatch(await popup.textContent(), /空格|方向键|Enter|Esc/);
    assert.deepEqual(await page.locator('.shortcuts-container').boundingBox(), layout);
    await popup.hover();
    assert.equal(await popup.isVisible(), true);
    await captureScreenshot(page, 'sort-help-desktop.png');
    await page.mouse.move(10, 10);
    await popup.waitFor({ state: 'hidden' });

    await trigger.focus();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await popup.isVisible(), false);
    await page.keyboard.press('Enter');
    assert.equal(await popup.isVisible(), true);
    await page.keyboard.press('Tab');
    assert.equal(await popup.isVisible(), false);

    await trigger.click();
    assert.equal(await popup.isVisible(), true);
    await trigger.click();
    assert.equal(await popup.isVisible(), false);
    await trigger.click();
    await startDrag(page);
    assert.equal(await popup.isVisible(), false);
    assert.equal(await page.locator('#shortcutSortFeedback').isVisible(), true);
    assert.equal(await page.locator('#shortcutSortFeedback').textContent(), '松手放置');
    assert.deepEqual(await page.locator('.shortcuts-container').boundingBox(), layout);
    await page.mouse.move(10, 10);
    await page.mouse.up();
    await idle(page);
    assert.equal(await page.locator('#shortcutSortFeedback').isVisible(), false);
});

test('触屏帮助可点击开关，窄屏搜索说明不会溢出页面', async t => {
    const { page } = await openPage(t, fixture(4), {
        viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true
    });
    const trigger = page.locator('#dragHintBtn');
    const popup = page.locator('#shortcutSortHelp');
    await trigger.tap();
    assert.equal(await popup.isVisible(), true);
    assert.match(await page.locator('#shortcutSortHelpPointer').textContent(), /鼠标左键/);
    assert.doesNotMatch(await popup.textContent(), /空格|方向键|Enter|Esc/);
    const bounds = await popup.boundingBox();
    assert.ok(bounds.x >= 11 && bounds.x + bounds.width <= 349);
    await trigger.tap();
    assert.equal(await popup.isVisible(), false);

    await page.locator('#shortcutSearchBtn').tap();
    await page.locator('#shortcutSearchInput').fill('网站 1');
    await trigger.tap();
    assert.equal(await page.locator('#shortcutSortHelpTitle').textContent(), '清除搜索后可排序');
    const filteredBounds = await popup.boundingBox();
    assert.ok(filteredBounds.x >= 11 && filteredBounds.x + filteredBounds.width <= 349);
    await captureScreenshot(page, 'sort-help-touch.png');
    await page.locator('#clearShortcutSearchBtn').tap();
    assert.equal(await popup.isVisible(), false);
    assert.equal(await cards(page).count(), 4);
});

test('悬浮撤销自动消失，悬停阅读时暂停计时', async t => {
    const { page } = await openPage(t);
    await page.clock.install();
    const layout = await page.locator('.shortcuts-container').boundingBox();
    const to = await pointAt(page, 2, 0.85);
    await startDrag(page);
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await idle(page);
    const toast = page.locator('#shortcutSortUndo');
    assert.equal(await toast.isVisible(), true);
    await toast.hover();
    await page.clock.fastForward(6000);
    assert.equal(await toast.isVisible(), true);
    await page.mouse.move(10, 10);
    await page.clock.fastForward(5100);
    assert.equal(await toast.isVisible(), false);
    assert.deepEqual(await page.locator('.shortcuts-container').boundingBox(), layout);
});

const suggestionApiPattern = /https:\/\/(api\.bing\.com|suggestqueries\.google\.com|www\.baidu\.com|suggestion\.baidu\.com|duckduckgo\.com)\//;

async function mockEngineSuggestions(page) {
    await page.route(suggestionApiPattern, route => {
        const url = new URL(route.request().url());
        const engine = url.hostname === 'api.bing.com' ? 'Bing'
            : url.hostname === 'suggestqueries.google.com' ? 'Google'
            : url.hostname === 'duckduckgo.com' ? 'DuckDuckGo' : '百度';
        const query = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('wd');
        const phrase = `${engine} ${query}`;
        const data = engine === '百度' ? { g: [{ q: phrase }] }
            : engine === 'DuckDuckGo' ? [{ phrase }] : [query, [phrase]];
        return route.fulfill({
            contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(data)
        });
    });
}

async function chooseEngine(page, name) {
    await page.locator('#searchEngineBtn').click();
    await page.getByRole('option', { name, exact: true }).click();
}

async function waitForSuggestion(page, text) {
    await page.waitForFunction(expected => document.querySelector('.search-suggestion-item-text')?.textContent === expected, text);
}

test('引擎菜单贴合按钮展开，四项选择明确且不改变页面布局', async t => {
    const { page } = await openPage(t);
    const trigger = page.locator('#searchEngineBtn');
    const menu = page.locator('#searchEngineDropdown');
    const initialLayout = await page.locator('.shortcuts-container').boundingBox();
    await trigger.hover();
    assert.equal(await menu.isVisible(), false);
    await trigger.click();
    assert.equal(await menu.isVisible(), true);
    assert.deepEqual(await menu.locator('.engine-name').allTextContents(), ['Google', 'Bing', '百度', 'DuckDuckGo']);
    assert.equal(await menu.locator('[aria-selected="true"]').getAttribute('data-engine'), 'Bing');
    await page.waitForFunction(() => document.querySelector('#searchEngineDropdown').getAnimations().length === 0);
    const geometry = await page.evaluate(() => {
        const button = document.querySelector('#searchEngineBtn').getBoundingClientRect();
        const popup = document.querySelector('#searchEngineDropdown').getBoundingClientRect();
        return { horizontalOffset: popup.left - button.left, gap: popup.top - button.bottom, width: popup.width };
    });
    assert.ok(Math.abs(geometry.horizontalOffset) < 1);
    assert.ok(geometry.gap >= 7 && geometry.gap <= 9);
    assert.ok(geometry.width >= 180 && geometry.width <= 200);
    assert.deepEqual(await page.locator('.shortcuts-container').boundingBox(), initialLayout);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await captureScreenshot(page, 'search-engine-dropdown.png');
    await page.mouse.click(10, 10);
    assert.equal(await menu.isVisible(), false);
    await trigger.click();
    await trigger.click();
    assert.equal(await menu.isVisible(), false);
});

test('切换各引擎保留输入和光标，搜索地址正确且刷新后记住选择', async t => {
    const { page } = await openPage(t);
    const input = page.locator('#searchInput');
    const draft = '  浏览器主页 测试  ';
    const engines = [
        ['Google', 'https://www.google.com/search?q='],
        ['百度', 'https://www.baidu.com/s?wd='],
        ['Bing', 'https://cn.bing.com/search?q='],
        ['DuckDuckGo', 'https://duckduckgo.com/?q=']
    ];
    await page.evaluate(() => {
        window.engineTestSearches = [];
        window.open = url => { window.engineTestSearches.push(url); return null; };
    });
    const originalInput = await input.boundingBox();
    const engineWidths = new Map();
    for (const [index, [engine, prefix]] of engines.entries()) {
        await input.fill(draft);
        await input.evaluate(element => element.setSelectionRange(2, 6, 'backward'));
        await chooseEngine(page, engine);
        assert.equal(await input.inputValue(), draft);
        assert.deepEqual(await input.evaluate(element => [element.selectionStart, element.selectionEnd, element.selectionDirection]), [2, 6, 'backward']);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'searchInput');
        assert.equal(await page.locator('#currentEngine').textContent(), engine);
        assert.equal(await page.evaluate(() => localStorage.getItem('defaultSearchEngine')), engine);
        assert.equal(await page.locator('#searchEngineDropdown').isVisible(), false);
        const inputRect = await input.boundingBox();
        engineWidths.set(engine, (await page.locator('#searchEngineBtn').boundingBox()).width);
        assert.equal(inputRect.x + inputRect.width, originalInput.x + originalInput.width);
        assert.equal(await page.locator('#currentEngine').evaluate(element => element.scrollWidth <= element.clientWidth), true);
        assert.equal(await page.evaluate(() => window.engineTestSearches.length), index);
        assert.equal(await page.locator('.notification').filter({ hasText: '已切换到' }).count(), 0);
        if (index === 0) await input.press('Enter');
        else await page.locator('#searchButton').click();
        assert.equal(await page.evaluate(() => window.engineTestSearches.at(-1)), prefix + encodeURIComponent(draft.trim()));
    }
    assert.ok(engineWidths.get('DuckDuckGo') > engineWidths.get('Google'));
    assert.ok(engineWidths.get('Google') > engineWidths.get('Bing'));
    assert.ok(engineWidths.get('Google') > engineWidths.get('百度'));
    await page.reload();
    assert.equal(await page.locator('#currentEngine').textContent(), 'DuckDuckGo');
    await page.locator('#searchEngineBtn').click();
    assert.equal(await page.locator('#searchEngineDropdown [aria-selected="true"]').getAttribute('data-engine'), 'DuckDuckGo');
});

test('引擎菜单与历史及联想互斥，选择后刷新对应引擎的联想', async t => {
    const { page } = await openPage(t);
    await mockEngineSuggestions(page);
    await page.evaluate(() => localStorage.setItem('searchHistory', JSON.stringify(['历史搜索'])));
    await page.reload();
    await page.locator('#searchInput').click();
    assert.equal(await page.locator('#searchHistoryDropdown').isVisible(), true);
    await page.locator('#searchEngineBtn').click();
    assert.equal(await page.locator('#searchHistoryDropdown').isVisible(), false);
    await page.getByRole('option', { name: 'Bing', exact: true }).click();
    assert.equal(await page.locator('#searchHistoryDropdown').isVisible(), true);
    await page.locator('#searchInput').fill('测试搜索');
    await waitForSuggestion(page, 'Bing 测试搜索');
    for (const engine of ['Google', '百度', 'DuckDuckGo']) {
        await page.locator('#searchEngineBtn').click();
        assert.equal(await page.locator('#searchSuggestionsDropdown').isVisible(), false);
        assert.equal(await page.locator('#searchHistoryDropdown').isVisible(), false);
        await page.getByRole('option', { name: engine, exact: true }).click();
        await waitForSuggestion(page, `${engine} 测试搜索`);
        assert.equal(await page.locator('#searchInput').inputValue(), '测试搜索');
        assert.equal(await page.locator('#searchEngineDropdown').isVisible(), false);
    }
});

test('快速切换引擎时取消旧请求，迟到的同词同引擎结果不会覆盖新结果', async t => {
    const { page } = await openPage(t);
    await page.evaluate(() => {
        const originalFetch = window.fetch.bind(window);
        window.engineTestRequests = [];
        window.fetch = (url, options) => {
            const address = new URL(url);
            const engine = address.hostname === 'api.bing.com' ? 'Bing'
                : address.hostname === 'suggestqueries.google.com' ? 'Google' : null;
            if (!engine) return originalFetch(url, options);
            const query = address.searchParams.get('query') || address.searchParams.get('q');
            return new Promise(resolve => {
                const entry = { engine, signal: options.signal, consumed: false };
                // 模拟已抵达但尚未解析完成的响应，以验证取消信号之外的版本校验。
                entry.release = phrase => resolve({ ok: true, json: async () => {
                    entry.consumed = true;
                    return [query, [phrase]];
                } });
                window.engineTestRequests.push(entry);
            });
        };
    });
    await page.locator('#searchInput').fill('相同关键词');
    await page.waitForFunction(() => window.engineTestRequests.length === 1);
    await chooseEngine(page, 'Google');
    await page.waitForFunction(() => window.engineTestRequests.length === 2);
    await chooseEngine(page, 'Bing');
    await page.waitForFunction(() => window.engineTestRequests.length === 3);
    assert.deepEqual(await page.evaluate(() => window.engineTestRequests.map(item => item.signal.aborted)), [true, true, false]);
    await page.evaluate(() => window.engineTestRequests[2].release('最新必应联想'));
    await waitForSuggestion(page, '最新必应联想');
    await page.evaluate(() => {
        window.engineTestRequests[0].release('过期必应联想');
        window.engineTestRequests[1].release('过期 Google 联想');
    });
    await page.waitForFunction(() => window.engineTestRequests.every(item => item.consumed));
    assert.deepEqual(await page.locator('.search-suggestion-item-text').allTextContents(), ['最新必应联想']);
    await page.locator('#searchInput').fill('下一个关键词');
    await page.waitForFunction(() => window.engineTestRequests.length === 4);
    await page.locator('#searchEngineBtn').click();
    await page.evaluate(() => window.engineTestRequests[3].release('菜单打开后的过期联想'));
    await page.waitForFunction(() => window.engineTestRequests[3].consumed);
    assert.equal(await page.locator('#searchEngineDropdown').isVisible(), true);
    assert.equal(await page.locator('#searchSuggestionsDropdown').isVisible(), false);
});

test('百度备用联想按 JSONP 数据解析，兼容扩展的内容安全策略', async t => {
    const { page } = await openPage(t);
    await page.route('https://www.baidu.com/sugrec?*', route => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }));
    await page.route('https://suggestion.baidu.com/su?*', route => route.fulfill({
        contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' },
        body: 'baiduSuggestionCallback({"s":["百度备用联想"]});'
    }));
    await page.locator('#searchInput').fill('百度测试');
    await chooseEngine(page, '百度');
    await waitForSuggestion(page, '百度备用联想');
});

test('无效的旧引擎设置回退到 Bing，重新选择可正常保存', async t => {
    const { page } = await openPage(t);
    await page.evaluate(() => localStorage.setItem('defaultSearchEngine', 'unknown-engine'));
    await page.reload();
    assert.equal(await page.locator('#currentEngine').textContent(), 'Bing');
    await chooseEngine(page, 'Google');
    assert.equal(await page.evaluate(() => localStorage.getItem('defaultSearchEngine')), 'Google');
});

test('窄屏触屏菜单完整可点，切换长名称时自适应宽度且保持搜索区域右侧位置', async t => {
    const { page } = await openPage(t, fixture(4), {
        viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true
    });
    await page.locator('#searchInput').fill('继续搜索');
    const trigger = page.locator('#searchEngineBtn');
    const original = await trigger.boundingBox();
    const originalInput = await page.locator('#searchInput').boundingBox();
    await trigger.tap();
    const menu = page.locator('#searchEngineDropdown');
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360);
    assert.ok(bounds.y + bounds.height <= 780);
    assert.equal(await menu.locator('.engine-option').count(), 4);
    await page.getByRole('option', { name: 'DuckDuckGo', exact: true }).tap();
    assert.equal(await page.locator('#searchInput').inputValue(), '继续搜索');
    assert.equal(await menu.isVisible(), false);
    const currentInput = await page.locator('#searchInput').boundingBox();
    assert.ok((await trigger.boundingBox()).width > original.width);
    assert.ok(currentInput.x > originalInput.x);
    assert.equal(currentInput.x + currentInput.width, originalInput.x + originalInput.width);
    assert.equal(await page.locator('#currentEngine').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await trigger.tap();
    await captureScreenshot(page, 'search-engine-mobile.png');
    await page.touchscreen.tap(345, 500);
    assert.equal(await menu.isVisible(), false);
});

test('添加和编辑共用表单，提交后保留身份并恢复操作焦点', async t => {
    const { page } = await openPage(t, fixture(2));
    const modal = page.locator('#addShortcutModal');
    await page.locator('#addShortcutBtn').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'shortcutName');
    assert.equal(await page.locator('#submitBtn').textContent(), '添加');
    assert.equal(await page.locator('#shortcutName').inputValue(), '');
    await captureScreenshot(page, 'shortcut-dialog-add.png');
    await page.locator('#shortcutName').fill('示例网站');
    await page.locator('#shortcutUrl').fill('https://new-shortcut.example/path');
    await page.locator('#submitBtn').click();
    await modal.waitFor({ state: 'hidden' });
    const added = (await saved(page)).at(-1);
    assert.equal(added.name, '示例网站');
    assert.ok(added.id);
    assert.equal(await writes(page), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'addShortcutBtn');

    await cards(page).last().hover();
    await cards(page).last().locator('.shortcut-edit').click();
    assert.equal(await page.locator('#modalTitle').textContent(), '编辑快捷方式');
    assert.equal(await page.locator('#submitBtn').textContent(), '保存');
    assert.equal(await page.locator('#shortcutUrl').inputValue(), added.url);
    await captureScreenshot(page, 'shortcut-dialog-edit.png');
    await page.locator('#shortcutName').fill('示例网站 已编辑');
    await page.locator('#submitBtn').click();
    await modal.waitFor({ state: 'hidden' });
    const edited = (await saved(page)).at(-1);
    assert.equal(edited.id, added.id);
    assert.equal(edited.name, '示例网站 已编辑');
    assert.equal(await writes(page), 2);
    assert.equal(await page.evaluate(() => document.activeElement.closest('.shortcut')?.dataset.shortcutId), added.id);
});

test('取消、关闭和点击遮罩不保存草稿，编辑取消后不会残留编辑状态', async t => {
    const { page } = await openPage(t, fixture(2));
    const initial = await saved(page);
    const modal = page.locator('#addShortcutModal');
    for (const dismiss of ['cancelShortcutBtn', 'closeModal', 'backdrop']) {
        await page.locator('#addShortcutBtn').click();
        assert.equal(await page.locator('#shortcutName').inputValue(), '');
        assert.equal(await page.locator('#shortcutUrl').inputValue(), '');
        await page.locator('#shortcutName').fill('不保存的草稿');
        await page.locator('#shortcutUrl').fill('https://draft.example/');
        if (dismiss === 'backdrop') await modal.locator('.modal-backdrop').click({ position: { x: 8, y: 8 } });
        else await page.locator(`#${dismiss}`).click();
        await modal.waitFor({ state: 'hidden' });
        assert.deepEqual(await saved(page), initial);
        assert.equal(await writes(page), 0);
    }
    await cards(page).first().hover();
    await cards(page).first().locator('.shortcut-edit').click();
    await page.locator('#shortcutName').fill('不保存的编辑');
    await page.locator('#cancelShortcutBtn').click();
    await modal.waitFor({ state: 'hidden' });
    assert.deepEqual(await saved(page), initial);
    await page.locator('#addShortcutBtn').click();
    assert.equal(await page.locator('#modalTitle').textContent(), '添加快捷方式');
    assert.equal(await page.locator('#submitBtn').textContent(), '添加');
    await page.locator('#shortcutName').fill('独立新增');
    await page.locator('#shortcutUrl').fill('https://separate.example/');
    await page.locator('#submitBtn').click();
    await modal.waitFor({ state: 'hidden' });
    assert.deepEqual((await saved(page)).slice(0, 2), initial);
    assert.equal((await saved(page)).length, 3);
});

test('窄屏和低高度表单仍能填写提交，必填及重复网址校验有效', async t => {
    const { page } = await openPage(t, fixture(2), {
        viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce'
    });
    const modal = page.locator('#addShortcutModal');
    await page.locator('#addShortcutBtn').tap();
    const bounds = await modal.locator('.modal-content').boundingBox();
    assert.ok(bounds.x >= 15 && bounds.x + bounds.width <= 345);
    await captureScreenshot(page, 'shortcut-dialog-mobile.png');
    await page.locator('#shortcutName').fill('窄屏新增');
    await page.locator('#submitBtn').tap();
    assert.equal(await page.locator('#shortcutUrl').evaluate(input => input.validity.valueMissing), true);
    assert.equal(await writes(page), 0);
    await page.locator('#shortcutUrl').fill('https://shortcut-1.example/');
    await page.locator('#submitBtn').tap();
    assert.equal(await writes(page), 0);
    assert.equal(await modal.getAttribute('aria-hidden'), 'false');
    await page.locator('#shortcutUrl').fill('https://mobile-shortcut.example/');
    await page.setViewportSize({ width: 360, height: 280 });
    const compactBounds = await modal.locator('.modal-content').boundingBox();
    assert.ok(compactBounds.y >= 15 && compactBounds.y + compactBounds.height <= 265);
    await page.locator('#submitBtn').tap();
    await modal.waitFor({ state: 'hidden' });
    assert.equal((await saved(page)).at(-1).name, '窄屏新增');
    assert.equal(await writes(page), 1);
});

const storedBackground = page => page.evaluate(() => localStorage.getItem('backgroundSettings'));
const backgroundWrites = page => page.evaluate(() => window.backgroundTestWrites);
const backgroundFrame = page => page.evaluate(() => {
    const layer = document.querySelector('.background-layer.is-active');
    return { image: layer.style.backgroundImage, color: layer.style.backgroundColor,
        filter: layer.style.filter, overlay: document.querySelector('#backgroundOverlay').style.backgroundColor,
        glass: document.body.style.getPropertyValue('--ui-glass-blur') };
});
const openSettings = async page => {
    await page.locator('#wallpaperSettingsBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#bgSettingsPanel').getAnimations().length === 0);
};
const waitForSettingsSave = page => page.waitForFunction(() => !document.querySelector('#bgApplyBtn').disabled);

async function wallpaperFixture(page) {
    const data = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 160, 90);
        gradient.addColorStop(0, '#416a75');
        gradient.addColorStop(1, '#bc8069');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 160, 90);
        return canvas.toDataURL('image/png').split(',')[1];
    });
    return { name: '示例壁纸.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test('设置实时预览保留合法零值，取消恢复原画面和原配置', async t => {
    const { page } = await openPage(t);
    const originalSettings = await storedBackground(page);
    const originalFrame = await backgroundFrame(page);
    await openSettings(page);
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
    await page.locator('#bgOverlayOpacityValue').fill('0');
    await page.locator('#bgUiGlassBlurValue').fill('12');
    await page.locator('#bgSolidColorHex').fill('#112233');
    await waitForSettingsSave(page);
    assert.equal((await backgroundFrame(page)).color, 'rgb(17, 34, 51)');
    assert.equal((await backgroundFrame(page)).overlay, 'rgba(0, 0, 0, 0)');
    assert.equal((await backgroundFrame(page)).glass, '12px');
    assert.equal(await storedBackground(page), originalSettings);
    assert.equal(await backgroundWrites(page), 0);
    await page.mouse.click(10, 500);
    assert.equal(await page.locator('#bgSettingsPanel.active').count(), 1);
    await captureScreenshot(page, 'settings-solid.png');
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.deepEqual(await backgroundFrame(page), originalFrame);
    assert.equal(await storedBackground(page), originalSettings);
    assert.equal(await backgroundWrites(page), 0);
});

test('模式控制相关选项，轮播自定义和渐变预设可保存，默认值先预览', async t => {
    const { page } = await openPage(t);
    await openSettings(page);
    assert.equal(await page.locator('#bgSolidColorRow').isVisible(), true);
    assert.equal(await page.locator('#bgRotationSection').isVisible(), false);
    await page.locator('#bgModeSelect').selectOption('local');
    await waitForSettingsSave(page);
    assert.equal(await page.locator('#bgRotationSection').isVisible(), true);
    assert.equal(await page.locator('#bgRotateIntervalRow').isVisible(), false);
    await page.locator('.bg-switch').click();
    await page.locator('#bgRotatePreset').selectOption('custom');
    await page.locator('#bgRotateInterval').fill('90');
    assert.equal(await page.locator('#bgRotateCustomRow').isVisible(), true);
    await page.locator('#bgAdvancedSettings summary').click();
    await page.locator('#bgBrightnessValue').fill('104');
    await page.locator('#bgModeSelect').selectOption('gradient');
    assert.equal(await page.locator('#bgRotationSection').isVisible(), false);
    assert.equal(await page.locator('#bgAdvancedSettings').isVisible(), false);
    await page.getByRole('button', { name: '松林', exact: true }).click();
    await waitForSettingsSave(page);
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = 0; });
    await captureScreenshot(page, 'settings-gradient.png');
    const preview = await backgroundFrame(page);
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.deepEqual(await backgroundFrame(page), preview, '保存不应再随机更换壁纸');
    const savedSettings = JSON.parse(await storedBackground(page));
    assert.equal(savedSettings.mode, 'gradient');
    assert.equal(savedSettings.rotateIntervalSec, 90);
    assert.equal(savedSettings.filters.brightness, 104);
    assert.match(savedSettings.gradientPreset, /#134e5e/);
    await page.reload();
    await openSettings(page);
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '松林', exact: true }).getAttribute('aria-pressed'), 'true');
    const beforeReset = await storedBackground(page);
    await page.locator('#bgResetBtn').click();
    await waitForSettingsSave(page);
    assert.equal(await page.locator('#bgModeSelect').inputValue(), 'mixed');
    assert.equal(await storedBackground(page), beforeReset);
    await page.locator('#bgSettingsClose').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await storedBackground(page), beforeReset);
});

test('图片滤镜不换图，固定头尾在滚动时可操作，保存失败可重试', async t => {
    const { page } = await openPage(t);
    await page.evaluate(() => localStorage.setItem('backgroundSettings', JSON.stringify({ mode: 'local', autoRotate: false })));
    await page.reload();
    await page.waitForFunction(() => window.backgroundRuntimeWrites > 0);
    let imageRequests = 0;
    page.on('request', request => { if (request.resourceType() === 'image') imageRequests++; });
    await openSettings(page);
    const originalImage = (await backgroundFrame(page)).image;
    const requestCount = imageRequests;
    const footer = await page.locator('.bg-settings-footer').boundingBox();
    const header = await page.locator('.bg-settings-header').boundingBox();
    await page.locator('#bgBlurValue').fill('4');
    await page.locator('#bgAdvancedSettings summary').click();
    await page.locator('#bgBrightnessValue').fill('110');
    await page.locator('#bgSaturateValue').fill('88');
    await waitForSettingsSave(page);
    assert.equal((await backgroundFrame(page)).image, originalImage);
    assert.match((await backgroundFrame(page)).filter, /blur\(4px\).*brightness\(110%\).*saturate\(88%\)/);
    assert.equal(imageRequests, requestCount);
    await captureScreenshot(page, 'settings-image.png');
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = form.scrollHeight; });
    assert.deepEqual(await page.locator('.bg-settings-footer').boundingBox(), footer);
    assert.deepEqual(await page.locator('.bg-settings-header').boundingBox(), header);
    const originalSettings = await storedBackground(page);
    await page.evaluate(() => { window.backgroundTestFailSave = true; });
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsMessage').waitFor({ state: 'visible' });
    assert.match(await page.locator('#bgSettingsMessage').textContent(), /保存失败/);
    assert.equal(await storedBackground(page), originalSettings);
    assert.equal(await page.locator('#bgSettingsPanel.active').count(), 1);
    await page.evaluate(() => { window.backgroundTestFailSave = false; });
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(JSON.parse(await storedBackground(page)).filters.brightness, 110);
});

test('数字和滑块互相同步，非法输入不保存，窄屏操作栏始终可见', async t => {
    const { page } = await openPage(t, fixture(2), { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    await openSettings(page);
    await page.locator('#bgUiGlassBlurValue').fill('99');
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
    await page.locator('#bgUiGlassBlur').evaluate(input => {
        input.value = '8';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await waitForSettingsSave(page);
    assert.equal(await page.locator('#bgUiGlassBlurValue').inputValue(), '8');
    await page.locator('#bgSolidColorHex').fill('abc');
    await waitForSettingsSave(page);
    assert.equal(await page.locator('#bgSolidColor').inputValue(), '#aabbcc');
    const footer = await page.locator('.bg-settings-footer').boundingBox();
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = form.scrollHeight; });
    const after = await page.locator('.bg-settings-footer').boundingBox();
    assert.deepEqual(after, footer);
    assert.ok(after.y >= 0 && after.y + after.height <= 640);
    await captureScreenshot(page, 'settings-mobile.png');
    await page.locator('#bgApplyBtn').tap();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    const savedSettings = JSON.parse(await storedBackground(page));
    assert.equal(savedSettings.uiGlassBlur, 8);
    assert.equal(savedSettings.solidColor, '#aabbcc');
});

test('图库缩略图上传和删除即时保存，取消设置不撤销图库操作并释放缩略图资源', async t => {
    const { page } = await openPage(t);
    const file = await wallpaperFixture(page);
    await page.evaluate(() => {
        window.backgroundRevokedUrls = [];
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = url => { window.backgroundRevokedUrls.push(url); revoke(url); };
    });
    await openSettings(page);
    const originalSettings = await storedBackground(page);
    await page.locator('#bgUploadInput').setInputFiles(file);
    await page.waitForFunction(() => document.querySelector('#bgUploadedList img')?.naturalWidth > 0);
    const thumbnailUrl = await page.locator('#bgUploadedList img').getAttribute('src');
    assert.match(thumbnailUrl, /^blob:/);
    assert.equal(await page.locator('#bgLibraryCount').textContent(), '1 / 30');
    assert.equal(await backgroundWrites(page), 0);
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = form.scrollHeight; });
    await captureScreenshot(page, 'settings-library.png');
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(url => window.backgroundRevokedUrls.includes(url), thumbnailUrl), true);
    await openSettings(page);
    await page.waitForFunction(() => document.querySelector('#bgUploadedList img')?.naturalWidth > 0);
    assert.equal(await page.locator('#bgLibraryCount').textContent(), '1 / 30');
    await page.locator('.bg-image-card').hover();
    await page.locator('.bg-image-delete').click();
    await page.waitForFunction(() => document.querySelector('#bgLibraryCount').textContent === '0 / 30');
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    await openSettings(page);
    await page.locator('#bgUploadInput').setInputFiles({ name: '错误文件.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
    await page.locator('.notification').filter({ hasText: '仅支持图片文件' }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#bgLibraryCount').textContent(), '0 / 30');
    assert.equal(await storedBackground(page), originalSettings);
});

test('取消预览能恢复原来的本地图片，提交新背景后才释放旧图片引用', async t => {
    const { page } = await openPage(t);
    const file = await wallpaperFixture(page);
    await page.route('**/assets/images/undifine.webp', route => route.abort());
    await page.evaluate(() => {
        window.backgroundRevokedUrls = [];
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = url => { window.backgroundRevokedUrls.push(url); revoke(url); };
    });
    await openSettings(page);
    await page.locator('#bgUploadInput').setInputFiles(file);
    await page.waitForFunction(() => document.querySelector('#bgLibraryCount').textContent === '1 / 30');
    await page.locator('#bgModeSelect').selectOption('local');
    await waitForSettingsSave(page);
    await page.waitForFunction(() => document.querySelector('.background-layer.is-active').style.backgroundImage.includes('blob:'));
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    const original = await backgroundFrame(page);
    const originalUrl = original.image.match(/url\(["']?(blob:[^"')]+)/)[1];
    await openSettings(page);
    await page.locator('#bgModeSelect').selectOption('solid');
    await page.locator('#bgSolidColorHex').fill('#334455');
    await waitForSettingsSave(page);
    assert.equal(await page.evaluate(url => window.backgroundRevokedUrls.includes(url), originalUrl), false);
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.deepEqual(await backgroundFrame(page), original);
    assert.equal(await page.evaluate(url => window.backgroundRevokedUrls.includes(url), originalUrl), false);
    await openSettings(page);
    await page.locator('#bgModeSelect').selectOption('gradient');
    await waitForSettingsSave(page);
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(url => window.backgroundRevokedUrls.includes(url), originalUrl), true);
});

test('取消和切换模式会丢弃迟到的壁纸加载，保存只采用最后的预览', async t => {
    const { page } = await openPage(t);
    const file = await wallpaperFixture(page);
    let imageSequence = 0;
    let acceptRequest;
    const blockers = [];
    await page.route('https://www.bing.com/HPImageArchive.aspx?*', route => route.fulfill({
        contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ images: [{ url: `https://www.bing.com/settings-preview-${++imageSequence}.png` }] })
    }));
    await page.route(/https:\/\/www\.bing\.com\/settings-preview-\d+\.png/, async route => {
        let release;
        let complete;
        const gate = new Promise(resolve => { release = resolve; });
        const finished = new Promise(resolve => { complete = resolve; });
        const blocker = { release, finished };
        blockers.push(blocker);
        acceptRequest(blocker);
        await gate;
        try { await route.fulfill({ contentType: 'image/png', body: file.buffer }); } catch { /* 请求可能已经取消。 */ }
        complete();
    });
    const requestedImage = () => new Promise(resolve => { acceptRequest = resolve; });
    try {
        const original = await backgroundFrame(page);
        const originalSettings = await storedBackground(page);
        await openSettings(page);
        const firstRequest = requestedImage();
        await page.locator('#bgModeSelect').selectOption('online');
        const first = await firstRequest;
        assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
        await page.locator('#bgCancelBtn').click();
        await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
        first.release();
        await first.finished;
        assert.deepEqual(await backgroundFrame(page), original);
        assert.equal(await storedBackground(page), originalSettings);
        await openSettings(page);
        const secondRequest = requestedImage();
        await page.locator('#bgModeSelect').selectOption('online');
        const second = await secondRequest;
        await page.locator('#bgModeSelect').selectOption('gradient');
        await page.getByRole('button', { name: '夜空', exact: true }).click();
        await waitForSettingsSave(page);
        const finalPreview = await backgroundFrame(page);
        await page.locator('#bgApplyBtn').click();
        await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
        second.release();
        await second.finished;
        assert.deepEqual(await backgroundFrame(page), finalPreview);
        assert.equal(JSON.parse(await storedBackground(page)).mode, 'gradient');
    } finally {
        blockers.forEach(blocker => blocker.release());
    }
});

test('预览暂停自动轮播，取消后恢复，纯色模式不会开启图片轮播', async t => {
    const { page } = await openPage(t);
    await page.clock.install();
    await page.evaluate(() => localStorage.setItem('backgroundSettings', JSON.stringify({ mode: 'local', autoRotate: true, rotateIntervalSec: 10 })));
    await page.reload();
    await page.waitForFunction(() => window.backgroundRuntimeWrites > 0);
    await openSettings(page);
    const initialWrites = await page.evaluate(() => window.backgroundRuntimeWrites);
    await page.clock.fastForward(30000);
    assert.equal(await page.evaluate(() => window.backgroundRuntimeWrites), initialWrites);
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    await page.clock.fastForward(11000);
    await page.waitForFunction(previous => window.backgroundRuntimeWrites > previous, initialWrites);
    await openSettings(page);
    await page.locator('#bgModeSelect').selectOption('solid');
    await waitForSettingsSave(page);
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    const savedWrites = await page.evaluate(() => window.backgroundRuntimeWrites);
    await page.clock.fastForward(30000);
    assert.equal(await page.evaluate(() => window.backgroundRuntimeWrites), savedWrites);
});


// 双语回归沿用同一套真实交互及存储夹具。
const englishFixture = (count = 4) => fixture(count).map((item, index) => ({ ...item, name: `Website ${index + 1}` }));
const pageLanguage = page => page.locator('html').getAttribute('lang');
const storedLanguage = page => page.evaluate(() => localStorage.getItem('interfaceLanguage'));

async function saveEnglish(page) {
    await openSettings(page);
    await page.locator('#interfaceLanguage').selectOption('en');
    await waitForSettingsSave(page);
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
}

test('英文浏览器首次仍用中文，语言预览保留输入及背景草稿，取消和关闭均回滚', async t => {
    const { page } = await openPage(t, fixture(4), { locale: 'en-US' });
    assert.equal(await pageLanguage(page), 'zh-CN');
    assert.equal(await page.title(), '让我们开始吧');
    await page.locator('#searchInput').fill('保留我的 search draft');
    await page.locator('#searchInput').evaluate(input => input.setSelectionRange(2, 6, 'backward'));
    const originalFrame = await backgroundFrame(page);
    const originalSettings = await storedBackground(page);
    const initialShortcuts = await saved(page);
    for (const close of ['#bgCancelBtn', '#bgSettingsClose']) {
        await openSettings(page);
        await page.locator('#bgOverlayOpacityValue').fill('0');
        await waitForSettingsSave(page);
        const preview = await backgroundFrame(page);
        await page.locator('#interfaceLanguage').selectOption('en');
        assert.equal(await pageLanguage(page), 'en');
        assert.equal(await page.title(), "Let's get started");
        assert.equal(await page.locator('#bgSettingsTitle').textContent(), 'Settings');
        assert.deepEqual(await page.locator('#interfaceLanguage option').allTextContents(), ['简体中文', 'English']);
        assert.equal(await page.locator('#searchInput').inputValue(), '保留我的 search draft');
        assert.deepEqual(await page.locator('#searchInput').evaluate(input => [input.selectionStart, input.selectionEnd]), [2, 6]);
        assert.deepEqual(await backgroundFrame(page), preview);
        assert.equal(await page.locator('#bgOverlayOpacityValue').inputValue(), '0');
        assert.equal(await storedLanguage(page), null);
        assert.equal(await page.evaluate(() => window.languageTestWrites), 0);
        assert.equal(await storedBackground(page), originalSettings);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('#shortcuts > .shortcut')]
            .every(node => window.shortcutTestNodes.includes(node))), true);
        await page.locator(close).click();
        await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
        assert.equal(await pageLanguage(page), 'zh-CN');
        assert.deepEqual(await backgroundFrame(page), originalFrame);
        assert.deepEqual(await saved(page), initialShortcuts);
    }
    await openSettings(page);
    await page.locator('#interfaceLanguage').selectOption('en');
    assert.equal(await page.locator('#bgApplyBtn').isEnabled(), true);
    await page.locator('#interfaceLanguage').selectOption('zh-CN');
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
});

test('英文保存后首屏和刷新保持一致，已有百度选择兼容，恢复默认先预览中文', async t => {
    const { page } = await openPage(t, englishFixture());
    await chooseEngine(page, '百度');
    await saveEnglish(page);
    assert.equal(await storedLanguage(page), 'en');
    assert.equal(await page.locator('#currentEngine').textContent(), 'Baidu');
    assert.equal(await page.locator('#searchEngineBtn').getAttribute('data-engine'), '百度');
    assert.equal(await page.evaluate(() => localStorage.getItem('defaultSearchEngine')), '百度');
    await page.addInitScript(() => {
        new PerformanceObserver(list => {
            if (list.getEntries().some(entry => entry.name === 'first-contentful-paint')) {
                window.languageAtFirstPaint = document.documentElement.lang;
            }
        }).observe({ type: 'paint', buffered: true });
    });
    await page.route('**/js/i18n/en.js', async route => {
        await new Promise(resolve => setTimeout(resolve, 180));
        await route.continue();
    });
    await page.reload();
    await page.waitForFunction(() => window.languageAtFirstPaint);
    assert.equal(await page.evaluate(() => window.languageAtFirstPaint), 'en');
    assert.equal(await page.title(), "Let's get started");
    assert.equal(await page.locator('#currentEngine').textContent(), 'Baidu');
    const original = await storedBackground(page);
    await openSettings(page);
    assert.equal(await page.locator('#interfaceLanguage').inputValue(), 'en');
    await page.locator('#bgResetBtn').click();
    await waitForSettingsSave(page);
    assert.equal(await pageLanguage(page), 'zh-CN');
    assert.equal(await storedLanguage(page), 'en');
    assert.equal(await storedBackground(page), original);
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await pageLanguage(page), 'en');
    await openSettings(page);
    await page.locator('#bgResetBtn').click();
    await waitForSettingsSave(page);
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await storedLanguage(page), 'zh-CN');
    assert.equal(await pageLanguage(page), 'zh-CN');
    assert.equal(await page.locator('#currentEngine').textContent(), '百度');
});

test('语言与背景保存失败不留下部分配置，保留预览以供重试或取消', async t => {
    const { page } = await openPage(t, englishFixture());
    const original = await storedBackground(page);
    await openSettings(page);
    await page.locator('#interfaceLanguage').selectOption('en');
    await page.locator('#bgSolidColorHex').fill('#123456');
    await waitForSettingsSave(page);
    await page.evaluate(() => { window.backgroundTestFailSave = true; });
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsMessage').waitFor({ state: 'visible' });
    assert.match(await page.locator('#bgSettingsMessage').textContent(), /Could not save/);
    assert.equal(await storedLanguage(page), null);
    assert.equal(await storedBackground(page), original);
    assert.equal(await pageLanguage(page), 'en');
    assert.equal(await page.locator('#bgSolidColorHex').inputValue(), '#123456');
    await page.evaluate(() => { window.backgroundTestFailSave = false; });
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await storedLanguage(page), 'en');
    const committed = await storedBackground(page);
    assert.equal(JSON.parse(committed).solidColor, '#123456');

    await openSettings(page);
    await page.locator('#interfaceLanguage').selectOption('zh-CN');
    await page.locator('#bgOverlayOpacityValue').fill('12');
    await waitForSettingsSave(page);
    await page.evaluate(() => { window.languageTestFailSave = true; });
    await page.locator('#bgApplyBtn').click();
    await page.locator('#bgSettingsMessage').waitFor({ state: 'visible' });
    assert.match(await page.locator('#bgSettingsMessage').textContent(), /保存失败/);
    assert.equal(await storedLanguage(page), 'en');
    assert.equal(await storedBackground(page), committed);
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await pageLanguage(page), 'en');
    assert.equal((await backgroundFrame(page)).color, 'rgb(18, 52, 86)');
});

test('英文弹窗校验、编辑和拖动撤销正常，语言切换不重置正在编辑的内容', async t => {
    const { page } = await openPage(t, englishFixture());
    await saveEnglish(page);
    await page.locator('#addShortcutBtn').click();
    assert.equal(await page.locator('#modalTitle').textContent(), 'Add shortcut');
    await page.locator('#submitBtn').click();
    assert.equal(await page.locator('#shortcutName').evaluate(input => input.validationMessage), 'Enter a website name.');
    await page.locator('#shortcutName').fill('New website');
    await page.locator('#shortcutUrl').fill('https://shortcut-1.example/');
    await page.locator('#submitBtn').click();
    await page.locator('.notification').filter({ hasText: 'already uses this URL' }).waitFor({ state: 'visible' });
    await page.locator('#shortcutUrl').fill('https://new-site.example/');
    await page.locator('#submitBtn').click();
    await page.locator('#addShortcutModal').waitFor({ state: 'hidden' });
    await cards(page).first().hover();
    await cards(page).first().locator('.shortcut-edit').click();
    await page.locator('#shortcutName').fill('保留编辑内容');
    // 已打开的表单也应更新文案，模拟另一处语言入口调用同一语言服务。
    await page.evaluate(async () => { (await import('/js/i18n/index.js')).setLanguage('zh-CN'); });
    assert.equal(await page.locator('#modalTitle').textContent(), '编辑快捷方式');
    assert.equal(await page.locator('#shortcutName').inputValue(), '保留编辑内容');
    await page.evaluate(async () => { (await import('/js/i18n/index.js')).setLanguage('en'); });
    assert.equal(await page.locator('#modalTitle').textContent(), 'Edit shortcut');
    assert.equal(await page.locator('#submitBtn').textContent(), 'Save');
    await page.waitForFunction(() => !document.querySelector('.notification'));
    await captureScreenshot(page, 'english-shortcut-dialog.png');
    await page.locator('#shortcutName').fill('Edited website');
    await page.locator('#submitBtn').click();
    await page.locator('#addShortcutModal').waitFor({ state: 'hidden' });
    const beforeDrag = await saved(page);
    const target = await pointAt(page, 2, 0.85);
    await startDrag(page);
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.waitForFunction(() => document.querySelectorAll('#shortcuts .shortcut-name')[2].textContent === 'Edited website');
    await page.mouse.up();
    await idle(page);
    assert.equal(await page.locator('#shortcutSortUndo span').textContent(), 'Order updated');
    assert.match(await page.locator('#shortcutSortStatus').textContent(), /Order saved/);
    await page.locator('#undoShortcutSortBtn').click();
    assert.deepEqual(await saved(page), beforeDrag);
    assert.equal(await page.locator('#shortcutSortStatus').textContent(), 'Reordering undone. Original order restored.');
});

test('英文百度使用原搜索与联想接口，历史、空状态和静态属性完整翻译', async t => {
    const { page } = await openPage(t, englishFixture());
    await saveEnglish(page);
    await page.route('https://www.baidu.com/sugrec?*', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify({ s: ['Baidu suggestion'], g: [{ q: 'Baidu suggestion' }] })
    }));
    await page.locator('#searchEngineBtn').click();
    await page.getByRole('option', { name: 'Baidu', exact: true }).click();
    await page.locator('#searchInput').fill('English query');
    await page.locator('.search-suggestion-item-text').filter({ hasText: 'Baidu suggestion' }).waitFor({ state: 'visible' });
    await page.evaluate(() => { window.open = url => { window.languageSearchUrl = url; return null; }; });
    await page.locator('#searchButton').click();
    assert.equal(await page.evaluate(() => window.languageSearchUrl), 'https://www.baidu.com/s?wd=English%20query');
    await page.locator('#searchInput').fill('');
    await page.locator('#searchInput').focus();
    assert.equal(await page.locator('.search-history-item-text').textContent(), 'English query');
    assert.equal(await page.locator('.search-history-item-delete').getAttribute('aria-label'), 'Remove search: English query');
    await page.locator('#clearHistoryBtn').click();
    assert.equal(await page.locator('.search-history-empty').textContent(), 'No search history');
    await page.locator('#shortcutSearchBtn').click();
    await page.locator('#shortcutSearchInput').fill('nothing matches');
    assert.equal(await page.locator('.shortcuts-empty').textContent(), 'No matching shortcuts');
    assert.equal(await page.locator('#shortcutSortHelpTitle').textContent(), 'Clear search to reorder');
    const untranslated = await page.evaluate(() => {
        const issues = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const parent = walker.currentNode.parentElement;
            if (parent.closest('script, style, option[lang="zh-CN"]')) continue;
            if (/\p{Script=Han}/u.test(walker.currentNode.textContent)) issues.push(walker.currentNode.textContent.trim());
        }
        document.querySelectorAll('[title], [placeholder], [aria-label]').forEach(element => {
            for (const attribute of ['title', 'placeholder', 'aria-label']) {
                const value = element.getAttribute(attribute) || '';
                if (/\p{Script=Han}/u.test(value)) issues.push(attribute + ': ' + value);
            }
        });
        return issues;
    });
    assert.deepEqual(untranslated, []);
});

test('英文导入导出提示支持数量变化，用户提供的名称和元数据原样保留', async t => {
    const { page } = await openPage(t, englishFixture(1));
    await saveEnglish(page);
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async text => { window.languageExport = JSON.parse(text); } }
        });
        window.prompt = message => {
            window.languagePrompt = message;
            return window.languageImport;
        };
        window.languageImport = JSON.stringify([{ name: '用户输入的名称', url: 'https://new.example/' }]);
    });
    await page.locator('#copyShortcutMetaBtn').click();
    await page.locator('.notification').filter({ hasText: 'Copied data for 1 shortcut.' }).waitFor({ state: 'visible' });
    await page.locator('#importShortcutMetaBtn').click();
    assert.equal(await page.evaluate(() => window.languagePrompt), 'Paste shortcut data (JSON):');
    await page.locator('.notification').filter({ hasText: 'Imported 1 new shortcut.' }).waitFor({ state: 'visible' });
    assert.equal((await saved(page)).at(-1).name, '用户输入的名称');
    await page.locator('#copyShortcutMetaBtn').click();
    await page.locator('.notification').filter({ hasText: 'Copied data for 2 shortcuts.' }).waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.languageExport.shortcuts.at(-1).name), '用户输入的名称');
    await page.evaluate(() => { window.languageImport = '{invalid'; });
    await page.locator('#importShortcutMetaBtn').click();
    await page.locator('.notification').filter({ hasText: 'not valid JSON' }).waitFor({ state: 'visible' });
});

test('图库、校验及已出现的提示随语言更新，缩略图和文件名保持原样', async t => {
    const { page } = await openPage(t, englishFixture());
    await openSettings(page);
    await page.locator('#interfaceLanguage').selectOption('en');
    await page.locator('.bg-upload-empty').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.bg-upload-empty').textContent(), 'No local images yet. Add a wallpaper you like.');
    await page.locator('#bgUploadInput').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
    const notification = page.locator('.notification').filter({ hasText: 'Only image files are supported.' });
    await notification.waitFor({ state: 'visible' });
    await page.locator('#interfaceLanguage').selectOption('zh-CN');
    await page.locator('.notification').filter({ hasText: '仅支持图片文件' }).waitFor({ state: 'visible' });
    const file = await wallpaperFixture(page);
    await page.locator('#bgUploadInput').setInputFiles(file);
    await page.waitForFunction(() => document.querySelector('#bgUploadedList img')?.naturalWidth > 0);
    const image = page.locator('#bgUploadedList img');
    const originalUrl = await image.getAttribute('src');
    await image.evaluate(element => { window.languageThumbnail = element; });
    await page.locator('#interfaceLanguage').selectOption('en');
    assert.equal(await image.getAttribute('src'), originalUrl);
    assert.equal(await image.evaluate(element => element === window.languageThumbnail), true);
    assert.equal(await page.locator('.bg-image-name').textContent(), '示例壁纸.webp');
    assert.equal(await page.locator('.bg-image-delete').getAttribute('aria-label'), 'Delete 示例壁纸.webp');
    assert.match(await page.locator('#bgUploadHint').textContent(), /Up to 8 MB per image/);
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = form.scrollHeight; });
    await page.waitForFunction(() => !document.querySelector('.notification'));
    await captureScreenshot(page, 'english-library.png');
    await page.locator('#bgSolidColorHex').fill('oops');
    assert.equal(await page.locator('#bgSolidColorHex').evaluate(input => input.validationMessage), 'Enter a valid hexadecimal color.');
    await page.locator('#interfaceLanguage').selectOption('zh-CN');
    assert.equal(await page.locator('#bgSolidColorHex').inputValue(), 'oops');
    assert.equal(await page.locator('#bgSolidColorHex').evaluate(input => input.validationMessage), '请输入有效的十六进制颜色');
    assert.equal(await page.locator('#bgApplyBtn').isDisabled(), true);
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    assert.equal(await storedLanguage(page), null);
});

test('英文设置、长引擎名称和弹窗在桌面与窄屏均可完整操作', async t => {
    const { page } = await openPage(t, englishFixture());
    await saveEnglish(page);
    await page.waitForFunction(() => !document.querySelector('.notification'));
    await openSettings(page);
    await page.locator('#bgModeSelect').selectOption('gradient');
    await page.getByRole('button', { name: 'Pine forest', exact: true }).click();
    await waitForSettingsSave(page);
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = 0; });
    await captureScreenshot(page, 'english-settings.png');
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 360, height: 640 });
    await page.locator('#searchEngineBtn').click();
    await page.getByRole('option', { name: 'DuckDuckGo', exact: true }).click();
    assert.equal(await page.locator('#currentEngine').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await page.locator('#addShortcutBtn').click();
    const modal = await page.locator('.modal-content').boundingBox();
    assert.ok(modal.x >= 0 && modal.x + modal.width <= 360);
    await page.locator('#cancelShortcutBtn').click();
    await page.locator('#addShortcutModal').waitFor({ state: 'hidden' });
    await openSettings(page);
    await page.locator('#bgModeSelect').selectOption('gradient');
    await page.getByRole('button', { name: 'Pine forest', exact: true }).click();
    await waitForSettingsSave(page);
    await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = 0; });
    await captureScreenshot(page, 'english-settings-mobile.png');
    for (const width of [360, 320]) {
        await page.setViewportSize({ width, height: 560 });
        const footer = await page.locator('.bg-settings-footer').boundingBox();
        await page.locator('#bgSettingsForm').evaluate(form => { form.scrollTop = form.scrollHeight; });
        assert.deepEqual(await page.locator('.bg-settings-footer').boundingBox(), footer);
        for (const selector of ['#bgResetBtn', '#bgCancelBtn', '#bgApplyBtn']) {
            const box = await page.locator(selector).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 560);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('#bgSettingsForm').evaluate(form => form.scrollWidth <= form.clientWidth), true);
    }
    await page.locator('#bgCancelBtn').click();
    await page.locator('#bgSettingsPanel').waitFor({ state: 'hidden' });
    await cards(page).first().hover();
    await cards(page).first().locator('.shortcut-edit').click();
    await page.locator('#shortcutName').fill('A'.repeat(60));
    await page.locator('#submitBtn').click();
    await page.locator('#addShortcutModal').waitFor({ state: 'hidden' });
    await page.locator('#addShortcutBtn').click();
    await page.locator('#shortcutName').fill('Duplicate');
    await page.locator('#shortcutUrl').fill('https://shortcut-1.example/');
    await page.locator('#submitBtn').click();
    const notification = page.locator('.notification').filter({ hasText: 'already uses this URL' });
    await notification.waitFor({ state: 'visible' });
    assert.equal(await notification.evaluate(element => element.scrollWidth <= element.clientWidth), true);
});
