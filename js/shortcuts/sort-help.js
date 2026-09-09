// 在悬停、聚焦或点击排序入口时按需展示操作说明。
export function createShortcutSortHelp({ trigger, popup, isSorting }) {
    const anchor = trigger.parentElement;
    let pinned = false;
    let closeTimer = null;

    function position() {
        const triggerRect = trigger.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const center = triggerRect.left + triggerRect.width / 2;
        const left = Math.max(12, Math.min(center - popup.offsetWidth / 2, window.innerWidth - popup.offsetWidth - 12));
        popup.style.left = `${left - anchorRect.left}px`;
        popup.style.setProperty('--help-pointer-x', `${center - left}px`);
    }

    function open() {
        if (isSorting()) return;
        clearTimeout(closeTimer);
        popup.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        position();
    }

    function close() {
        clearTimeout(closeTimer);
        pinned = false;
        popup.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    }

    anchor.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') open();
    });
    anchor.addEventListener('pointerleave', () => {
        // 留出跨越按钮与气泡间隙的时间，指针移入气泡后仍可继续阅读。
        closeTimer = setTimeout(() => {
            if (!pinned && !anchor.contains(document.activeElement)) close();
        }, 120);
    });
    trigger.addEventListener('focus', open);
    trigger.addEventListener('click', () => {
        if (pinned) close();
        else {
            pinned = true;
            open();
        }
    });
    document.addEventListener('pointerdown', event => {
        if (!anchor.contains(event.target)) close();
    }, true);
    document.addEventListener('focusin', event => {
        if (!anchor.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !popup.hidden) {
            event.preventDefault();
            close();
        }
    });
    window.addEventListener('blur', close);
    window.addEventListener('resize', () => { if (!popup.hidden) position(); });
    return { close };
}
