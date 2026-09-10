import { BACKGROUND_MODES, PRELOAD_TIMEOUT_MS } from './config.js';
import { loadBackgroundSettings, loadRuntimeCache, saveBackgroundSettings, saveRuntimeCache } from './storage.js';
import { normalizeBackgroundSettings, backgroundSourceKey, isImageMode, sameBackgroundSettings } from './settings-model.js';
import { getLocalCandidates, getDefaultTransitionCandidates } from './sources/local-source.js';
import { getOnlineCandidates } from './sources/online-source.js';
import { preloadImage } from './preloader.js';
import { BackgroundRenderer } from './renderer.js';
import { saveCustomImage, listCustomImages, removeCustomImage, getCustomImageStats, getCustomImageBlob } from './custom-image-library.js';

function shuffle(list) {
    const result = [...list];
    for (let index = result.length - 1; index > 0; index--) {
        const target = Math.floor(Math.random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
}

export class BackgroundController {
    constructor(options = {}) {
        this.options = options;
        this.renderer = new BackgroundRenderer();
        this.settings = loadBackgroundSettings();
        this.runtimeCache = loadRuntimeCache();
        this.timerId = null;
        this.currentSignature = '';
        this.currentRenderedCandidate = null;
        this.previewState = null;
        this.requestVersion = 0;
        this.requestController = null;
        this.pendingBackground = null;
    }

    async init() {
        this.renderer.applyVisualSettings(this.settings);
        const initial = this.flatCandidate(this.settings) || getDefaultTransitionCandidates()[0];
        this.showCandidate(initial, { persist: false, immediate: true });
        if (isImageMode(this.settings.mode)) await this.nextBackground({ silent: true, initial: true });
        this.startAutoRotateIfNeeded();
    }

    getSettings() {
        return normalizeBackgroundSettings(this.settings);
    }

    effectiveSettings() {
        return this.previewState?.settings || this.settings;
    }

    getPreviewStatus() {
        const preview = this.previewState;
        return {
            pending: Boolean(this.pendingBackground),
            changed: Boolean(preview && (!sameBackgroundSettings(preview.settings, this.settings)
                || (preview.originalCandidate && this.currentSignature !== this.getCandidateSignature(preview.originalCandidate)))),
            error: preview?.error ? '暂时无法预览背景，请切换模式或稍后重试。' : ''
        };
    }

    notifyPreviewChange() {
        if (this.previewState) this.options.onPreviewChange?.();
    }

    // 编辑期间保留原壁纸引用，草稿与持久化配置完全分离。
    beginPreview() {
        if (!this.previewState) {
            this.cancelPendingBackground();
            this.stopAutoRotate();
            this.previewState = {
                settings: this.getSettings(),
                originalCandidate: this.currentRenderedCandidate,
                error: null
            };
        }
        return normalizeBackgroundSettings(this.previewState.settings);
    }

    previewSettings(patch) {
        if (!this.previewState) throw new Error('尚未开始设置预览');
        const previousKey = backgroundSourceKey(this.previewState.settings);
        this.previewState.settings = normalizeBackgroundSettings(patch, this.previewState.settings);
        this.renderer.applyVisualSettings(this.previewState.settings);
        if (previousKey !== backgroundSourceKey(this.previewState.settings)) {
            return this.nextBackground({ silent: true });
        }
        return this.pendingBackground || Promise.resolve(this.currentRenderedCandidate);
    }

    async commitPreview() {
        const preview = this.previewState;
        if (!preview) return false;
        while (this.pendingBackground) {
            await this.pendingBackground;
            if (this.previewState !== preview) return false;
        }
        if (preview.error) throw preview.error;
        // 先完成配置写入；失败时保留草稿，允许重试或取消。
        const saved = saveBackgroundSettings(preview.settings);
        this.settings = saved;
        this.previewState = null;
        if (preview.originalCandidate !== this.currentRenderedCandidate) this.releaseCandidate(preview.originalCandidate);
        this.recordSuccess(this.currentRenderedCandidate);
        this.startAutoRotateIfNeeded();
        return true;
    }

    cancelPreview() {
        const preview = this.previewState;
        if (!preview) return;
        this.cancelPendingBackground();
        this.previewState = null;
        this.renderer.applyVisualSettings(this.settings);
        // 图库删除独立生效，已经删除的原图以可用的默认背景代替。
        const original = preview.originalCandidate || this.flatCandidate(this.settings) || getDefaultTransitionCandidates()[0];
        this.showCandidate(original, { persist: false, immediate: true });
        this.startAutoRotateIfNeeded();
    }

    async addCustomImage(file) {
        return saveCustomImage(file);
    }

    async listCustomImages() {
        return listCustomImages();
    }

    async getCustomImageStats() {
        return getCustomImageStats();
    }

    async removeCustomImage(recordId) {
        await removeCustomImage(recordId);
        const refreshBackground = Boolean(this.pendingBackground) || this.currentRenderedCandidate?.id === recordId;
        if (refreshBackground) this.cancelPendingBackground();
        if (this.previewState?.originalCandidate?.id === recordId) {
            const original = this.previewState.originalCandidate;
            this.previewState.originalCandidate = null;
            if (original !== this.currentRenderedCandidate) this.releaseCandidate(original);
        }
        if (this.currentRenderedCandidate?.id === recordId) {
            const settings = this.effectiveSettings();
            this.showCandidate(this.flatCandidate(settings) || getDefaultTransitionCandidates()[0], {
                persist: !this.previewState, immediate: true
            });
        }
        if (refreshBackground && isImageMode(this.effectiveSettings().mode)) {
            this.nextBackground({ silent: true }).catch(() => this.options.onStatus?.('图片已删除，背景暂时无法更新'));
        }
    }

    flatCandidate(settings) {
        if (settings.mode === BACKGROUND_MODES.SOLID) {
            return { type: 'solid', source: 'solid', value: settings.solidColor };
        }
        if (settings.mode === BACKGROUND_MODES.GRADIENT) {
            return { type: 'gradient', source: 'gradient', value: settings.gradientPreset };
        }
        return null;
    }

    cancelPendingBackground() {
        this.requestVersion++;
        this.requestController?.abort();
        this.requestController = null;
        this.pendingBackground = null;
    }

    nextBackground({ silent = false, initial = false } = {}) {
        this.cancelPendingBackground();
        const controller = new AbortController();
        const version = this.requestVersion;
        const settings = normalizeBackgroundSettings(this.effectiveSettings());
        this.requestController = controller;
        if (this.previewState) this.previewState.error = null;
        const operation = this.loadBackground(settings, controller.signal, version, { silent, initial });
        this.pendingBackground = operation;
        this.notifyPreviewChange();
        const settle = () => {
            if (this.pendingBackground === operation) this.pendingBackground = null;
            if (this.requestController === controller) this.requestController = null;
            this.notifyPreviewChange();
        };
        operation.then(settle, settle);
        return operation;
    }

    async loadBackground(settings, signal, version, { silent, initial }) {
        try {
            const candidates = await this.buildCandidates(settings, signal);
            signal.throwIfAborted();
            const usable = candidates.filter(candidate => !this.runtimeCache.failedUrls.includes(this.candidateKey(candidate)));
            const available = usable.length ? usable : candidates;
            const ordered = settings.mode === BACKGROUND_MODES.ONLINE
                ? [...shuffle(available.filter(candidate => candidate.source !== 'local-default')),
                    ...available.filter(candidate => candidate.source === 'local-default')]
                : initial && settings.mode === BACKGROUND_MODES.LOCAL ? available : shuffle(available);
            const prioritizeDifferent = list => [
                ...list.filter(candidate => this.getCandidateSignature(candidate) !== this.currentSignature),
                ...list.filter(candidate => this.getCandidateSignature(candidate) === this.currentSignature)
            ];
            const queue = settings.mode === BACKGROUND_MODES.ONLINE
                ? [...prioritizeDifferent(ordered.filter(candidate => candidate.source !== 'local-default')),
                    ...ordered.filter(candidate => candidate.source === 'local-default')]
                : prioritizeDifferent(ordered);
            let lastError = new Error('没有可用的背景图片');
            for (const candidate of queue) {
                let ready = null;
                try {
                    ready = await this.ensureCandidateReady(candidate, signal);
                    signal.throwIfAborted();
                    if (version !== this.requestVersion) {
                        this.releaseCandidate(ready);
                        return null;
                    }
                    this.showCandidate(ready, { persist: !this.previewState, immediate: Boolean(this.previewState) });
                    if (!silent) this.options.onStatus?.('背景已更新');
                    return ready;
                } catch (error) {
                    if (ready && ready !== this.currentRenderedCandidate) this.releaseCandidate(ready);
                    if (signal.aborted || error.name === 'AbortError') throw error;
                    lastError = error;
                    if (!this.previewState) this.recordFailure(candidate);
                }
            }
            throw lastError;
        } catch (error) {
            if (signal.aborted || version !== this.requestVersion || error.name === 'AbortError') return null;
            if (this.previewState) this.previewState.error = error;
            throw error;
        }
    }

    async buildCandidates(settings, signal) {
        const flat = this.flatCandidate(settings);
        if (flat) return [flat];
        if (settings.mode === BACKGROUND_MODES.LOCAL) return getLocalCandidates();
        if (settings.mode === BACKGROUND_MODES.ONLINE) {
            return [...await getOnlineCandidates(signal), ...getDefaultTransitionCandidates()];
        }
        const [local, online] = await Promise.all([getLocalCandidates(), getOnlineCandidates(signal)]);
        return [...local, ...online];
    }

    async ensureCandidateReady(candidate, signal) {
        signal.throwIfAborted();
        if (candidate.type !== 'image') return candidate;
        let ready = candidate;
        if (candidate.source === 'custom' && !candidate.url) {
            const blob = await getCustomImageBlob(candidate.id);
            signal.throwIfAborted();
            ready = { ...candidate, url: URL.createObjectURL(blob), temporary: true };
        }
        try {
            await preloadImage(ready.url, PRELOAD_TIMEOUT_MS, signal);
            signal.throwIfAborted();
            return ready;
        } catch (error) {
            if (ready !== this.currentRenderedCandidate && ready !== this.previewState?.originalCandidate) this.releaseCandidate(ready);
            throw error;
        }
    }

    candidateKey(candidate) {
        return candidate?.cacheKey || candidate?.url || candidate?.value || '';
    }

    getCandidateSignature(candidate) {
        return candidate.type + ':' + this.candidateKey(candidate);
    }

    showCandidate(candidate, { persist = true, immediate = false } = {}) {
        this.renderer.render(candidate, { immediate });
        const previous = this.currentRenderedCandidate;
        this.currentRenderedCandidate = candidate;
        this.currentSignature = this.getCandidateSignature(candidate);
        if (previous !== candidate && previous !== this.previewState?.originalCandidate) this.releaseCandidate(previous);
        if (persist) this.recordSuccess(candidate);
    }

    recordSuccess(candidate) {
        if (!candidate) return;
        const key = this.candidateKey(candidate);
        this.runtimeCache.lastSuccessfulUrl = key;
        this.runtimeCache.failedUrls = this.runtimeCache.failedUrls.filter(item => item !== key);
        this.runtimeCache.recentHistory = [key, ...this.runtimeCache.recentHistory.filter(item => item !== key)].slice(0, 10);
        this.persistRuntimeCache();
    }

    recordFailure(candidate) {
        const key = this.candidateKey(candidate);
        this.runtimeCache.failedUrls = [key, ...this.runtimeCache.failedUrls.filter(item => item !== key)].slice(0, 20);
        this.persistRuntimeCache();
    }

    persistRuntimeCache() {
        try {
            this.runtimeCache = saveRuntimeCache(this.runtimeCache);
        } catch (error) {
            // 缓存失败不应把已经显示的壁纸或已保存的配置判为失败。
            console.warn('保存背景运行缓存失败:', error);
        }
    }

    releaseCandidate(candidate) {
        if (candidate?.temporary && candidate.url) {
            URL.revokeObjectURL(candidate.url);
            candidate.temporary = false;
        }
    }

    stopAutoRotate() {
        clearInterval(this.timerId);
        this.timerId = null;
    }

    startAutoRotateIfNeeded() {
        this.stopAutoRotate();
        if (this.previewState || !this.settings.autoRotate || !isImageMode(this.settings.mode)) return;
        this.timerId = setInterval(() => {
            this.nextBackground({ silent: true }).catch(error => console.error('自动轮播切换失败:', error));
        }, this.settings.rotateIntervalSec * 1000);
    }

    destroy() {
        this.cancelPendingBackground();
        this.stopAutoRotate();
        if (this.previewState?.originalCandidate !== this.currentRenderedCandidate) this.releaseCandidate(this.previewState?.originalCandidate);
        this.releaseCandidate(this.currentRenderedCandidate);
        this.previewState = null;
        this.currentRenderedCandidate = null;
    }
}

