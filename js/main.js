import { initBackgroundSystem } from './background/index.js';
import { createBackgroundSettingsPanel } from './background/settings-panel.js';
import { ensureShortcutIds, orderShortcuts } from './shortcuts/data.js';
import { createShortcutSorter } from './shortcuts/sortable.js';
import { createShortcutSortHelp } from './shortcuts/sort-help.js';
import { createSearchEnginePicker } from './search/engine-picker.js';

// DOM元素
const wallpaperSwitch = document.getElementById('wallpaperSwitch');
const wallpaperSettingsBtn = document.getElementById('wallpaperSettingsBtn');
const bgSettingsPanel = document.getElementById('bgSettingsPanel');
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
const shortcutSortFeedback = document.getElementById('shortcutSortFeedback');
const shortcutSortDescription = document.getElementById('shortcutSortDescription');
const shortcutSortHelp = document.getElementById('shortcutSortHelp');
const shortcutSortHelpTitle = document.getElementById('shortcutSortHelpTitle');
const shortcutSortHelpPointer = document.getElementById('shortcutSortHelpPointer');
const shortcutSortStatus = document.getElementById('shortcutSortStatus');
const clearShortcutSearchBtn = document.getElementById('clearShortcutSearchBtn');
const shortcutSortUndo = document.getElementById('shortcutSortUndo');
const undoShortcutSortBtn = document.getElementById('undoShortcutSortBtn');
const addShortcutModal = document.getElementById('addShortcutModal');
const closeModal = document.getElementById('closeModal');
const cancelShortcutBtn = document.getElementById('cancelShortcutBtn');
const shortcutForm = document.getElementById('shortcutForm');
const shortcutName = document.getElementById('shortcutName');
const shortcutUrl = document.getElementById('shortcutUrl');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');

// 搜索引擎下拉选择元素
const searchEnginePickerElement = document.getElementById('searchEnginePicker');
const searchEngineBtn = document.getElementById('searchEngineBtn');
const currentEngine = document.getElementById('currentEngine');
const currentEngineIcon = document.getElementById('currentEngineIcon');
const searchEngineDropdown = document.getElementById('searchEngineDropdown');
const engineOptions = Array.from(searchEngineDropdown.querySelectorAll('.engine-option'));
let searchEnginePicker = null;

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
let searchSuggestionRequestVersion = 0;
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
let shortcutSorter = null;
let shortcutSortHelpController = null;
let shortcutSortState = { active: false };
let shortcutUndoState = null;
let shortcutUndoTimer = null;

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
let editingShortcutId = null;
let backgroundController = null;
let backgroundSettingsPanel = null;

// 默认快捷方式
const defaultShortcuts = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Bilibili', url: 'https://www.bilibili.com' },
];



// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    initSearchEngine();
    loadShortcuts();
    shortcutSorter = createShortcutSorter({
        container: shortcuts,
        isEnabled: () => !shortcutSearchInput.value.trim(),
        onCommit: commitShortcutOrder,
        onStateChange: (state) => {
            shortcutSortState = state;
            if (state.active) {
                shortcutSortHelpController?.close();
                clearTimeout(shortcutSearchCollapseTimer);
                shortcutSearchCollapseTimer = null;
            } else if (shortcutSearchWrapper.classList.contains('active') && !shortcutSearchInput.value.trim()) {
                startShortcutSearchCollapseTimer();
            }
            updateShortcutSortControls();
        },
        announce: (message) => { shortcutSortStatus.textContent = message; }
    });
    initSearchHistory();
    setupEventListeners();
    initBackgroundEngine();
});

function initSearchEngine() {
    const savedEngineName = localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY) || DEFAULT_SEARCH_ENGINE;
    const selectedOption = engineOptions.find(option => option.dataset.engine === savedEngineName)
        || engineOptions.find(option => option.dataset.engine === DEFAULT_SEARCH_ENGINE);
    selectSearchEngine(selectedOption, { persist: false });
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

// 设置事件监听器
function setupEventListeners() {
    wallpaperSwitch.addEventListener('click', setRandomWallpaper);
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('input', handleSearchInputChange);
    searchInput.addEventListener('keydown', handleSearchInputKeydown);
    
    searchHistorySwitch.addEventListener('change', toggleSearchHistory);
    
    searchInput.addEventListener('focus', () => {
        searchEnginePicker?.close();
        updateSearchDropdownMode();
    });
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
    
    searchEnginePicker = createSearchEnginePicker({
        container: searchEnginePickerElement,
        trigger: searchEngineBtn,
        menu: searchEngineDropdown,
        input: searchInput,
        onOpen: () => {
            cancelSearchSuggestionRequest();
            clearHideSearchDropdownTimeout();
            clearSuggestions();
            hideAllSearchDropdowns();
        },
        onSelect: selectSearchEngine
    });
    
    addShortcutBtn.addEventListener('click', () => {
        openShortcutModal();
    });
    shortcutSortHelpController = createShortcutSortHelp({
        trigger: dragHintBtn,
        popup: shortcutSortHelp,
        isSorting: () => shortcutSortState.active
    });
    clearShortcutSearchBtn.addEventListener('click', () => {
        clearShortcutSearch();
        renderShortcuts(allShortcuts);
        shortcutSearchBtn.focus();
    });
    undoShortcutSortBtn.addEventListener('click', undoShortcutOrder);
    shortcutSortUndo.addEventListener('mouseenter', () => clearTimeout(shortcutUndoTimer));
    shortcutSortUndo.addEventListener('focusin', () => clearTimeout(shortcutUndoTimer));
    shortcutSortUndo.addEventListener('mouseleave', scheduleShortcutUndoExpiry);
    shortcutSortUndo.addEventListener('focusout', scheduleShortcutUndoExpiry);
    window.addEventListener('storage', (event) => {
        if (event.key !== 'shortcuts' && event.key !== null) return;
        shortcutSorter.cancel();
        dismissShortcutUndo();
        allShortcuts = getSavedShortcuts();
        renderVisibleShortcuts();
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
    
    closeModal.addEventListener('click', closeShortcutModal);
    cancelShortcutBtn.addEventListener('click', closeShortcutModal);
    addShortcutModal.querySelector('.modal-backdrop').addEventListener('click', closeShortcutModal);
    addShortcutModal.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        // 模态表单内循环焦点，避免移到遮罩后面的控件。
        if (event.shiftKey && document.activeElement === closeModal) {
            event.preventDefault();
            submitBtn.focus();
        } else if (!event.shiftKey && document.activeElement === submitBtn) {
            event.preventDefault();
            closeModal.focus();
        }
    });
    
    shortcutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (editingShortcutId) {
            saveEditedShortcut();
        } else {
            addShortcut();
        }
    });
}

function initBackgroundEngine() {
    backgroundController = initBackgroundSystem({
        onStatus: message => showNotification(message),
        onPreviewChange: () => backgroundSettingsPanel?.refreshState()
    });
    backgroundSettingsPanel = createBackgroundSettingsPanel({
        controller: backgroundController,
        panel: bgSettingsPanel,
        trigger: wallpaperSettingsBtn,
        onStatus: message => showNotification(message)
    });
    backgroundController.init().catch(error => {
        console.error('初始化背景系统失败:', error);
    });
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
    let items = defaultShortcuts;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
    } catch {
        // 存储内容损坏时恢复默认列表，随后补齐稳定标识。
    }
    const normalized = ensureShortcutIds(items);
    if (raw !== JSON.stringify(normalized)) {
        persistShortcuts(normalized);
    }
    return normalized;
}

function normalizeShortcutUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
        return '';
    }

    const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return formatted;
}

// 检查重复网址；编辑时按稳定标识排除当前快捷方式。
function findDuplicateByUrl(shortcutsList, url, excludeId = null) {
    const normalized = normalizeShortcutUrl(url);
    if (!normalized) return null;

    try {
        const targetUrl = new URL(normalized);
        const targetKey = `${targetUrl.hostname}${targetUrl.pathname.replace(/\/+$/, '')}`;

        return shortcutsList.find((item) => {
            if (item.id === excludeId) return false;
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

    if (!saveAndRenderShortcuts(merged)) return;
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

function cancelSearchSuggestionRequest() {
    clearTimeout(searchSuggestionDebounceTimer);
    searchSuggestionDebounceTimer = null;
    searchSuggestionRequestController?.abort();
    searchSuggestionRequestController = null;
    searchSuggestionRequestVersion++;
}

function hideAllSearchDropdowns() {
    searchHistoryDropdown.classList.remove('active');
    searchSuggestionsDropdown.classList.remove('active');
    searchDropdownMode = 'hidden';
}

function switchSearchDropdownMode(mode) {
    if (searchEnginePicker?.isOpen()) {
        hideAllSearchDropdowns();
        return;
    }
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
        let parsed = rawData;
        if (typeof rawData === 'string') {
            const responseText = rawData.trim();
            const match = responseText.match(/^baiduSuggestionCallback\(([\s\S]*)\);?$/);
            try {
                // 兼容 JSON 和 JSONP 数据，不执行响应中的代码。
                parsed = JSON.parse(match ? match[1] : responseText);
            } catch {
                return [];
            }
        }
        if (Array.isArray(parsed?.g)) return parsed.g.map(item => item?.q).filter(Boolean);
        if (Array.isArray(parsed?.s)) return parsed.s.filter(Boolean);
    }

    return [];
}

async function fetchSuggestions(query, engineName, signal) {
    const requestBuilder = SEARCH_SUGGESTION_APIS[engineName];

    if (!requestBuilder) {
        return [];
    }

    const candidateUrls = requestBuilder(query);
    for (const url of candidateUrls) {
        try {
            signal.throwIfAborted();
            const response = await fetch(url, {
                method: 'GET',
                signal
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

    signal.throwIfAborted();
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
    cancelSearchSuggestionRequest();
    const version = searchSuggestionRequestVersion;
    const engineName = getCurrentEngineName();
    const controller = new AbortController();
    searchSuggestionRequestController = controller;
    const isCurrentRequest = () => !controller.signal.aborted && version === searchSuggestionRequestVersion
        && engineName === getCurrentEngineName() && document.activeElement === searchInput
        && searchInput.value.trim() === query && !searchEnginePicker?.isOpen();

    searchSuggestionDebounceTimer = setTimeout(async () => {
        if (!isCurrentRequest()) return;
        searchSuggestionDebounceTimer = null;
        try {
            const suggestions = await fetchSuggestions(query, engineName, controller.signal);
            if (!isCurrentRequest()) return;

            searchSuggestions = suggestions;
            activeSuggestionIndex = -1;
            renderSearchSuggestions();
            switchSearchDropdownMode('suggestions');
        } catch (error) {
            if (error.name === 'AbortError' || !isCurrentRequest()) {
                return;
            }
            console.error('获取联想词失败:', error);
            clearSuggestions();
            renderSearchSuggestions();
            switchSearchDropdownMode('suggestions');
        } finally {
            if (searchSuggestionRequestController === controller) searchSuggestionRequestController = null;
        }
    }, SEARCH_SUGGESTION_DEBOUNCE);
}

function updateSearchDropdownMode() {
    clearHideSearchDropdownTimeout();

    if (document.activeElement !== searchInput) {
        cancelSearchSuggestionRequest();
        hideAllSearchDropdowns();
        return;
    }

    const currentQuery = searchInput.value.trim();
    if (!currentQuery) {
        cancelSearchSuggestionRequest();
        clearSuggestions();
        showSearchHistory();
        return;
    }

    fetchAndRenderSuggestions(currentQuery);
}

// 选择即生效；保留现有存储键，以兼容已保存的默认引擎。
function selectSearchEngine(element, { persist = true } = {}) {
    cancelSearchSuggestionRequest();
    const engineName = element.dataset.engine;
    currentSearchEngineUrl = element.dataset.url;
    currentEngine.textContent = engineName;
    currentEngineIcon.replaceChildren(element.querySelector('.engine-icon svg').cloneNode(true));
    searchEngineBtn.dataset.engine = engineName;
    searchEngineBtn.setAttribute('aria-label', `搜索引擎：${engineName}`);
    searchEngineBtn.title = engineName;
    engineOptions.forEach(option => {
        option.setAttribute('aria-selected', String(option === element));
        option.tabIndex = option === element ? 0 : -1;
    });
    if (persist) {
        try {
            localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, engineName);
        } catch {
            showNotification('搜索引擎已切换，但暂时无法保存默认设置');
        }
    }
}

// 加载快捷方式
function loadShortcuts() {
    allShortcuts = getSavedShortcuts();
    renderShortcuts(allShortcuts);
}

// 按标识复用卡片，保留图标、滚动位置以及未变化卡片的焦点。
function renderShortcuts(shortcutsList) {
    shortcutSorter?.cancel();
    const existing = new Map(Array.from(shortcuts.children).map(item => [item.dataset.shortcutId, item]));
    const nodes = shortcutsList.map(shortcut => {
        const item = existing.get(shortcut.id);
        if (item?.querySelector('.shortcut-link')?.getAttribute('href') === shortcut.url
            && item.querySelector('.shortcut-name').textContent === shortcut.name) return item;
        return createShortcutElement(shortcut);
    });

    if (!nodes.length) {
        const empty = document.createElement('div');
        empty.className = 'shortcuts-empty';
        empty.textContent = shortcutSearchInput.value.trim() ? '没有匹配的快捷方式' : '暂无快捷方式，点击右上角 + 添加';
        nodes.push(empty);
    }

    const retained = new Set(nodes);
    Array.from(shortcuts.children).forEach(item => { if (!retained.has(item)) item.remove(); });
    nodes.forEach((item, index) => {
        if (shortcuts.children[index] !== item) shortcuts.insertBefore(item, shortcuts.children[index] || null);
    });
    shortcutSorter?.refresh();
    updateShortcutSortControls();
}

// 创建快捷方式元素
function createShortcutElement(shortcut) {
    const div = document.createElement('div');
    div.className = 'shortcut';
    div.dataset.shortcutId = shortcut.id;
    div.setAttribute('role', 'listitem');
    const link = document.createElement('a');
    link.className = 'shortcut-link';
    link.href = shortcut.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.draggable = false;
    link.setAttribute('aria-describedby', 'shortcutSortDescription');
    link.title = `${shortcut.name}\n${shortcut.url}`;
    
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
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', `删除 ${shortcut.name}`);
    deleteBtn.title = '删除快捷方式';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteShortcut(shortcut.id);
    });
    
    const editBtn = document.createElement('button');
    editBtn.className = 'shortcut-edit';
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', `编辑 ${shortcut.name}`);
    editBtn.title = '编辑快捷方式';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        editShortcut(shortcut.id);
    });
    
    link.append(icon, name);
    div.appendChild(link);
    div.appendChild(deleteBtn);
    div.appendChild(editBtn);
    
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

function renderIconImage(iconElement, src) {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
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
    renderIconImage(iconElement, buildFallbackIconDataUrl(domain, name));
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
            renderIconImage(iconElement, cached.url);
        }
        return;
    }

    const sources = buildFaviconSources(domain);
    for (const src of sources) {
        try {
            const loadedSrc = await testFaviconSource(src);
            renderIconImage(iconElement, loadedSrc);
            setCachedFavicon(domain, loadedSrc, FAVICON_CACHE_SUCCESS_TTL);
            return;
        } catch (error) {
        }
    }

    setCachedFavicon(domain, null, FAVICON_CACHE_FAILURE_TTL);
}

// 添加和编辑共用一套开关流程，避免残留表单内容或编辑状态。
function openShortcutModal(shortcut = null) {
    shortcutSorter?.cancel();
    searchEnginePicker?.close();
    shortcutSortHelpController?.close();
    cancelSearchSuggestionRequest();
    hideAllSearchDropdowns();
    shortcutForm.reset();
    editingShortcutId = shortcut?.id || null;
    modalTitle.textContent = shortcut ? '编辑快捷方式' : '添加快捷方式';
    submitBtn.textContent = shortcut ? '保存' : '添加';
    if (shortcut) {
        shortcutName.value = shortcut.name;
        shortcutUrl.value = shortcut.url;
    }
    addShortcutModal.inert = false;
    addShortcutModal.setAttribute('aria-hidden', 'false');
    addShortcutModal.classList.add('active');
    addShortcutModal.querySelector('.modal-content').scrollTop = 0;
    shortcutName.focus({ preventScroll: true });
}

function closeShortcutModal() {
    const editedItem = Array.from(shortcuts.children).find(item => item.dataset.shortcutId === editingShortcutId);
    const returnTarget = editedItem?.querySelector('.shortcut-link') || addShortcutBtn;
    addShortcutModal.classList.remove('active');
    returnTarget.focus({ preventScroll: true });
    addShortcutModal.inert = true;
    addShortcutModal.setAttribute('aria-hidden', 'true');
    shortcutForm.reset();
    editingShortcutId = null;
    modalTitle.textContent = '添加快捷方式';
    submitBtn.textContent = '添加';
}

// 添加快捷方式
function addShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();

    if (name && url) {
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;

        const shortcutsList = getSavedShortcuts();

        // URL重复检测
        const duplicate = findDuplicateByUrl(shortcutsList, formattedUrl);
        if (duplicate) {
            showNotification(`该网址已存在快捷方式「${duplicate.name}」`);
            return;
        }

        shortcutsList.push({ name, url: formattedUrl });

        if (!saveAndRenderShortcuts(shortcutsList)) return;

        closeShortcutModal();
    }
}

// 编辑快捷方式
function editShortcut(id) {
    const shortcut = getSavedShortcuts().find(item => item.id === id);
    if (shortcut) openShortcutModal(shortcut);
}

// 保存编辑的快捷方式
function saveEditedShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();

    if (name && url) {
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;

        const shortcutsList = getSavedShortcuts();

        // 编辑和搜索状态共享同一个标识，不依赖当前卡片位置。
        const duplicate = findDuplicateByUrl(shortcutsList, formattedUrl, editingShortcutId);
        if (duplicate) {
            showNotification(`该网址已存在快捷方式「${duplicate.name}」`);
            return;
        }

        const index = shortcutsList.findIndex(item => item.id === editingShortcutId);
        if (index < 0) {
            showNotification('该快捷方式已被删除，请关闭窗口后重试');
            return;
        }
        shortcutsList[index] = { ...shortcutsList[index], name, url: formattedUrl };

        if (!saveAndRenderShortcuts(shortcutsList)) return;

        closeShortcutModal();
    }
}

// 删除快捷方式
function deleteShortcut(id) {
    saveAndRenderShortcuts(getSavedShortcuts().filter(item => item.id !== id));
}

function persistShortcuts(items) {
    try {
        localStorage.setItem('shortcuts', JSON.stringify(items));
        return true;
    } catch {
        showNotification('暂时无法保存快捷方式，请检查浏览器存储空间后重试');
        return false;
    }
}

// 增删改保留搜索条件；排序单独提交，避免重建卡片或打断落位动画。
function saveAndRenderShortcuts(shortcutsList) {
    shortcutSorter?.cancel();
    const normalized = ensureShortcutIds(shortcutsList);
    if (!persistShortcuts(normalized)) return false;
    allShortcuts = normalized;
    dismissShortcutUndo();
    renderVisibleShortcuts();
    return true;
}

function updateShortcutSortControls() {
    const searching = Boolean(shortcutSearchInput.value.trim());
    const enabled = !searching && allShortcuts.length > 1;
    shortcuts.classList.toggle('is-sort-disabled', !enabled);

    shortcutSortHelpTitle.textContent = searching ? '清除搜索后可排序' : '调整快捷方式';
    shortcutSortHelpPointer.textContent = searching ? '点击搜索框中的 ×，即可恢复排序。'
        : !enabled ? '添加更多快捷方式后，即可拖动调整顺序。'
        : '按住鼠标左键拖动卡片，松手放置；移到区域外松手可取消。';
    shortcutSortDescription.textContent = shortcutSortHelpPointer.textContent;
    shortcutSortFeedback.hidden = !shortcutSortState.active;
    shortcutSortFeedback.textContent = !shortcutSortState.active ? ''
        : shortcutSortState.inside ? '松手放置' : '松手取消';
    const showUndo = Boolean(shortcutUndoState) && !shortcutSortState.active;
    shortcutSortUndo.hidden = !showUndo;
    clearShortcutSearchBtn.hidden = !searching;
}

function dismissShortcutUndo() {
    clearTimeout(shortcutUndoTimer);
    shortcutUndoTimer = null;
    shortcutUndoState = null;
    updateShortcutSortControls();
}

function scheduleShortcutUndoExpiry() {
    clearTimeout(shortcutUndoTimer);
    // 等焦点完成转移后再计时，操作撤销按钮时不让入口突然消失。
    queueMicrotask(() => {
        if (!shortcutUndoState || shortcutSortUndo.contains(document.activeElement) || shortcutSortUndo.matches(':hover')) return;
        shortcutUndoTimer = setTimeout(dismissShortcutUndo, 5000);
    });
}

function commitShortcutOrder(ids, previousIds, movedId) {
    const current = getSavedShortcuts();
    const ordered = orderShortcuts(current, ids);
    if (!ordered || current.some((item, index) => item.id !== previousIds[index])) {
        showNotification('快捷方式已在其他页面更新，请重新排序');
        queueMicrotask(() => {
            allShortcuts = getSavedShortcuts();
            dismissShortcutUndo();
            renderVisibleShortcuts();
        });
        return false;
    }
    if (!persistShortcuts(ordered)) return false;
    allShortcuts = ordered;
    shortcutUndoState = { previousIds, ids, movedId };
    scheduleShortcutUndoExpiry();
    updateShortcutSortControls();
    return true;
}

function undoShortcutOrder() {
    if (!shortcutUndoState) return;
    const { previousIds, ids, movedId } = shortcutUndoState;
    const current = getSavedShortcuts();
    const ordered = orderShortcuts(current, previousIds);
    if (!ordered || current.some((item, index) => item.id !== ids[index])) {
        dismissShortcutUndo();
        showNotification('快捷方式已经更新，无法撤销上一次排序');
        return;
    }
    if (!persistShortcuts(ordered)) return;
    allShortcuts = ordered;
    dismissShortcutUndo();
    renderVisibleShortcuts();
    const movedItem = Array.from(shortcuts.children).find(item => item.dataset.shortcutId === movedId);
    movedItem?.querySelector('.shortcut-link').focus({ preventScroll: true });
    shortcutSortStatus.textContent = '已撤销排序，恢复原顺序。';
}

// 清除快捷方式搜索状态
function clearShortcutSearch() {
    if (shortcutSearchCollapseTimer) {
        clearTimeout(shortcutSearchCollapseTimer);
        shortcutSearchCollapseTimer = null;
    }
    shortcutSearchInput.value = '';
    shortcutSearchWrapper.classList.remove('active');
    updateShortcutSortControls();
}

// 启动快捷方式搜索自动收回计时器
function startShortcutSearchCollapseTimer() {
    if (shortcutSearchCollapseTimer) {
        clearTimeout(shortcutSearchCollapseTimer);
    }
    shortcutSearchCollapseTimer = setTimeout(() => {
        if (!shortcutSearchInput.value.trim() && !shortcutSortState.active) {
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

    renderVisibleShortcuts();
    if (!shortcutSearchInput.value.trim()) {
        startShortcutSearchCollapseTimer();
    }
}

function renderVisibleShortcuts() {
    const term = shortcutSearchInput.value.trim().toLowerCase();
    const filtered = allShortcuts.filter(item => {
        return item.name.toLowerCase().includes(term) || item.url.toLowerCase().includes(term);
    });
    renderShortcuts(filtered);
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
