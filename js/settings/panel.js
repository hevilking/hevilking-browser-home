import { BACKGROUND_GRADIENT_PRESETS, DEFAULT_BACKGROUND_SETTINGS, CUSTOM_IMAGE_MAX_TOTAL_BYTES } from '../background/config.js';
import { normalizeBackgroundSettings, normalizeColor, isImageMode, sameBackgroundSettings } from '../background/settings-model.js';
import { getCustomImageBlob } from '../background/custom-image-library.js';
import { DEFAULT_LANGUAGE, getLanguage, setLanguage, onLanguageChange, setText, setAttributeText, t } from '../i18n/index.js';
import { saveSettingsPreferences } from './preferences.js';

// 面板维护配置草稿；图库操作独立即时保存，不参与配置的取消回滚。
export function createSettingsPanel({ controller, panel, trigger, onStatus }) {
    const find = id => panel.querySelector(`#${id}`);
    const form = find('bgSettingsForm');
    const languageSelect = find('interfaceLanguage');
    const fields = find('bgSettingsFields');
    const controls = Array.from(form.querySelectorAll('[data-setting]'));
    const closeButton = find('bgSettingsClose');
    const cancelButton = find('bgCancelBtn');
    const saveButton = find('bgApplyBtn');
    const resetButton = find('bgResetBtn');
    const badge = find('bgSettingsState');
    const message = find('bgSettingsMessage');
    const intervalPreset = find('bgRotatePreset');
    const gradientList = find('bgGradientPresets');
    const uploadInput = find('bgUploadInput');
    const uploadButton = find('bgUploadBtn');
    const gallery = find('bgUploadedList');
    const invalidControls = new Set();
    const thumbnailUrls = new Map();
    let opened = false;
    let baseline = null;
    let baselineLanguage = getLanguage();
    let draft = null;
    let busy = false;
    let libraryBusy = false;
    let saveError = '';
    let previewFrame = 0;
    let sessionVersion = 0;
    let galleryVersion = 0;

    const valueAt = path => path.startsWith('filters.') ? draft.filters[path.slice(8)] : draft[path];
    const isDirty = () => opened && (invalidControls.size > 0 || !sameBackgroundSettings(draft, baseline)
        || getLanguage() !== baselineLanguage || controller.getPreviewStatus().changed);

    function refreshState() {
        if (!opened) return;
        const state = controller.getPreviewStatus();
        const dirty = isDirty();
        badge.hidden = !dirty && !state.pending && !busy;
        setText(badge, busy ? 'settings.saving' : state.pending ? 'settings.previewing' : 'settings.unsaved');
        saveButton.disabled = busy || state.pending || Boolean(previewFrame) || !dirty || invalidControls.size > 0 || Boolean(state.error);
        resetButton.disabled = busy;
        fields.disabled = busy;
        uploadButton.disabled = libraryBusy || busy;
        gallery.querySelectorAll('button').forEach(button => { button.disabled = libraryBusy || busy; });
        const error = saveError || state.error || (invalidControls.size ? 'settings.invalid' : '');
        message.hidden = !error;
        if (error) setText(message, error);
    }

    function updateControl(control, value) {
        if (control.type === 'checkbox') control.checked = value;
        else control.value = value;
        if (control.type === 'range') {
            const fraction = (Number(control.value) - Number(control.min)) / (Number(control.max) - Number(control.min));
            control.style.setProperty('--range-fill', `${fraction * 100}%`);
        }
    }

    function renderForm() {
        invalidControls.clear();
        controls.forEach(control => {
            control.setCustomValidity('');
            updateControl(control, valueAt(control.dataset.setting));
        });
        const imageMode = isImageMode(draft.mode);
        find('bgRotationSection').hidden = !imageMode;
        find('bgImageBlurRow').hidden = !imageMode;
        find('bgAdvancedSettings').hidden = !imageMode;
        find('bgSolidColorRow').hidden = draft.mode !== 'solid';
        find('bgGradientRow').hidden = draft.mode !== 'gradient';
        find('bgRotateIntervalRow').hidden = !imageMode || !draft.autoRotate;
        const presets = ['30', '60', '180', '300', '600'];
        intervalPreset.value = presets.includes(String(draft.rotateIntervalSec)) ? String(draft.rotateIntervalSec) : 'custom';
        find('bgRotateCustomRow').hidden = intervalPreset.value !== 'custom';
        gradientList.querySelectorAll('button').forEach((button, index) => {
            button.setAttribute('aria-pressed', String(draft.gradientPreset === BACKGROUND_GRADIENT_PRESETS[index].value));
        });
        refreshState();
    }

    function queuePreview() {
        cancelAnimationFrame(previewFrame);
        previewFrame = requestAnimationFrame(() => {
            previewFrame = 0;
            if (!opened) return;
            const version = sessionVersion;
            controller.previewSettings(draft).catch(() => {
                // 控制器保留当前会话的错误，旧请求结束不会覆盖新会话的提示。
                if (opened && version === sessionVersion) refreshState();
            });
            refreshState();
        });
        refreshState();
    }

    function onControlInput(event) {
        const control = event.target;
        const path = control.dataset.setting;
        if (!path || !opened || busy) return;
        control.setCustomValidity('');
        let value = control.type === 'checkbox' ? control.checked : control.value;
        if (path === 'solidColor') {
            value = normalizeColor(value);
            if (!value) control.setCustomValidity(t('validation.color'));
        } else if (control.type === 'number' || control.type === 'range') {
            value = control.valueAsNumber;
        }
        if (!control.checkValidity()) {
            invalidControls.add(control);
            refreshState();
            return;
        }
        invalidControls.delete(control);
        saveError = '';
        if (path.startsWith('filters.')) draft.filters[path.slice(8)] = value;
        else draft[path] = value;
        draft = normalizeBackgroundSettings(draft);
        controls.filter(item => item.dataset.setting === path).forEach(item => {
            item.setCustomValidity('');
            invalidControls.delete(item);
            if (item !== control || item.type === 'range') updateControl(item, valueAt(path));
        });
        if (path === 'mode' || path === 'autoRotate') renderForm();
        queuePreview();
    }

    function open() {
        if (opened) return;
        sessionVersion++;
        busy = false;
        saveError = '';
        baseline = controller.getSettings();
        baselineLanguage = getLanguage();
        languageSelect.value = baselineLanguage;
        draft = controller.beginPreview();
        opened = true;
        panel.inert = false;
        panel.setAttribute('aria-hidden', 'false');
        panel.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
        form.scrollTop = 0;
        renderForm();
        refreshGallery();
        languageSelect.focus({ preventScroll: true });
    }

    function close({ saved = false, restoreFocus = true } = {}) {
        if (!opened) return;
        cancelAnimationFrame(previewFrame);
        previewFrame = 0;
        sessionVersion++;
        opened = false;
        busy = false;
        if (!saved) {
            controller.cancelPreview();
            setLanguage(baselineLanguage);
        }
        panel.classList.remove('active');
        if (restoreFocus || panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
        trigger.setAttribute('aria-expanded', 'false');
        galleryVersion++;
        gallery.replaceChildren();
        thumbnailUrls.forEach(url => URL.revokeObjectURL(url));
        thumbnailUrls.clear();
    }

    async function save(event) {
        event.preventDefault();
        if (!opened || busy || invalidControls.size || !form.reportValidity()) return;
        const version = sessionVersion;
        busy = true;
        saveError = '';
        cancelAnimationFrame(previewFrame);
        previewFrame = 0;
        refreshState();
        try {
            await controller.previewSettings(draft);
            if (!opened || version !== sessionVersion) return;
            if (await controller.commitPreview(settings => saveSettingsPreferences(settings, getLanguage()))) {
                close({ saved: true });
                onStatus('settings.saved');
            }
        } catch {
            if (opened && version === sessionVersion) saveError = 'settings.saveFailed';
        } finally {
            if (version === sessionVersion) {
                busy = false;
                refreshState();
            }
        }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function refreshGallery() {
        const version = ++galleryVersion;
        try {
            const [items, stats] = await Promise.all([controller.listCustomImages(), controller.getCustomImageStats()]);
            if (!opened || version !== galleryVersion) return;
            const retained = new Set(items.map(item => item.id));
            thumbnailUrls.forEach((url, id) => {
                if (!retained.has(id)) {
                    URL.revokeObjectURL(url);
                    thumbnailUrls.delete(id);
                }
            });
            find('bgLibraryCount').textContent = `${items.length} / 30`;
            setText(find('bgUploadHint'), 'gallery.capacity', { used: formatBytes(stats.totalBytes) });
            find('bgLibraryUsage').value = stats.totalBytes;
            gallery.replaceChildren();
            if (!items.length) {
                const empty = document.createElement('p');
                empty.className = 'bg-upload-empty';
                setText(empty, 'gallery.empty');
                gallery.appendChild(empty);
            }
            await Promise.all(items.map(async item => {
                const card = document.createElement('div');
                card.className = 'bg-image-card';
                card.dataset.id = item.id;
                const thumbnail = document.createElement('img');
                thumbnail.alt = item.name;
                if (!item.name) setAttributeText(thumbnail, 'alt', 'gallery.unnamed');
                thumbnail.draggable = false;
                thumbnail.loading = 'lazy';
                thumbnail.decoding = 'async';
                const name = document.createElement('span');
                name.className = 'bg-image-name';
                name.textContent = item.name;
                if (!item.name) setText(name, 'gallery.unnamed');
                name.title = `${item.name} · ${formatBytes(item.size)}`;
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'bg-image-delete';
                remove.dataset.id = item.id;
                setAttributeText(remove, 'aria-label', 'common.deleteNamed', () => ({ name: item.name || t('gallery.unnamed') }));
                remove.textContent = '×';
                remove.disabled = libraryBusy || busy;
                card.append(thumbnail, name, remove);
                gallery.appendChild(card);
                try {
                    let url = thumbnailUrls.get(item.id);
                    if (!url) {
                        const blob = await getCustomImageBlob(item.id);
                        if (!opened || version !== galleryVersion) return;
                        url = URL.createObjectURL(blob);
                        thumbnailUrls.set(item.id, url);
                    }
                    if (opened && version === galleryVersion) thumbnail.src = url;
                } catch {
                    thumbnail.remove();
                    card.classList.add('is-unavailable');
                }
            }));
        } catch {
            if (opened && version === galleryVersion) setText(find('bgUploadHint'), 'gallery.loadFailed');
        }
    }

    uploadButton.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', async () => {
        const file = uploadInput.files?.[0];
        if (!file || libraryBusy) return;
        libraryBusy = true;
        refreshState();
        try {
            await controller.addCustomImage(file);
            if (opened) await refreshGallery();
            onStatus('gallery.uploaded');
        } catch (error) {
            onStatus(error.key || 'gallery.uploadFailed', error.values);
        } finally {
            uploadInput.value = '';
            libraryBusy = false;
            refreshState();
        }
    });
    gallery.addEventListener('click', async event => {
        const button = event.target.closest('.bg-image-delete');
        if (!button || libraryBusy) return;
        libraryBusy = true;
        refreshState();
        try {
            await controller.removeCustomImage(button.dataset.id);
            if (opened) await refreshGallery();
            onStatus('gallery.deleted');
        } catch (error) {
            onStatus(error.key || 'gallery.deleteFailed', error.values);
        } finally {
            libraryBusy = false;
            refreshState();
        }
    });

    BACKGROUND_GRADIENT_PRESETS.forEach(preset => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bg-gradient-preset';
        button.style.background = preset.value;
        setText(button, preset.labelKey);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            draft.gradientPreset = preset.value;
            saveError = '';
            renderForm();
            queuePreview();
        });
        gradientList.appendChild(button);
    });
    intervalPreset.addEventListener('change', () => {
        if (intervalPreset.value === 'custom') {
            find('bgRotateCustomRow').hidden = false;
            find('bgRotateInterval').focus();
            return;
        }
        draft.rotateIntervalSec = Number(intervalPreset.value);
        renderForm();
        queuePreview();
    });
    languageSelect.addEventListener('change', () => {
        if (!opened || busy) return;
        saveError = '';
        setLanguage(languageSelect.value);
    });
    onLanguageChange(language => {
        languageSelect.value = language;
        invalidControls.forEach(control => {
            if (control.validity.customError) control.setCustomValidity(t('validation.color'));
        });
        refreshState();
    });
    trigger.addEventListener('click', () => opened ? close() : open());
    closeButton.addEventListener('click', () => close());
    cancelButton.addEventListener('click', () => close());
    form.addEventListener('input', onControlInput);
    form.addEventListener('submit', save);
    resetButton.addEventListener('click', () => {
        draft = normalizeBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
        saveError = '';
        setLanguage(DEFAULT_LANGUAGE);
        renderForm();
        queuePreview();
    });
    document.addEventListener('pointerdown', event => {
        if (opened && !panel.contains(event.target) && !trigger.contains(event.target) && !isDirty() && !busy) {
            close({ restoreFocus: false });
        }
    }, true);
    find('bgLibraryUsage').max = CUSTOM_IMAGE_MAX_TOTAL_BYTES;
    setText(find('bgUploadHint'), 'gallery.capacity', { used: '0 B' });
    return { open, close, isOpen: () => opened, isDirty, refreshState };
}
