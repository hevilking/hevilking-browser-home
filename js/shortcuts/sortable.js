import { findDropIndex, getEdgeScrollSpeed } from './sort-geometry.js';

const DRAG_DISTANCE = 8;
const TOUCH_DELAY = 250;
const ANIMATION_DURATION = 180;

// 拖动模块只管理预览顺序，数据保存和撤销由调用方负责。
export function createShortcutSorter({ container, isEnabled, onCommit, onStateChange, announce }) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pending = null;
    let session = null;
    let landing = null;
    let frameId = 0;
    let suppressedClick = null;

    const getItems = () => Array.from(container.children).filter(item => item.matches('.shortcut'));
    const getIds = () => getItems().map(item => item.dataset.shortcutId);
    const duration = () => reducedMotion.matches ? 0 : ANIMATION_DURATION;

    function refresh() {
        const items = getItems();
        items.forEach((item, index) => {
            item.setAttribute('aria-posinset', index + 1);
            item.setAttribute('aria-setsize', items.length);
        });
    }

    function clearPending() {
        if (pending) clearTimeout(pending.timer);
        pending = null;
    }

    // 使用真实布局计算落点，动画仅影响绘制，避免让位中的卡片反复抢占落点。
    function measureSlots() {
        return getItems().map(item => ({
            left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight
        }));
    }

    function animateLayout(change, skipItem) {
        const items = getItems();
        const before = new Map(items.map(item => [item, item.getBoundingClientRect()]));
        items.forEach(item => item.getAnimations().forEach(animation => animation.cancel()));
        change();
        if (!duration()) return;

        items.forEach(item => {
            if (item === skipItem || !item.isConnected) return;
            const after = item.getBoundingClientRect();
            const previous = before.get(item);
            const x = previous.left - after.left;
            const y = previous.top - after.top;
            if (Math.abs(x) + Math.abs(y) < 1) return;
            item.animate([
                { transform: `translate(${x}px, ${y}px)` },
                { transform: 'translate(0, 0)' }
            ], { duration: duration(), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
        });
    }

    function moveTo(index) {
        if (!session || index === session.index) return;
        const current = session;
        animateLayout(() => {
            const others = getItems().filter(item => item !== current.item);
            container.insertBefore(current.item, others[index] || null);
        }, current.item);
        current.index = index;
        refresh();
        announce('sort.position', { name: current.name, position: index + 1, count: current.originalItems.length });
    }

    function start(item, pointer) {
        if (session || !isEnabled() || getItems().length < 2) return false;
        landing?.cleanup();
        clearPending();
        const originalItems = getItems();
        container.classList.add('is-sorting');
        originalItems.forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
        const rect = item.getBoundingClientRect();
        session = {
            item, originalItems, index: originalItems.indexOf(item),
            name: item.querySelector('.shortcut-name').textContent,
            slots: measureSlots(), scrollTop: container.scrollTop,
            inside: true, lastFrame: performance.now(),
            ...pointer
        };

        const preview = item.cloneNode(true);
        preview.classList.add('shortcut-drag-preview');
        preview.removeAttribute('role');
        preview.removeAttribute('aria-posinset');
        preview.removeAttribute('aria-setsize');
        preview.removeAttribute('data-shortcut-id');
        preview.setAttribute('aria-hidden', 'true');
        preview.inert = true;
        preview.querySelectorAll('button').forEach(button => button.remove());
        preview.style.width = `${rect.width}px`;
        preview.style.height = `${rect.height}px`;
        session.preview = preview;
        session.offsetX = pointer.startX - rect.left;
        session.offsetY = pointer.startY - rect.top;
        item.classList.add('shortcut-sort-source');
        document.body.appendChild(preview);
        document.body.classList.add('is-shortcut-dragging');
        try {
            container.setPointerCapture(pointer.pointerId);
        } catch {
            // 指针可能在长按计时结束的同一帧抬起，后续取消事件会清理状态。
        }
        updatePointer(performance.now(), false);
        frameId = requestAnimationFrame(tick);

        onStateChange({ active: true, inside: true });
        announce('sort.pickedUp', { name: session.name, position: session.index + 1, count: originalItems.length });
        return true;
    }

    function updatePointer(time, scroll = true) {
        const current = session;
        if (!current) return false;
        const rect = container.getBoundingClientRect();
        const inside = current.x >= rect.left && current.x <= rect.right
            && current.y >= rect.top && current.y <= rect.bottom;
        const scale = reducedMotion.matches ? 1 : 1.03;
        current.preview.style.transform = `translate3d(${current.x - current.offsetX * scale}px, ${
            current.y - current.offsetY * scale}px, 0) scale(${scale})`;
        current.preview.classList.toggle('is-outside', !inside);

        if (inside !== current.inside) {
            current.inside = inside;
            onStateChange({ active: true, inside });
        }
        const elapsed = Math.min(time - current.lastFrame, 32) / 1000;
        current.lastFrame = time;
        if (!inside) return false;

        if (scroll) {
            container.scrollTop += getEdgeScrollSpeed(current.y, rect.top, rect.bottom) * elapsed;
        }
        const point = {
            x: current.x - rect.left + container.scrollLeft - container.clientLeft,
            y: current.y - rect.top + container.scrollTop - container.clientTop
        };
        moveTo(findDropIndex(current.slots, point, current.index));
        return true;
    }

    function tick(time) {
        if (!session) return;
        updatePointer(time);
        frameId = requestAnimationFrame(tick);
    }

    function finish(commit, animate = true) {
        clearPending();
        if (!session) {
            landing?.cleanup();
            return;
        }
        const current = session;
        cancelAnimationFrame(frameId);
        const ids = getIds();
        const previousIds = current.originalItems.map(item => item.dataset.shortcutId);
        const changed = ids.some((id, index) => id !== previousIds[index]);
        const accepted = commit && (!changed || onCommit(ids, previousIds, current.item.dataset.shortcutId));

        if (!accepted) {
            animateLayout(() => current.originalItems.forEach(item => container.appendChild(item)),
                current.item);
            container.scrollTop = current.scrollTop;
        }
        refresh();
        session = null;

        suppressedClick = { x: current.x, y: current.y, until: performance.now() + 500 };
        if (container.hasPointerCapture(current.pointerId)) {
            container.releasePointerCapture(current.pointerId);
        }

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            current.preview.remove();
            current.item.classList.remove('shortcut-sort-source');
            container.classList.remove('is-sorting');
            document.body.classList.remove('is-shortcut-dragging');
            landing = null;
            onStateChange({ active: false });
        };
        landing = { cleanup };
        if (animate && duration()) {
            const rect = current.item.getBoundingClientRect();
            const animation = current.preview.animate([
                { transform: current.preview.style.transform },
                { transform: `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1)` }
            ], { duration: duration(), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
            animation.finished.then(cleanup, cleanup);
        } else {
            cleanup();
        }

        if (current.pointerType === 'touch') {
            current.item.querySelector('.shortcut-link').focus({ preventScroll: true });
        }
        announce(accepted ? (changed ? 'sort.placed' : 'sort.unchanged') : 'sort.cancelled', { name: current.name });
    }

    function onPointerDown(event) {
        if (!event.isPrimary || event.button !== 0 || session || landing || !isEnabled()) return;
        const item = event.target.closest('.shortcut');
        if (!item || !container.contains(item) || event.target.closest('button, input, textarea, select')) return;
        if (getItems().length < 2) return;
        clearPending();
        pending = {
            item, pointerId: event.pointerId, pointerType: event.pointerType,
            startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY
        };
        if (event.pointerType === 'touch') {
            pending.timer = setTimeout(() => {
                if (pending) start(pending.item, { ...pending });
            }, TOUCH_DELAY);
        }
    }

    function onPointerMove(event) {
        if (session && event.pointerId === session.pointerId) {
            event.preventDefault();
            session.x = event.clientX;
            session.y = event.clientY;
            return;
        }
        if (!pending || event.pointerId !== pending.pointerId) return;
        pending.x = event.clientX;
        pending.y = event.clientY;
        if (Math.hypot(pending.x - pending.startX, pending.y - pending.startY) < DRAG_DISTANCE) return;

        if (pending.pointerType === 'touch') {
            // 长按成立前允许原生滑动，避免为了整理图标而牺牲列表滚动。
            clearPending();
        } else if (start(pending.item, { ...pending })) {
            event.preventDefault();
        }
    }

    function onPointerUp(event) {
        if (pending?.pointerId === event.pointerId) clearPending();
        if (!session || event.pointerId !== session.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        finish(updatePointer(performance.now(), false));
    }

    function onPointerCancel(event) {
        if (pending?.pointerId === event.pointerId) clearPending();
        if (session?.pointerId === event.pointerId) finish(false);
    }

    // 新的指针操作开始时清理上一轮拖动，避免遗留占位或浮层。
    document.addEventListener('pointerdown', () => {
        suppressedClick = null;
        if (session || landing) finish(false, false);
        else clearPending();
    }, true);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('dragstart', event => event.preventDefault());
    container.addEventListener('lostpointercapture', onPointerCancel);
    container.addEventListener('contextmenu', event => {
        if (pending?.pointerType === 'touch' || session?.pointerType === 'touch') event.preventDefault();
    });
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('click', event => {
        if (!suppressedClick || event.detail === 0 || performance.now() > suppressedClick.until) return;
        if (Math.hypot(event.clientX - suppressedClick.x, event.clientY - suppressedClick.y) > 12) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressedClick = null;
    }, true);
    document.addEventListener('touchmove', event => {
        if (session?.pointerType === 'touch' && event.touches.length === 1) event.preventDefault();
    }, { passive: false });
    document.addEventListener('touchstart', event => {
        if (event.touches.length > 1) finish(false, false);
    }, { passive: true });
    window.addEventListener('blur', () => finish(false, false));
    window.addEventListener('resize', () => finish(false, false));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) finish(false, false);
    });

    refresh();
    return { cancel: () => finish(false, false), refresh };
}
