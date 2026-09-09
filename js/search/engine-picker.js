// 管理下拉选择和焦点，搜索地址与持久化由调用方处理。
export function createSearchEnginePicker({ container, trigger, menu, input, onOpen, onSelect }) {
    const options = Array.from(menu.querySelectorAll('.engine-option'));
    let inputSelection = null;

    function close(restoreTriggerFocus = false) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreTriggerFocus) trigger.focus({ preventScroll: true });
    }

    function focusOption(option) {
        options.forEach(item => { item.tabIndex = item === option ? 0 : -1; });
        option.focus({ preventScroll: true });
        option.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function open() {
        inputSelection = {
            value: input.value, start: input.selectionStart, end: input.selectionEnd,
            direction: input.selectionDirection
        };
        onOpen();
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        focusOption(options.find(option => option.getAttribute('aria-selected') === 'true') || options[0]);
    }

    trigger.addEventListener('click', () => {
        if (menu.hidden) open();
        else close();
    });
    menu.addEventListener('click', event => {
        const option = event.target.closest('.engine-option');
        if (!option || !menu.contains(option)) return;
        const selection = inputSelection;
        onSelect(option);
        close();
        input.focus({ preventScroll: true });
        if (selection && input.value === selection.value) {
            input.setSelectionRange(selection.start, selection.end, selection.direction);
        }
    });

    // 保持选择列表的标准焦点行为，不在界面增加额外的操作提示。
    container.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            event.preventDefault();
            close(true);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        if (menu.hidden) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                open();
            }
            return;
        }
        event.preventDefault();
        const current = options.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        focusOption(options[index]);
    });
    document.addEventListener('pointerdown', event => {
        if (!container.contains(event.target)) close();
    }, true);
    document.addEventListener('focusin', event => {
        if (!container.contains(event.target)) close();
    });
    window.addEventListener('blur', () => close());
    window.addEventListener('resize', () => close());

    return { close, isOpen: () => !menu.hidden };
}
