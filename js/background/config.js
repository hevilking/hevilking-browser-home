export const BACKGROUND_SETTINGS_VERSION = 1;

export const BACKGROUND_SETTINGS_KEY = 'backgroundSettings';
export const BACKGROUND_RUNTIME_CACHE_KEY = 'backgroundRuntimeCache';

export const BACKGROUND_MODES = {
    MIXED: 'mixed',
    LOCAL: 'local',
    ONLINE: 'online',
    GRADIENT: 'gradient',
    SOLID: 'solid'
};

export const DEFAULT_TRANSITION_WALLPAPERS = [
    'assets/images/default.webp',
    'assets/images/undifine.webp'
];

export const LOCAL_WALLPAPERS = [...DEFAULT_TRANSITION_WALLPAPERS];

export const DEFAULT_BACKGROUND_SETTINGS = {
    version: BACKGROUND_SETTINGS_VERSION,
    mode: BACKGROUND_MODES.MIXED,
    autoRotate: false,
    rotateIntervalSec: 180,
    overlayOpacity: 32,
    filters: {
        blur: 0,
        brightness: 98,
        saturate: 105,
        contrast: 100
    },
    sourcePolicy: {
        onlineEnabled: true,
        localEnabled: true,
        fallbackOrder: ['local', 'bing', 'picsum']
    },
    uiGlassBlur: 5,
    gradientPreset: 'linear-gradient(135deg, #2b5876, #4e4376)',
    solidColor: '#1f2937'
};

export const DEFAULT_RUNTIME_CACHE = {
    lastSuccessfulUrl: '',
    failedUrls: [],
    recentHistory: []
};

export const BACKGROUND_TRANSITION_MS = 800;
export const PRELOAD_TIMEOUT_MS = 7000;
export const CUSTOM_IMAGE_MAX_COUNT = 30;
export const CUSTOM_IMAGE_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const CUSTOM_IMAGE_MAX_TOTAL_BYTES = 80 * 1024 * 1024;

