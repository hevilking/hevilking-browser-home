import { initBackgroundSystem } from './background/index.js';

// DOM元素
const wallpaperSwitch = document.getElementById('wallpaperSwitch');
const wallpaperSettingsBtn = document.getElementById('wallpaperSettingsBtn');
const bgSettingsPanel = document.getElementById('bgSettingsPanel');
const bgSettingsClose = document.getElementById('bgSettingsClose');
const bgModeSelect = document.getElementById('bgModeSelect');
const bgAutoRotate = document.getElementById('bgAutoRotate');
const bgRotateInterval = document.getElementById('bgRotateInterval');
const bgRotateIntervalValue = document.getElementById('bgRotateIntervalValue');
const bgOverlayOpacity = document.getElementById('bgOverlayOpacity');
const bgOverlayOpacityValue = document.getElementById('bgOverlayOpacityValue');
const bgUiGlassBlur = document.getElementById('bgUiGlassBlur');
const bgUiGlassBlurValue = document.getElementById('bgUiGlassBlurValue');
const bgBlur = document.getElementById('bgBlur');
const bgBlurValue = document.getElementById('bgBlurValue');
const bgBrightness = document.getElementById('bgBrightness');
const bgBrightnessValue = document.getElementById('bgBrightnessValue');
const bgSaturate = document.getElementById('bgSaturate');
const bgSaturateValue = document.getElementById('bgSaturateValue');
const bgContrast = document.getElementById('bgContrast');
const bgContrastValue = document.getElementById('bgContrastValue');
const bgSolidColor = document.getElementById('bgSolidColor');
const bgSolidColorRow = document.getElementById('bgSolidColorRow');
const bgUploadInput = document.getElementById('bgUploadInput');
const bgUploadHint = document.getElementById('bgUploadHint');
const bgUploadedList = document.getElementById('bgUploadedList');
const bgResetBtn = document.getElementById('bgResetBtn');
const bgApplyBtn = document.getElementById('bgApplyBtn');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const shortcuts = document.getElementById('shortcuts');
const addShortcutBtn = document.getElementById('addShortcutBtn');
const dragHintBtn = document.getElementById('dragHintBtn');
const copyShortcutMetaBtn = document.getElementById('copyShortcutMetaBtn');
const importShortcutMetaBtn = document.getElementById('importShortcutMetaBtn');
const shortcutSearchBtn = document.getElementById('shortcutSearchBtn');
const shortcutSearchWrapper = document.getElementById('shortcutSearchWrapper');
const shortcutSearchInput = document.getElementById('shortcutSearchInput');
const addShortcutModal = document.getElementById('addShortcutModal');
const closeModal = document.getElementById('closeModal');
const shortcutForm = document.getElementById('shortcutForm');
const shortcutName = document.getElementById('shortcutName');
const shortcutUrl = document.getElementById('shortcutUrl');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');

// 搜索引擎选择弹窗元素
const searchEngineBtn = document.getElementById('searchEngineBtn');
const currentEngine = document.getElementById('currentEngine');
const searchEngineModal = document.getElementById('searchEngineModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeSearchModal = document.getElementById('closeSearchModal');
let engineOptions;

// 搜索历史记录相关元素
const searchHistorySwitch = document.getElementById('searchHistorySwitch');
const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
const searchHistoryList = document.getElementById('searchHistoryList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const searchSuggestionsDropdown = document.getElementById('searchSuggestionsDropdown');
const searchSuggestionsList = document.getElementById('searchSuggestionsList');

// 当前选中的搜索引擎URL
let currentSearchEngineUrl = 'https://cn.bing.com/search?q=';

// 搜索历史记录相关变量
const MAX_SEARCH_HISTORY = 6; // 搜索历史上限
let searchHistoryEnabled = localStorage.getItem('searchHistoryEnabled') !== 'false';
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let hideSearchHistoryTimeout = null;
let searchDropdownMode = 'hidden';
let searchSuggestionDebounceTimer = null;
let searchSuggestionRequestController = null;
let activeSuggestionIndex = -1;
let searchSuggestions = [];

const SEARCH_SUGGESTION_DEBOUNCE = 180;
const MAX_SEARCH_SUGGESTIONS = 8;
const SHORTCUT_META_VERSION = 1;
const FAVICON_CACHE_KEY = 'shortcutFaviconCacheV2';
const FAVICON_CACHE_SUCCESS_TTL = 7 * 24 * 60 * 60 * 1000;
const FAVICON_CACHE_FAILURE_TTL = 24 * 60 * 60 * 1000;
let faviconCacheState = null;

// 快捷方式搜索相关
const SHORTCUT_SEARCH_AUTO_COLLAPSE_MS = 5000;
let allShortcuts = [];
let shortcutSearchCollapseTimer = null;

const SEARCH_SUGGESTION_APIS = {
    Bing: (query) => [
        `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`,
        `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&language=zh-cn`
    ],
    Google: (query) => [
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
    ],
    百度: (query) => [
        `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(query)}`,
        `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=baiduSuggestionCallback`
    ],
    DuckDuckGo: (query) => [
        `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`
    ]
};
const DEFAULT_SEARCH_ENGINE = 'Bing';
const SEARCH_ENGINE_STORAGE_KEY = 'defaultSearchEngine';

// 编辑模式相关变量
let editingIndex = -1;
let backgroundController = null;

// 默认快捷方式
const defaultShortcuts = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Bilibili', url: 'https://www.bilibili.com' },
];



// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    engineOptions = document.querySelectorAll('.engine-option');
    initSearchEngine();
    loadShortcuts();
    initSearchHistory();
    setupEventListeners();
    initBackgroundEngine();
});

function initSearchEngine() {
    const savedEngineName = localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY) || DEFAULT_SEARCH_ENGINE;
    const savedEngineOption = Array.from(engineOptions).find(option => option.getAttribute('data-engine') === savedEngineName);
    const fallbackEngineOption = Array.from(engineOptions).find(option => option.getAttribute('data-engine') === DEFAULT_SEARCH_ENGINE);
    const selectedOption = savedEngineOption || fallbackEngineOption;

    if (selectedOption) {
        selectSearchEngine(selectedOption, { closeModalAfterSelect: false, showNotificationAfterSelect: false });
        return;
    }

    currentEngine.textContent = DEFAULT_SEARCH_ENGINE;
    searchEngineBtn.setAttribute('data-engine', DEFAULT_SEARCH_ENGINE);
}

// 设置随机壁纸
async function setRandomWallpaper() {
    if (!backgroundController) {
        return;
    }
    showNotification('正在寻觅新的风景...');
    try {
        await backgroundController.nextBackground({ silent: true });
    } catch (error) {
        console.error('切换背景失败:', error);
        showNotification('网络如梦，暂留素雅');
    }
}

// 设置默认壁纸
function setDefaultWallpaper() {
    if (!backgroundController) {
        return;
    }
    backgroundController.updateSettings({ mode: 'local' }).catch((error) => {
        console.error('恢复默认背景失败:', error);
    });
}

// 设置事件监听器
function setupEventListeners() {
    wallpaperSwitch.addEventListener('click', setRandomWallpaper);
    wallpaperSettingsBtn.addEventListener('click', openBackgroundSettingsPanel);
    bgSettingsClose.addEventListener('click', closeBackgroundSettingsPanel);
    bgApplyBtn.addEventListener('click', applyBackgroundSettings);
    bgResetBtn.addEventListener('click', resetBackgroundSettings);
    bgUploadInput.addEventListener('change', handleBackgroundUpload);
    bgUploadedList.addEventListener('click', handleUploadedListClick);
    bgModeSelect.addEventListener('change', toggleSolidColorVisibility);
    bgRotateInterval.addEventListener('input', () => updateRangeLabel(bgRotateIntervalValue, bgRotateInterval.value, 's'));
    bgOverlayOpacity.addEventListener('input', () => updateRangeLabel(bgOverlayOpacityValue, bgOverlayOpacity.value, '%'));
    bgUiGlassBlur.addEventListener('input', () => updateRangeLabel(bgUiGlassBlurValue, bgUiGlassBlur.value, 'px'));
    bgBlur.addEventListener('input', () => updateRangeLabel(bgBlurValue, bgBlur.value, 'px'));
    bgBrightness.addEventListener('input', () => updateRangeLabel(bgBrightnessValue, bgBrightness.value, '%'));
    bgSaturate.addEventListener('input', () => updateRangeLabel(bgSaturateValue, bgSaturate.value, '%'));
    bgContrast.addEventListener('input', () => updateRangeLabel(bgContrastValue, bgContrast.value, '%'));
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('input', handleSearchInputChange);
    searchInput.addEventListener('keydown', handleSearchInputKeydown);
    
    searchHistorySwitch.addEventListener('change', toggleSearchHistory);
    
    searchInput.addEventListener('focus', updateSearchDropdownMode);
    searchInput.addEventListener('blur', function() {
        hideSearchHistoryTimeout = setTimeout(hideSearchDropdown, 300);
    });
    
    searchHistoryDropdown.addEventListener('mouseenter', clearHideSearchDropdownTimeout);
    searchSuggestionsDropdown.addEventListener('mouseenter', clearHideSearchDropdownTimeout);
    
    searchHistoryDropdown.addEventListener('mouseleave', function() {
        setTimeout(() => {
            if (document.activeElement !== searchInput) {
                hideSearchHistoryTimeout = setTimeout(hideSearchDropdown, 300);
            }
        }, 50);
    });

    searchSuggestionsDropdown.addEventListener('mouseleave', function() {
        setTimeout(() => {
            if (document.activeElement !== searchInput) {
                hideSearchHistoryTimeout = setTimeout(hideSearchDropdown, 300);
            }
        }, 50);
    });
    
    searchHistoryDropdown.addEventListener('mousedown', function(e) {
        if (e.target.closest('.search-history-item') || e.target.closest('.search-history-item-delete')) {
            e.preventDefault();
        }
    });

    searchSuggestionsDropdown.addEventListener('mousedown', function(e) {
        if (e.target.closest('.search-suggestion-item')) {
            e.preventDefault();
        }
    });
    
    searchHistoryDropdown.addEventListener('click', function(e) {
        if (e.target.closest('.search-history-item')) {
            setTimeout(() => searchInput.focus(), 0);
        } else if (e.target.closest('.search-history-item-delete')) {
            setTimeout(() => searchInput.focus(), 0);
        }
    });

    searchSuggestionsDropdown.addEventListener('click', function(e) {
        const suggestionItem = e.target.closest('.search-suggestion-item');
        if (!suggestionItem) {
            return;
        }

        const term = suggestionItem.dataset.term;
        if (!term) {
            return;
        }

        searchInput.value = term;
        performSearch();
        setTimeout(() => searchInput.focus(), 0);
    });
    
    clearHistoryBtn.addEventListener('click', clearSearchHistory);
    
    searchEngineBtn.addEventListener('click', openSearchEngineModal);
    
    closeSearchModal.addEventListener('click', closeSearchEngineModal);
    modalBackdrop.addEventListener('click', closeSearchEngineModal);
    
    engineOptions.forEach(option => {
        option.addEventListener('click', function() {
            selectSearchEngine(this);
        });
    });
    
    addShortcutBtn.addEventListener('click', () => {
        addShortcutModal.classList.add('active');
    });
    dragHintBtn.addEventListener('click', () => {
        showNotification('拖拽快捷方式到目标卡片上可以重新排序');
    });
    copyShortcutMetaBtn.addEventListener('click', copyShortcutsMetadata);
    importShortcutMetaBtn.addEventListener('click', importShortcutsMetadata);

    // 快捷方式搜索
    shortcutSearchBtn.addEventListener('click', toggleShortcutSearch);
    shortcutSearchInput.addEventListener('input', handleShortcutSearchInput);
    shortcutSearchInput.addEventListener('focus', () => {
        if (shortcutSearchCollapseTimer) {
            clearTimeout(shortcutSearchCollapseTimer);
            shortcutSearchCollapseTimer = null;
        }
    });
    shortcutSearchInput.addEventListener('blur', () => {
        if (!shortcutSearchInput.value.trim()) {
            startShortcutSearchCollapseTimer();
        }
    });
    
    closeModal.addEventListener('click', () => {
        addShortcutModal.classList.remove('active');
        shortcutForm.reset();
        editingIndex = -1;
        modalTitle.textContent = '添加快捷方式';
        submitBtn.textContent = '添加快捷方式';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === addShortcutModal) {
            addShortcutModal.classList.remove('active');
            shortcutForm.reset();
            editingIndex = -1;
            modalTitle.textContent = '添加快捷方式';
            submitBtn.textContent = '添加快捷方式';
        }

        if (!bgSettingsPanel.contains(e.target) && !wallpaperSettingsBtn.contains(e.target)) {
            closeBackgroundSettingsPanel();
        }
    });
    
    shortcutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (editingIndex >= 0) {
            saveEditedShortcut();
        } else {
            addShortcut();
        }
    });
}

function initBackgroundEngine() {
    backgroundController = initBackgroundSystem({
        onStatus: (message) => showNotification(message)
    });

    backgroundController.init().then(() => {
        syncBackgroundSettingsPanel();
    }).catch((error) => {
        console.error('初始化背景系统失败:', error);
    });
}

function openBackgroundSettingsPanel() {
    syncBackgroundSettingsPanel();
    renderUploadedBackgroundList();
    bgSettingsPanel.classList.add('active');
    bgSettingsPanel.setAttribute('aria-hidden', 'false');
}

function closeBackgroundSettingsPanel() {
    bgSettingsPanel.classList.remove('active');
    bgSettingsPanel.setAttribute('aria-hidden', 'true');
}

function updateRangeLabel(valueElement, value, suffix = '') {
    valueElement.textContent = `${value}${suffix}`;
}

function syncBackgroundSettingsPanel() {
    if (!backgroundController) {
        return;
    }

    const settings = backgroundController.getSettings();
    bgModeSelect.value = settings.mode;
    bgAutoRotate.checked = settings.autoRotate;
    bgRotateInterval.value = settings.rotateIntervalSec;
    bgOverlayOpacity.value = settings.overlayOpacity;
    bgUiGlassBlur.value = settings.uiGlassBlur ?? 5;
    bgBlur.value = settings.filters.blur;
    bgBrightness.value = settings.filters.brightness;
    bgSaturate.value = settings.filters.saturate;
    bgContrast.value = settings.filters.contrast;
    bgSolidColor.value = settings.solidColor || '#1f2937';

    updateRangeLabel(bgRotateIntervalValue, bgRotateInterval.value, 's');
    updateRangeLabel(bgOverlayOpacityValue, bgOverlayOpacity.value, '%');
    updateRangeLabel(bgUiGlassBlurValue, bgUiGlassBlur.value, 'px');
    updateRangeLabel(bgBlurValue, bgBlur.value, 'px');
    updateRangeLabel(bgBrightnessValue, bgBrightness.value, '%');
    updateRangeLabel(bgSaturateValue, bgSaturate.value, '%');
    updateRangeLabel(bgContrastValue, bgContrast.value, '%');
    toggleSolidColorVisibility();
}

function toggleSolidColorVisibility() {
    if (bgModeSelect.value === 'solid') {
        bgSolidColorRow.style.display = '';
        return;
    }
    bgSolidColorRow.style.display = 'none';
}

async function applyBackgroundSettings() {
    if (!backgroundController) {
        return;
    }

    const patch = {
        mode: bgModeSelect.value,
        autoRotate: bgAutoRotate.checked,
        rotateIntervalSec: Number(bgRotateInterval.value),
        overlayOpacity: Number(bgOverlayOpacity.value),
        uiGlassBlur: Number(bgUiGlassBlur.value),
        solidColor: bgSolidColor.value,
        filters: {
            blur: Number(bgBlur.value),
            brightness: Number(bgBrightness.value),
            saturate: Number(bgSaturate.value),
            contrast: Number(bgContrast.value)
        }
    };

    try {
        await backgroundController.updateSettings(patch);
        if (patch.mode === 'solid' || patch.mode === 'gradient') {
            await backgroundController.nextBackground({ silent: true });
        }
        showNotification('背景设置已应用');
        closeBackgroundSettingsPanel();
    } catch (error) {
        console.error('应用背景设置失败:', error);
        showNotification('背景设置应用失败');
    }
}

async function resetBackgroundSettings() {
    if (!backgroundController) {
        return;
    }

    try {
        await backgroundController.resetSettings();
        syncBackgroundSettingsPanel();
        showNotification('已恢复默认背景设置');
    } catch (error) {
        console.error('恢复默认背景设置失败:', error);
        showNotification('恢复默认设置失败');
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes}B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function renderUploadedBackgroundList() {
    if (!backgroundController) {
        return;
    }

    try {
        const [items, stats] = await Promise.all([
            backgroundController.listCustomImages(),
            backgroundController.getCustomImageStats()
        ]);

        bgUploadHint.textContent = `单图上限 8MB，总上限 80MB，最多 30 张。已用 ${items.length}/30（${formatBytes(stats.totalBytes)}）`;
        bgUploadedList.innerHTML = '';

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'bg-upload-empty';
            empty.textContent = '暂无上传图片';
            bgUploadedList.appendChild(empty);
            return;
        }

        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'bg-upload-item';
            row.dataset.id = item.id;

            const name = document.createElement('div');
            name.className = 'bg-upload-item-name';
            name.textContent = `${item.name} (${formatBytes(item.size)})`;

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'bg-upload-item-delete';
            delBtn.dataset.action = 'delete';
            delBtn.dataset.id = item.id;
            delBtn.textContent = '删除';

            row.appendChild(name);
            row.appendChild(delBtn);
            bgUploadedList.appendChild(row);
        });
    } catch (error) {
        console.error('读取上传背景列表失败:', error);
        bgUploadHint.textContent = '读取本地图片库失败';
    }
}

async function handleBackgroundUpload(e) {
    if (!backgroundController) {
        return;
    }

    const file = e.target.files && e.target.files[0];
    if (!file) {
        return;
    }

    try {
        await backgroundController.addCustomImage(file);
        await renderUploadedBackgroundList();
        if (bgModeSelect.value === 'local' || bgModeSelect.value === 'mixed') {
            await backgroundController.nextBackground({ silent: true });
        }
        showNotification('背景图片已保存到本地');
    } catch (error) {
        console.error('上传背景图片失败:', error);
        showNotification(error.message || '上传失败');
    } finally {
        bgUploadInput.value = '';
    }
}

async function handleUploadedListClick(e) {
    const button = e.target.closest('button[data-action="delete"]');
    if (!button || !backgroundController) {
        return;
    }

    const imageId = button.dataset.id;
    if (!imageId) {
        return;
    }

    try {
        await backgroundController.removeCustomImage(imageId);
        await renderUploadedBackgroundList();
        showNotification('已删除本地背景');
    } catch (error) {
        console.error('删除本地背景失败:', error);
        showNotification('删除失败');
    }
}

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function getSavedShortcuts() {
    const raw = localStorage.getItem('shortcuts');
    if (!raw) {
        return [...defaultShortcuts];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...defaultShortcuts];
    } catch (error) {
        return [...defaultShortcuts];
    }
}

function normalizeShortcutUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
        return '';
    }

    const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return formatted;
}

// 检查快捷方式列表中是否已存在相同URL，返回重复项（编辑时排除自身索引）
function findDuplicateByUrl(shortcutsList, url, excludeIndex = -1) {
    const normalized = normalizeShortcutUrl(url);
    if (!normalized) return null;

    try {
        const targetUrl = new URL(normalized);
        const targetKey = `${targetUrl.hostname}${targetUrl.pathname.replace(/\/+$/, '')}`;

        return shortcutsList.find((item, index) => {
            if (index === excludeIndex) return false;
            try {
                const itemUrl = new URL(normalizeShortcutUrl(item.url));
                const itemKey = `${itemUrl.hostname}${itemUrl.pathname.replace(/\/+$/, '')}`;
                return itemKey === targetKey;
            } catch {
                return false;
            }
        });
    } catch {
        return null;
    }
}

function normalizeShortcutItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const name = String(item.name || '').trim();
    const normalizedUrl = normalizeShortcutUrl(item.url);

    if (!name || !normalizedUrl) {
        return null;
    }

    try {
        const parsed = new URL(normalizedUrl);
        if (!/^https?:$/.test(parsed.protocol)) {
            return null;
        }
        return {
            name: name.slice(0, 60),
            url: parsed.toString()
        };
    } catch (error) {
        return null;
    }
}

function buildShortcutsMetadata() {
    return {
        version: SHORTCUT_META_VERSION,
        exportedAt: new Date().toISOString(),
        shortcuts: getSavedShortcuts().map((item) => ({
            name: item.name,
            url: item.url
        }))
    };
}

function parseShortcutsMetadata(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error('元数据不是有效 JSON');
    }

    const rawShortcuts = Array.isArray(parsed) ? parsed : parsed && parsed.shortcuts;
    if (!Array.isArray(rawShortcuts)) {
        throw new Error('元数据格式错误：需要 shortcuts 数组');
    }

    const normalized = rawShortcuts
        .map(normalizeShortcutItem)
        .filter(Boolean);

    if (normalized.length === 0) {
        throw new Error('元数据中没有可导入的快捷方式');
    }

    return normalized;
}

async function copyShortcutsMetadata() {
    const metadata = buildShortcutsMetadata();
    const text = JSON.stringify(metadata, null, 2);

    try {
        await navigator.clipboard.writeText(text);
        showNotification(`已复制 ${metadata.shortcuts.length} 个快捷方式元数据`);
    } catch (error) {
        window.prompt('复制失败，请手动复制下方元数据：', text);
        showNotification('剪贴板不可用，已改为手动复制');
    }
}

function importShortcutsMetadata() {
    const input = window.prompt('请粘贴快捷方式元数据（JSON）');
    if (!input || !input.trim()) {
        return;
    }

    let importedShortcuts;
    try {
        importedShortcuts = parseShortcutsMetadata(input.trim());
    } catch (error) {
        showNotification(error.message || '元数据格式校验失败');
        return;
    }

    const current = getSavedShortcuts();
    const merged = [...current];
    let skipped = 0;

    importedShortcuts.forEach((item) => {
        // URL重复检测（复用统一的归一化比较逻辑）
        if (findDuplicateByUrl(current, item.url)) {
            skipped++;
            return;
        }
        if (findDuplicateByUrl(merged, item.url)) {
            skipped++;
            return;
        }
        merged.push(item);
    });

    saveAndRenderShortcuts(merged);
    const added = merged.length - current.length;
    showNotification(added > 0
        ? `导入完成，新增 ${added} 个快捷方式`
        : `导入完成，${skipped} 个快捷方式已存在，无新增`);
}

// 执行搜索
function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        if (searchHistoryEnabled) {
            addSearchHistory(searchTerm);
        }
        
        const searchUrl = currentSearchEngineUrl + encodeURIComponent(searchTerm);
        window.open(searchUrl, '_blank');
        searchInput.value = '';
        clearSuggestions();
        updateSearchDropdownMode();
    }
}

function clearHideSearchDropdownTimeout() {
    if (hideSearchHistoryTimeout) {
        clearTimeout(hideSearchHistoryTimeout);
        hideSearchHistoryTimeout = null;
    }
}

function clearSuggestions() {
    activeSuggestionIndex = -1;
    searchSuggestions = [];
    searchSuggestionsList.innerHTML = '';
}

function hideAllSearchDropdowns() {
    searchHistoryDropdown.classList.remove('active');
    searchSuggestionsDropdown.classList.remove('active');
    searchDropdownMode = 'hidden';
}

function switchSearchDropdownMode(mode) {
    searchDropdownMode = mode;

    if (mode === 'history') {
        searchSuggestionsDropdown.classList.remove('active');
        searchHistoryDropdown.classList.add('active');
        return;
    }

    if (mode === 'suggestions') {
        searchHistoryDropdown.classList.remove('active');
        searchSuggestionsDropdown.classList.add('active');
        return;
    }

    hideAllSearchDropdowns();
}

function hideSearchDropdown() {
    clearHideSearchDropdownTimeout();

    if (document.activeElement !== searchInput) {
        hideAllSearchDropdowns();
    }
}

function handleSearchInputChange() {
    updateSearchDropdownMode();
}

function handleSearchInputKeydown(e) {
    if (searchDropdownMode !== 'suggestions' || !searchSuggestionsDropdown.classList.contains('active')) {
        if (e.key === 'Enter') {
            performSearch();
        } else if (e.key === 'Escape') {
            hideAllSearchDropdowns();
        }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (searchSuggestions.length === 0) {
            return;
        }
        activeSuggestionIndex = (activeSuggestionIndex + 1) % searchSuggestions.length;
        renderSearchSuggestions();
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (searchSuggestions.length === 0) {
            return;
        }
        activeSuggestionIndex = activeSuggestionIndex <= 0 ? searchSuggestions.length - 1 : activeSuggestionIndex - 1;
        renderSearchSuggestions();
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && searchSuggestions[activeSuggestionIndex]) {
            searchInput.value = searchSuggestions[activeSuggestionIndex];
        }
        performSearch();
        return;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        hideAllSearchDropdowns();
    }
}

function getCurrentEngineName() {
    return searchEngineBtn.getAttribute('data-engine') || currentEngine.textContent || 'Bing';
}

function parseSuggestionData(engineName, rawData) {
    if (engineName === 'DuckDuckGo' && Array.isArray(rawData)) {
        return rawData.map(item => item && item.phrase).filter(Boolean);
    }

    if ((engineName === 'Bing' || engineName === 'Google') && Array.isArray(rawData) && Array.isArray(rawData[1])) {
        return rawData[1].filter(Boolean);
    }

    if (engineName === '百度') {
        if (rawData && typeof rawData === 'object' && Array.isArray(rawData.g)) {
            return rawData.g.map(item => item && item.q).filter(Boolean);
        }

        const responseText = typeof rawData === 'string' ? rawData : '';
        const match = responseText.match(/baiduSuggestionCallback\((.*)\);?$/);
        if (!match || !match[1]) {
            return [];
        }

        const parsed = Function(`"use strict"; return (${match[1]});`)();
        if (!parsed || !Array.isArray(parsed.s)) {
            return [];
        }

        return parsed.s.filter(Boolean);
    }

    return [];
}

async function fetchSuggestions(query) {
    const engineName = getCurrentEngineName();
    const requestBuilder = SEARCH_SUGGESTION_APIS[engineName];

    if (!requestBuilder) {
        return [];
    }

    if (searchSuggestionRequestController) {
        searchSuggestionRequestController.abort();
    }
    searchSuggestionRequestController = new AbortController();

    const candidateUrls = requestBuilder(query);
    for (const url of candidateUrls) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: searchSuggestionRequestController.signal
            });

            if (!response.ok) {
                continue;
            }

            const rawData = engineName === '百度' ? await response.text() : await response.json();
            const parsed = parseSuggestionData(engineName, rawData).slice(0, MAX_SEARCH_SUGGESTIONS);
            if (parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
        }
    }

    const historyFallback = searchHistory
        .filter(item => item.toLowerCase().includes(query.toLowerCase()))
        .slice(0, MAX_SEARCH_SUGGESTIONS);

    return historyFallback;
}

function renderSearchSuggestions() {
    searchSuggestionsList.innerHTML = '';

    if (searchSuggestions.length === 0) {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'search-suggestions-empty';
        emptyElement.textContent = '暂无联想词';
        searchSuggestionsList.appendChild(emptyElement);
        return;
    }

    searchSuggestions.forEach((term, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'search-suggestion-item';
        if (index === activeSuggestionIndex) {
            suggestionItem.classList.add('active');
        }
        suggestionItem.dataset.term = term;

        const iconElement = document.createElement('div');
        iconElement.className = 'search-suggestion-item-icon';
        iconElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
        `;

        const textElement = document.createElement('div');
        textElement.className = 'search-suggestion-item-text';
        textElement.textContent = term;

        suggestionItem.appendChild(iconElement);
        suggestionItem.appendChild(textElement);

        searchSuggestionsList.appendChild(suggestionItem);
    });

    // 键盘导航时自动滚动到当前选中项
    const activeItem = searchSuggestionsList.querySelector('.search-suggestion-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
    }
}

function fetchAndRenderSuggestions(query) {
    clearTimeout(searchSuggestionDebounceTimer);
    searchSuggestionDebounceTimer = setTimeout(async () => {
        try {
            const suggestions = await fetchSuggestions(query);

            if (document.activeElement !== searchInput || searchInput.value.trim() !== query) {
                return;
            }

            searchSuggestions = suggestions;
            activeSuggestionIndex = -1;
            renderSearchSuggestions();
            switchSearchDropdownMode('suggestions');
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            console.error('获取联想词失败:', error);
            clearSuggestions();
            renderSearchSuggestions();
            switchSearchDropdownMode('suggestions');
        }
    }, SEARCH_SUGGESTION_DEBOUNCE);
}

function updateSearchDropdownMode() {
    clearHideSearchDropdownTimeout();

    if (document.activeElement !== searchInput) {
        hideAllSearchDropdowns();
        return;
    }

    const currentQuery = searchInput.value.trim();
    if (!currentQuery) {
        clearSuggestions();
        showSearchHistory();
        return;
    }

    fetchAndRenderSuggestions(currentQuery);
}

// 打开搜索引擎选择弹窗
function openSearchEngineModal() {
    searchEngineModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 关闭搜索引擎选择弹窗
function closeSearchEngineModal() {
    searchEngineModal.classList.remove('active');
    document.body.style.overflow = '';
}

// 选择搜索引擎
function selectSearchEngine(element, options = {}) {
    const {
        closeModalAfterSelect = true,
        showNotificationAfterSelect = true
    } = options;
    const engineName = element.getAttribute('data-engine');
    const engineUrl = element.getAttribute('data-url');
    
    currentSearchEngineUrl = engineUrl;
    currentEngine.textContent = engineName;
    searchEngineBtn.setAttribute('data-engine', engineName);
    localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, engineName);
    
    engineOptions.forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
    
    if (closeModalAfterSelect) {
        closeSearchEngineModal();
    }

    if (document.activeElement === searchInput && searchInput.value.trim()) {
        fetchAndRenderSuggestions(searchInput.value.trim());
    }

    if (showNotificationAfterSelect) {
        showNotification(`已切换到 ${engineName}`);
    }
}

// 加载快捷方式
function loadShortcuts() {
    let savedShortcuts = localStorage.getItem('shortcuts');
    
    try {
        savedShortcuts = savedShortcuts ? JSON.parse(savedShortcuts) : defaultShortcuts;
    } catch (e) {
        savedShortcuts = defaultShortcuts;
    }
    
    if (!localStorage.getItem('shortcuts')) {
        localStorage.setItem('shortcuts', JSON.stringify(defaultShortcuts));
    }

    allShortcuts = savedShortcuts;
    renderShortcuts(savedShortcuts);
}

// 渲染快捷方式
function renderShortcuts(shortcutsList) {
    shortcuts.innerHTML = '';

    if (!shortcutsList || shortcutsList.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'shortcuts-empty';
        empty.textContent = '暂无快捷方式，点击右上角 + 添加';
        shortcuts.appendChild(empty);
        return;
    }
    
    shortcutsList.forEach((shortcut, index) => {
        const shortcutElement = createShortcutElement(shortcut, index);
        shortcuts.appendChild(shortcutElement);
    });
}

// 创建快捷方式元素
function createShortcutElement(shortcut, index) {
    const div = document.createElement('div');
    div.className = 'shortcut';
    div.draggable = true;
    div.dataset.index = index;
    
    const icon = document.createElement('div');
    icon.className = 'shortcut-icon';
    
    let domain = '';
    try {
        domain = new URL(shortcut.url).hostname.toLowerCase();
    } catch (e) {
    }
    
    if (!domain) {
        setFallbackIcon(icon, '', shortcut.name);
    } else {
        setFallbackIcon(icon, domain, shortcut.name);
        loadFavicon(icon, domain, shortcut.name);
    }
    
    const name = document.createElement('div');
    name.className = 'shortcut-name';
    name.textContent = shortcut.name;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shortcut-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteShortcut(index);
    });
    
    const editBtn = document.createElement('button');
    editBtn.className = 'shortcut-edit';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        editShortcut(index);
    });
    
    div.appendChild(icon);
    div.appendChild(name);
    div.appendChild(deleteBtn);
    div.appendChild(editBtn);
    
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragenter', handleDragEnter);
    div.addEventListener('dragleave', handleDragLeave);
    
    div.addEventListener('click', function(e) {
        if (e.target.closest('.shortcut').classList.contains('dragging')) {
            return;
        }
        window.open(shortcut.url, '_blank');
    });
    
    return div;
}

// 加载 favicon
function readFaviconCache() {
    if (faviconCacheState) {
        return faviconCacheState;
    }

    try {
        const raw = localStorage.getItem(FAVICON_CACHE_KEY);
        faviconCacheState = raw ? JSON.parse(raw) : {};
    } catch (error) {
        faviconCacheState = {};
    }

    return faviconCacheState;
}

function writeFaviconCache(cache) {
    faviconCacheState = cache;
    localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cache));
}

function getCachedFavicon(domain) {
    const cache = readFaviconCache();
    const item = cache[domain];
    if (!item) {
        return { hit: false, url: null };
    }

    if (!item.expiresAt || item.expiresAt < Date.now()) {
        delete cache[domain];
        writeFaviconCache(cache);
        return { hit: false, url: null };
    }

    return { hit: true, url: item.url || null };
}

function setCachedFavicon(domain, url, ttlMs) {
    const cache = readFaviconCache();
    cache[domain] = {
        url: url || null,
        expiresAt: Date.now() + ttlMs
    };
    writeFaviconCache(cache);
}

function renderIconImage(iconElement, src, name) {
    const img = document.createElement('img');
    img.alt = name || 'shortcut icon';
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'contain';
    img.src = src;
    iconElement.innerHTML = '';
    iconElement.appendChild(img);
}

function getFallbackColor(seedText) {
    let hash = 0;
    const text = seedText || 'default';
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue} 62% 45%)`;
}

function buildFallbackIconDataUrl(domain, name) {
    const source = (name || domain || '?').trim();
    const firstChar = source.charAt(0).toUpperCase();
    const color = getFallbackColor(domain || source);
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="0" y="0" width="64" height="64" rx="14" fill="${color}"/>
  <text x="32" y="42" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700">${firstChar || '?'}</text>
</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setFallbackIcon(iconElement, domain, name) {
    renderIconImage(iconElement, buildFallbackIconDataUrl(domain, name), name);
}

function buildFaviconSources(domain) {
    const cleanDomain = domain.toLowerCase().trim();
    const hostCandidates = [cleanDomain];
    if (!cleanDomain.startsWith('www.')) {
        hostCandidates.push(`www.${cleanDomain}`);
    }

    const pathCandidates = [
        '/favicon.ico',
        '/favicon.png',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png'
    ];

    const result = [];
    hostCandidates.forEach((host) => {
        pathCandidates.forEach((path) => {
            result.push(`https://${host}${path}`);
        });
    });

    return result;
}

function testFaviconSource(src, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let finished = false;
        const done = (cb) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(timerId);
            cb();
        };

        const timerId = setTimeout(() => {
            done(() => reject(new Error('图标加载超时')));
        }, timeoutMs);

        img.onload = () => {
            done(() => {
                if (img.naturalWidth > 1 && img.naturalHeight > 1) {
                    resolve(src);
                    return;
                }
                reject(new Error('图标尺寸无效'));
            });
        };
        img.onerror = () => done(() => reject(new Error('图标加载失败')));
        img.src = src;
    });
}

async function loadFavicon(iconElement, domain, name) {
    const cached = getCachedFavicon(domain);
    if (cached.hit) {
        if (cached.url) {
            renderIconImage(iconElement, cached.url, name);
        }
        return;
    }

    const sources = buildFaviconSources(domain);
    for (const src of sources) {
        try {
            const loadedSrc = await testFaviconSource(src);
            renderIconImage(iconElement, loadedSrc, name);
            setCachedFavicon(domain, loadedSrc, FAVICON_CACHE_SUCCESS_TTL);
            return;
        } catch (error) {
        }
    }

    setCachedFavicon(domain, null, FAVICON_CACHE_FAILURE_TTL);
}

// 添加快捷方式
function addShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();

    if (name && url) {
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;

        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];

        // URL重复检测
        const duplicate = findDuplicateByUrl(shortcutsList, formattedUrl);
        if (duplicate) {
            showNotification(`该网址已存在快捷方式「${duplicate.name}」`);
            return;
        }

        shortcutsList.push({ name, url: formattedUrl });

        saveAndRenderShortcuts(shortcutsList);

        addShortcutModal.classList.remove('active');
        shortcutForm.reset();
    }
}

// 编辑快捷方式
function editShortcut(index) {
    const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
    const shortcut = shortcutsList[index];
    
    if (shortcut) {
        editingIndex = index;
        
        modalTitle.textContent = '编辑快捷方式';
        submitBtn.textContent = '保存修改';
        
        shortcutName.value = shortcut.name;
        shortcutUrl.value = shortcut.url;
        
        addShortcutModal.classList.add('active');
    }
}

// 保存编辑的快捷方式
function saveEditedShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();

    if (name && url) {
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;

        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];

        // URL重复检测（排除当前正在编辑的项自身）
        const duplicate = findDuplicateByUrl(shortcutsList, formattedUrl, editingIndex);
        if (duplicate) {
            showNotification(`该网址已存在快捷方式「${duplicate.name}」`);
            return;
        }

        shortcutsList[editingIndex] = { name, url: formattedUrl };

        saveAndRenderShortcuts(shortcutsList);

        editingIndex = -1;

        addShortcutModal.classList.remove('active');
        shortcutForm.reset();

        modalTitle.textContent = '添加快捷方式';
        submitBtn.textContent = '添加快捷方式';
    }
}

// 删除快捷方式
function deleteShortcut(index) {
    const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
    
    shortcutsList.splice(index, 1);
    
    saveAndRenderShortcuts(shortcutsList);
}

// 保存快捷方式到localStorage并重新渲染
function saveAndRenderShortcuts(shortcutsList) {
    allShortcuts = shortcutsList;
    localStorage.setItem('shortcuts', JSON.stringify(shortcutsList));
    clearShortcutSearch();
    renderShortcuts(shortcutsList);
}

// 清除快捷方式搜索状态
function clearShortcutSearch() {
    if (shortcutSearchCollapseTimer) {
        clearTimeout(shortcutSearchCollapseTimer);
        shortcutSearchCollapseTimer = null;
    }
    shortcutSearchInput.value = '';
    shortcutSearchWrapper.classList.remove('active');
}

// 启动快捷方式搜索自动收回计时器
function startShortcutSearchCollapseTimer() {
    if (shortcutSearchCollapseTimer) {
        clearTimeout(shortcutSearchCollapseTimer);
    }
    shortcutSearchCollapseTimer = setTimeout(() => {
        if (!shortcutSearchInput.value.trim()) {
            clearShortcutSearch();
            renderShortcuts(allShortcuts);
        }
    }, SHORTCUT_SEARCH_AUTO_COLLAPSE_MS);
}

// 切换快捷方式搜索展开/收起
function toggleShortcutSearch() {
    if (shortcutSearchWrapper.classList.contains('active')) {
        // 收起
        clearShortcutSearch();
        renderShortcuts(allShortcuts);
    } else {
        // 展开
        shortcutSearchWrapper.classList.add('active');
        shortcutSearchInput.focus();
        startShortcutSearchCollapseTimer();
    }
}

// 处理快捷方式搜索输入
function handleShortcutSearchInput() {
    // 重置自动收回计时器
    if (shortcutSearchCollapseTimer) {
        clearTimeout(shortcutSearchCollapseTimer);
        shortcutSearchCollapseTimer = null;
    }

    const term = shortcutSearchInput.value.trim().toLowerCase();

    // 输入为空时显示全部
    if (!term) {
        renderShortcuts(allShortcuts);
        startShortcutSearchCollapseTimer();
        return;
    }

    // 模糊匹配：同时比对名称和URL
    const filtered = allShortcuts.filter((item) => {
        return item.name.toLowerCase().includes(term) || item.url.toLowerCase().includes(term);
    });

    renderShortcuts(filtered);

    // 无匹配结果时提示
    if (filtered.length === 0) {
        showNotification('未找到匹配的快捷方式');
    }
}

// 拖拽功能相关变量
let draggedElement = null;
let draggedIndex = null;
let hasDraggedBefore = localStorage.getItem('hasDraggedBefore') === 'true';

// 拖拽开始
function handleDragStart(e) {
    if (!hasDraggedBefore) {
        showNotification('拖拽到其他快捷方式上可以重新排序');
        localStorage.setItem('hasDraggedBefore', 'true');
        hasDraggedBefore = true;
    }
    
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

// 拖拽经过
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

// 拖拽进入
function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

// 拖拽离开
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

// 拖拽放置
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const dropIndex = parseInt(this.dataset.index);
        
        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
        
        const draggedShortcut = shortcutsList[draggedIndex];
        shortcutsList.splice(draggedIndex, 1);
        shortcutsList.splice(dropIndex, 0, draggedShortcut);
        
        saveAndRenderShortcuts(shortcutsList);
    }
    
    return false;
}

// 拖拽结束
function handleDragEnd(e) {
    const shortcuts = document.querySelectorAll('.shortcut');
    shortcuts.forEach(shortcut => {
        shortcut.classList.remove('dragging');
        shortcut.classList.remove('drag-over');
    });
}

// 初始化搜索历史记录
function initSearchHistory() {
    searchHistoryEnabled = localStorage.getItem('searchHistoryEnabled') !== 'false';
    searchHistorySwitch.checked = searchHistoryEnabled;
    
    initSearchHistoryEvents();
    
    renderSearchHistory();
}

// 切换搜索历史记录功能
function toggleSearchHistory() {
    searchHistoryEnabled = searchHistorySwitch.checked;
    localStorage.setItem('searchHistoryEnabled', searchHistoryEnabled);
    
    updateSearchDropdownMode();
    
    showNotification(searchHistoryEnabled ? '将记录搜索历史' : '不再记录搜索历史');
}

// 显示搜索历史记录
function showSearchHistory() {
    if (!searchHistoryEnabled || searchInput.value.trim() !== '') {
        return;
    }
    
    clearHideSearchDropdownTimeout();
    
    if (document.activeElement === searchInput) {
        switchSearchDropdownMode('history');
    }
}

// 隐藏搜索历史记录
function hideSearchHistory() {
    hideSearchDropdown();
}

// 添加搜索历史记录
function addSearchHistory(searchTerm) {
    const existingIndex = searchHistory.findIndex(item => item === searchTerm);
    
    if (existingIndex !== -1) {
        searchHistory.splice(existingIndex, 1);
    }
    
    searchHistory.unshift(searchTerm);
    
    if (searchHistory.length > MAX_SEARCH_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }
    
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    
    renderSearchHistory();
}

// 移除搜索历史记录项
function removeSearchHistory(query) {
    searchHistory = searchHistory.filter(item => item !== query);
    
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

// 清除搜索历史记录
function clearSearchHistory() {
    searchHistory = [];
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderSearchHistory();
    showNotification('搜索历史记录已清除');
}

// 渲染搜索历史记录
function renderSearchHistory() {
    searchHistoryList.innerHTML = '';
    
    if (searchHistory.length === 0) {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'search-history-empty';
        emptyElement.textContent = '暂无搜索历史';
        searchHistoryList.appendChild(emptyElement);
        return;
    }
    
    searchHistory.forEach((term, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'search-history-item';
        historyItem.dataset.term = term;
        historyItem.dataset.index = index;
        
        const iconElement = document.createElement('div');
        iconElement.className = 'search-history-item-icon';
        iconElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
        `;
        
        const textElement = document.createElement('div');
        textElement.className = 'search-history-item-text';
        textElement.textContent = term;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'search-history-item-delete';
        deleteButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        
        historyItem.addEventListener('mouseenter', function() {
            if (hideSearchHistoryTimeout) {
                clearTimeout(hideSearchHistoryTimeout);
                hideSearchHistoryTimeout = null;
            }
        });
        
        historyItem.appendChild(iconElement);
        historyItem.appendChild(textElement);
        historyItem.appendChild(deleteButton);
        
        searchHistoryList.appendChild(historyItem);
    });
}

// 初始化搜索历史记录的事件监听器
function initSearchHistoryEvents() {
    searchHistoryList.addEventListener('click', function(e) {
        const historyItem = e.target.closest('.search-history-item');
        if (!historyItem) return;
        
        const term = historyItem.dataset.term;
        const index = parseInt(historyItem.dataset.index);
        
        if (e.target.closest('.search-history-item-text')) {
            e.preventDefault();
            
            if (hideSearchHistoryTimeout) {
                clearTimeout(hideSearchHistoryTimeout);
                hideSearchHistoryTimeout = null;
            }
            
            searchInput.value = term;
            performSearch();
            
            setTimeout(() => {
                renderSearchHistory();
                updateSearchDropdownMode();
            }, 100);
        } else if (e.target.closest('.search-history-item-delete')) {
            e.stopPropagation();
            searchHistory.splice(index, 1);
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
            renderSearchHistory();
            setTimeout(() => searchInput.focus(), 0);
        }
    });
}
