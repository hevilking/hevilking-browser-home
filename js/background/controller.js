import { BACKGROUND_MODES, DEFAULT_BACKGROUND_SETTINGS, PRELOAD_TIMEOUT_MS } from './config.js';
import { loadBackgroundSettings, loadRuntimeCache, saveBackgroundSettings, saveRuntimeCache } from './storage.js';
import { getLocalCandidates, getPreferredCustomCandidate, getDefaultTransitionCandidates } from './sources/local-source.js';
import { getOnlineCandidates } from './sources/online-source.js';
import { preloadImage } from './preloader.js';
import { BackgroundRenderer } from './renderer.js';
import {
    saveCustomImage,
    listCustomImages,
    removeCustomImage,
    getCustomImageStats
} from './custom-image-library.js';

function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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
    }

    async init() {
        this.renderer.applyVisualSettings(this.settings);
        const startupCandidate = await this.resolveStartupCandidate();
        if (startupCandidate) {
            try {
                await this.ensureCandidateReady(startupCandidate);
                await this.renderer.render(startupCandidate);
                this.markSuccess(startupCandidate);
            } catch (error) {
                this.markFailure(startupCandidate);
            }
        }

        await this.nextBackground({ silent: true });
        this.startAutoRotateIfNeeded();
    }

    getSettings() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    async resetSettings() {
        const defaults = JSON.parse(JSON.stringify(DEFAULT_BACKGROUND_SETTINGS));
        this.settings = saveBackgroundSettings(defaults);
        this.renderer.applyVisualSettings(this.settings);
        this.startAutoRotateIfNeeded();
        await this.nextBackground({ silent: true });
    }

    async addCustomImage(file) {
        return saveCustomImage(file);
    }

    async listCustomImages() {
        return listCustomImages();
    }

    async removeCustomImage(recordId) {
        if (this.currentRenderedCandidate && this.currentRenderedCandidate.id === recordId) {
            this.currentRenderedCandidate = null;
            this.currentSignature = '';
        }
        await removeCustomImage(recordId);
    }

    async getCustomImageStats() {
        return getCustomImageStats();
    }

    async updateSettings(patch) {
        const previousMode = this.settings.mode;
        const merged = {
            ...this.settings,
            ...patch,
            filters: {
                ...this.settings.filters,
                ...(patch && patch.filters ? patch.filters : {})
            },
            sourcePolicy: {
                ...this.settings.sourcePolicy,
                ...(patch && patch.sourcePolicy ? patch.sourcePolicy : {})
            }
        };

        this.settings = saveBackgroundSettings(merged);
        this.renderer.applyVisualSettings(this.settings);
        this.startAutoRotateIfNeeded();

        if (patch && patch.mode && patch.mode !== previousMode) {
            await this.nextBackground({ silent: true });
        }
    }

    async nextBackground({ silent = false } = {}) {
        const candidates = await this.buildCandidates();
        if (candidates.length === 0) {
            throw new Error('没有可用的背景候选项');
        }

        const usable = candidates.filter((item) => !this.runtimeCache.failedUrls.includes(item.url || item.value));
        const prioritized = usable.length > 0 ? usable : candidates;
        const queue = shuffle(prioritized).filter((item) => this.getCandidateSignature(item) !== this.currentSignature);
        const finalQueue = queue.length > 0 ? queue : prioritized;

        let lastError = null;
        for (const candidate of finalQueue) {
            try {
                await this.ensureCandidateReady(candidate);
                await this.renderer.render(candidate);
                this.markSuccess(candidate);
                if (!silent && this.options.onStatus) {
                    this.options.onStatus('背景已更新');
                }
                return candidate;
            } catch (error) {
                lastError = error;
                this.markFailure(candidate);
            }
        }

        if (lastError) {
            throw lastError;
        }
    }

    destroy() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        if (this.currentRenderedCandidate && this.currentRenderedCandidate.temporary && this.currentRenderedCandidate.url) {
            URL.revokeObjectURL(this.currentRenderedCandidate.url);
            this.currentRenderedCandidate = null;
        }
    }

    async buildCandidates() {
        const mode = this.settings.mode || BACKGROUND_MODES.MIXED;

        if (mode === BACKGROUND_MODES.SOLID) {
            return [{ type: 'solid', source: 'solid', value: this.settings.solidColor || DEFAULT_BACKGROUND_SETTINGS.solidColor }];
        }

        if (mode === BACKGROUND_MODES.GRADIENT) {
            return [{ type: 'gradient', source: 'gradient', value: this.settings.gradientPreset || DEFAULT_BACKGROUND_SETTINGS.gradientPreset }];
        }

        if (mode === BACKGROUND_MODES.LOCAL) {
            return await getLocalCandidates();
        }

        if (mode === BACKGROUND_MODES.ONLINE) {
            return await getOnlineCandidates();
        }

        const [localCandidates, onlineCandidates] = await Promise.all([
            getLocalCandidates(),
            getOnlineCandidates()
        ]);
        return [...localCandidates, ...onlineCandidates];
    }

    async resolveStartupCandidate() {
        const mode = this.settings.mode || BACKGROUND_MODES.MIXED;

        if (mode === BACKGROUND_MODES.SOLID) {
            return { type: 'solid', source: 'solid', value: this.settings.solidColor || DEFAULT_BACKGROUND_SETTINGS.solidColor };
        }

        if (mode === BACKGROUND_MODES.GRADIENT) {
            return { type: 'gradient', source: 'gradient', value: this.settings.gradientPreset || DEFAULT_BACKGROUND_SETTINGS.gradientPreset };
        }

        if (mode === BACKGROUND_MODES.LOCAL) {
            const custom = await getPreferredCustomCandidate();
            if (custom) {
                return custom;
            }
            return this.resolveFirstAvailableDefaultTransition();
        }

        if (mode === BACKGROUND_MODES.ONLINE) {
            return this.resolveFirstAvailableDefaultTransition();
        }

        const custom = await getPreferredCustomCandidate();
        if (custom) {
            return custom;
        }
        return this.resolveFirstAvailableDefaultTransition();
    }

    async resolveFirstAvailableDefaultTransition() {
        const defaults = getDefaultTransitionCandidates();
        for (const candidate of defaults) {
            try {
                await this.ensureCandidateReady(candidate);
                return candidate;
            } catch (error) {
                this.markFailure(candidate);
            }
        }
        return null;
    }

    async ensureCandidateReady(candidate) {
        if (candidate.type !== 'image') {
            return;
        }
        await preloadImage(candidate.url, PRELOAD_TIMEOUT_MS);
    }

    getCandidateSignature(candidate) {
        return `${candidate.type}:${candidate.cacheKey || candidate.url || candidate.value || ''}`;
    }

    markSuccess(candidate) {
        if (this.currentRenderedCandidate && this.currentRenderedCandidate.temporary && this.currentRenderedCandidate.url) {
            URL.revokeObjectURL(this.currentRenderedCandidate.url);
        }
        const signature = this.getCandidateSignature(candidate);
        this.currentSignature = signature;
        const key = candidate.cacheKey || candidate.url || candidate.value || '';
        this.currentRenderedCandidate = candidate;

        this.runtimeCache.lastSuccessfulUrl = key;
        this.runtimeCache.failedUrls = this.runtimeCache.failedUrls.filter((item) => item !== key);
        this.runtimeCache.recentHistory = [key, ...this.runtimeCache.recentHistory.filter((item) => item !== key)].slice(0, 10);
        this.runtimeCache = saveRuntimeCache(this.runtimeCache);
    }

    markFailure(candidate) {
        if (candidate.temporary && candidate.url) {
            URL.revokeObjectURL(candidate.url);
        }
        const key = candidate.cacheKey || candidate.url || candidate.value || '';
        if (!key) {
            return;
        }

        this.runtimeCache.failedUrls = [key, ...this.runtimeCache.failedUrls.filter((item) => item !== key)].slice(0, 20);
        this.runtimeCache = saveRuntimeCache(this.runtimeCache);
    }

    startAutoRotateIfNeeded() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        if (!this.settings.autoRotate) {
            return;
        }

        const interval = Math.max(10, Number(this.settings.rotateIntervalSec || 300)) * 1000;
        this.timerId = setInterval(() => {
            this.nextBackground({ silent: true }).catch((error) => {
                console.error('自动轮播切换失败:', error);
            });
        }, interval);
    }
}

