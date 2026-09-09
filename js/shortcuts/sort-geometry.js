// 先按行命中，再判断卡片前后，确保末行空白不会被上一行的卡片抢占。
export function findDropIndex(slots, point, currentIndex, tolerance = 8) {
    if (!slots.length) return currentIndex;
    if (point.y < slots[0].top) return 0;
    const last = slots[slots.length - 1];
    if (point.y > last.top + last.height) return slots.length - 1;

    const rows = [];
    slots.forEach((slot, index) => {
        let row = rows[rows.length - 1];
        if (!row || Math.abs(row.top - slot.top) > 2) {
            row = { top: slot.top, center: slot.top + slot.height / 2, cells: [] };
            rows.push(row);
        }
        row.cells.push({ ...slot, index });
    });

    let row = rows.reduce((nearest, candidate) =>
        Math.abs(point.y - candidate.center) < Math.abs(point.y - nearest.center) ? candidate : nearest);
    const currentRow = rows.find(candidate => candidate.cells.some(cell => cell.index === currentIndex));
    if (currentRow && Math.abs(point.y - currentRow.center) <= Math.abs(point.y - row.center) + tolerance) {
        row = currentRow;
    }

    const target = row.cells.reduce((nearest, cell) =>
        Math.abs(point.x - cell.left - cell.width / 2) < Math.abs(point.x - nearest.left - nearest.width / 2)
            ? cell : nearest);
    if (target.index === currentIndex) return currentIndex;

    const center = target.left + target.width / 2;
    const movingForward = target.index > currentIndex;
    const after = point.x > center + (movingForward ? tolerance : -tolerance);
    const insertion = target.index + Number(after) - Number(movingForward);
    return Math.max(0, Math.min(slots.length - 1, insertion));
}

// 靠近滚动区域边缘时逐渐加速，返回每秒的滚动距离。
export function getEdgeScrollSpeed(pointerY, top, bottom, edge = 40) {
    const zone = Math.min(edge, (bottom - top) / 3);
    if (zone <= 0 || pointerY < top || pointerY > bottom) return 0;
    if (pointerY < top + zone) return -600 * (1 - (pointerY - top) / zone);
    if (pointerY > bottom - zone) return 600 * (1 - (bottom - pointerY) / zone);
    return 0;
}
