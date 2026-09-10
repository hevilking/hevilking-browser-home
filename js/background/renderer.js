import { isImageMode } from './settings-model.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class BackgroundRenderer {
    constructor() {
        this.layerA = document.getElementById('backgroundLayerA');
        this.layerB = document.getElementById('backgroundLayerB');
        this.overlay = document.getElementById('backgroundOverlay');
        this.activeLayer = this.layerA;
        this.inactiveLayer = this.layerB;
    }

    ensureReady() {
        if (!this.layerA || !this.layerB || !this.overlay) {
            throw new Error('背景渲染节点不存在');
        }
    }

    applyVisualSettings(settings) {
        this.ensureReady();
        const filters = settings.filters || {};
        const blur = clamp(Number(filters.blur || 0), 0, 20);
        const brightness = clamp(Number(filters.brightness ?? 100), 60, 140);
        const saturate = clamp(Number(filters.saturate ?? 100), 50, 180);
        const contrast = clamp(Number(filters.contrast ?? 100), 50, 150);
        const overlayOpacity = clamp(Number(settings.overlayOpacity ?? 30), 0, 70);
        const uiGlassBlur = clamp(Number(settings.uiGlassBlur ?? 5), 0, 30);

        const filter = isImageMode(settings.mode)
            ? `blur(${blur}px) brightness(${brightness}%) saturate(${saturate}%) contrast(${contrast}%)` : 'none';
        this.layerA.style.filter = filter;
        this.layerB.style.filter = filter;
        this.overlay.style.backgroundColor = `rgba(0, 0, 0, ${overlayOpacity / 100})`;
        document.body.style.setProperty('--ui-glass-blur', `${uiGlassBlur}px`);
    }

    render(candidate, { immediate = false } = {}) {
        this.ensureReady();
        if (!candidate) {
            return;
        }

        if (immediate) {
            this.layerA.style.transition = 'none';
            this.layerB.style.transition = 'none';
        }
        this.inactiveLayer.classList.remove('is-active');
        this.inactiveLayer.style.backgroundImage = '';
        this.inactiveLayer.style.background = '';

        if (candidate.type === 'image') {
            this.inactiveLayer.style.backgroundImage = `url("${candidate.url}")`;
        } else if (candidate.type === 'gradient') {
            this.inactiveLayer.style.background = candidate.value;
        } else if (candidate.type === 'solid') {
            this.inactiveLayer.style.background = candidate.value;
        }

        this.activeLayer.classList.remove('is-active');
        this.inactiveLayer.classList.add('is-active');

        const prev = this.activeLayer;
        this.activeLayer = this.inactiveLayer;
        this.inactiveLayer = prev;

        if (immediate) {
            // 预览直接到达目标画面，避免连续调色时反复淡入淡出。
            void this.layerA.offsetWidth;
            this.layerA.style.removeProperty('transition');
            this.layerB.style.removeProperty('transition');
        }
    }
}

