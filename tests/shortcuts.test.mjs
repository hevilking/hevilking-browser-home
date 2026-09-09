import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureShortcutIds, orderShortcuts } from '../js/shortcuts/data.js';
import { findDropIndex, getEdgeScrollSpeed } from '../js/shortcuts/sort-geometry.js';

test('旧数据补齐 ID，重复 ID 被修复，重新加载保持身份且不修改原数据', () => {
    const legacy = [{ name: 'A', url: 'https://a.test' }, { id: 'saved', name: 'B', url: 'https://b.test' },
        { id: 'saved', name: 'C', url: 'https://c.test' }];
    let sequence = 0;
    const migrated = ensureShortcutIds(legacy, () => `new-${++sequence}`);
    assert.deepEqual(migrated.map(item => item.id), ['new-1', 'saved', 'new-2']);
    assert.deepEqual(ensureShortcutIds(migrated), migrated);
    assert.equal(legacy[0].id, undefined);
});

test('排序和撤销使用稳定 ID，并保留快捷方式的最新内容', () => {
    const items = ['A', 'B', 'C', 'D'].map(id => ({ id, name: id, url: `https://${id}.test` }));
    const moved = orderShortcuts(items, ['A', 'D', 'B', 'C']);
    assert.deepEqual(moved.map(item => item.name), ['A', 'D', 'B', 'C']);
    moved[1] = { ...moved[1], name: '已编辑的 D' };
    assert.equal(orderShortcuts(moved, ['A', 'B', 'C', 'D'])[3].name, '已编辑的 D');
    assert.deepEqual(items.map(item => item.id), ['A', 'B', 'C', 'D']);
});

test('过期、重复或未知的排序不会丢失和复制快捷方式', () => {
    const items = [{ id: 'A' }, { id: 'B' }];
    for (const ids of [['A'], ['A', 'A'], ['A', 'C'], ['A', 'B', 'C']]) {
        assert.equal(orderShortcuts(items, ids), null);
    }
});

const slots = Array.from({ length: 8 }, (_, index) => ({
    left: (index % 3) * 115, top: Math.floor(index / 3) * 100, width: 100, height: 80
}));

test('同一目标的前后落点明确，交换后静止指针不会反复跳位', () => {
    assert.equal(findDropIndex(slots, { x: 250, y: 40 }, 0), 1);
    assert.equal(findDropIndex(slots, { x: 315, y: 40 }, 0), 2);
    assert.equal(findDropIndex(slots, { x: 315, y: 40 }, 2), 2);
    assert.equal(findDropIndex(slots, { x: 250, y: 40 }, 3), 2);
});

test('跨行、行间间隙、首尾和末行空白均能命中', () => {
    assert.equal(findDropIndex(slots, { x: 5, y: 140 }, 0), 2);
    assert.equal(findDropIndex(slots, { x: 5, y: 140 }, 7), 3);
    assert.equal(findDropIndex(slots, { x: 107, y: 140 }, 0), 3);
    assert.equal(findDropIndex(slots, { x: 400, y: 240 }, 0), 7);
    assert.equal(findDropIndex(slots, { x: 300, y: -1 }, 7), 0);
    assert.equal(findDropIndex(slots, { x: 0, y: 300 }, 0), 7);
});

test('边缘自动滚动速度随距离变化，离开区域立即停止', () => {
    assert.equal(getEdgeScrollSpeed(200, 100, 300), 0);
    assert.equal(getEdgeScrollSpeed(99, 100, 300), 0);
    assert.equal(getEdgeScrollSpeed(301, 100, 300), 0);
    assert.ok(getEdgeScrollSpeed(105, 100, 300) < getEdgeScrollSpeed(125, 100, 300));
    assert.ok(getEdgeScrollSpeed(295, 100, 300) > getEdgeScrollSpeed(275, 100, 300));
});
