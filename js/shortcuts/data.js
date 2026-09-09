// 为旧数据和导入数据补齐稳定标识，避免过滤、重排后使用错误的数组下标。
export function ensureShortcutIds(items, createId = () => crypto.randomUUID()) {
    const usedIds = new Set();

    return items.filter(item => item && typeof item.name === 'string' && typeof item.url === 'string')
        .map(item => {
            let id = typeof item.id === 'string' ? item.id.trim() : '';
            while (!id || usedIds.has(id)) {
                id = createId();
            }
            usedIds.add(id);
            return { ...item, id };
        });
}

// 只接受完整且无重复的顺序，防止过期的拖动或撤销覆盖已经增删的列表。
export function orderShortcuts(items, ids) {
    if (items.length !== ids.length || new Set(ids).size !== ids.length) {
        return null;
    }

    const byId = new Map(items.map(item => [item.id, item]));
    if (byId.size !== items.length || ids.some(id => !byId.has(id))) {
        return null;
    }
    return ids.map(id => byId.get(id));
}
