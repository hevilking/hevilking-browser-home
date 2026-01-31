// DOM元素
const background = document.getElementById('background');
const wallpaperSwitch = document.getElementById('wallpaperSwitch');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const shortcuts = document.getElementById('shortcuts');
const addShortcutBtn = document.getElementById('addShortcutBtn');
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

// 当前选中的搜索引擎URL
let currentSearchEngineUrl = 'https://cn.bing.com/search?q=';

// 搜索历史记录相关变量
const MAX_SEARCH_HISTORY = 5;
let searchHistoryEnabled = localStorage.getItem('searchHistoryEnabled') !== 'false';
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let hideSearchHistoryTimeout = null;

// 编辑模式相关变量
let editingIndex = -1;

// 壁纸文件夹路径
const wallpaperPath = 'assets/images/';

// 默认快捷方式
const defaultShortcuts = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Bilibili', url: 'https://www.bilibili.com' },
];



// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    setDefaultWallpaper();
    currentEngine.textContent = 'Bing';
    searchEngineBtn.setAttribute('data-engine', 'Bing');
    engineOptions = document.querySelectorAll('.engine-option');
    loadShortcuts();
    initSearchHistory();
    setupEventListeners();
    
    try {
        setRandomWallpaper();
    } catch (error) {
        setDefaultWallpaper();
    }
});

// 设置随机壁纸
function setRandomWallpaper() {
    showNotification('正在寻觅新的风景...');
    
    const currentBackground = background.style.backgroundImage;
    
    const wallpapers = [
        'assets/images/undifine.webp'
    ];
    
    const onlineWallpapers = [
        'https://picsum.photos/1920/1080?random=1',
        'https://picsum.photos/1920/1080?random=2',
        'https://picsum.photos/1920/1080?random=3',
        'https://picsum.photos/1920/1080?random=4',
        'https://picsum.photos/1920/1080?random=5'
    ];
    
    const allWallpapers = [...wallpapers, ...onlineWallpapers];
    const randomIndex = Math.floor(Math.random() * allWallpapers.length);
    const wallpaperUrl = allWallpapers[randomIndex];
    
    console.log('尝试加载壁纸:', wallpaperUrl);
    
    const img = new Image();
    
    const handleError = () => {
        console.error('壁纸加载失败:', wallpaperUrl);
        showNotification('网络如梦，暂留素雅');
        if (currentBackground) {
            background.style.backgroundImage = currentBackground;
        }
    };
    
    const handleSuccess = () => {
        clearTimeout(timeoutId);
        try {
            console.log('壁纸加载成功，设置背景:', wallpaperUrl);
            background.style.backgroundImage = `url('${wallpaperUrl}')`;
            background.style.display = 'none';
            background.offsetHeight;
            background.style.display = '';
            showNotification('风景如画，心境如诗');
        } catch (error) {
            console.error('设置壁纸时出错:', error);
            handleError();
        }
    };
    
    img.onload = handleSuccess;
    img.onerror = handleError;
    
    const timeoutId = setTimeout(() => {
        console.warn('壁纸加载超时:', wallpaperUrl);
        handleError();
    }, 5000);
    
    try {
        img.src = wallpaperUrl;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('设置图片源时出错:', error);
        handleError();
    }
}

// 设置默认壁纸
function setDefaultWallpaper() {
    const defaultUrl = `${wallpaperPath}undifine.webp`;
    background.style.backgroundImage = `url('${defaultUrl}')`;
}

// 设置事件监听器
function setupEventListeners() {
    wallpaperSwitch.addEventListener('click', setRandomWallpaper);
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && performSearch());
    
    searchHistorySwitch.addEventListener('change', toggleSearchHistory);
    
    searchInput.addEventListener('focus', showSearchHistory);
    searchInput.addEventListener('blur', function() {
        hideSearchHistoryTimeout = setTimeout(hideSearchHistory, 300);
    });
    
    searchHistoryDropdown.addEventListener('mouseenter', function() {
        if (hideSearchHistoryTimeout) {
            clearTimeout(hideSearchHistoryTimeout);
            hideSearchHistoryTimeout = null;
        }
    });
    
    searchHistoryDropdown.addEventListener('mouseleave', function() {
        setTimeout(() => {
            if (document.activeElement !== searchInput) {
                hideSearchHistoryTimeout = setTimeout(hideSearchHistory, 300);
            }
        }, 50);
    });
    
    searchHistoryDropdown.addEventListener('mousedown', function(e) {
        if (e.target.closest('.search-history-item') || e.target.closest('.search-history-item-delete')) {
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
    }
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
function selectSearchEngine(element) {
    const engineName = element.getAttribute('data-engine');
    const engineUrl = element.getAttribute('data-url');
    
    currentSearchEngineUrl = engineUrl;
    currentEngine.textContent = engineName;
    searchEngineBtn.setAttribute('data-engine', engineName);
    
    engineOptions.forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
    
    closeSearchEngineModal();
    showNotification(`已切换到 ${engineName}`);
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
    
    renderShortcuts(savedShortcuts);
}

// 渲染快捷方式
function renderShortcuts(shortcutsList) {
    shortcuts.innerHTML = '';
    
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
        const iconChar = '🌐';
        icon.innerHTML = `<span style="font-size:24px;">${iconChar}</span>`;
    } else {
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
function loadFavicon(iconElement, domain, name) {
    const faviconSources = [
        `https://${domain}/favicon.ico`,
    ];
    
    let currentSourceIndex = 0;
    
    const img = document.createElement('img');
    img.alt = name;
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'contain';
    img.style.display = 'none';
    
    function tryNextSource() {
        if (currentSourceIndex >= faviconSources.length) {
            const iconChar = '🌐';
            iconElement.innerHTML = `<span style="font-size:24px;">${iconChar}</span>`;
            return;
        }
        
        const src = faviconSources[currentSourceIndex];
        img.src = src;
        
        const timeout = setTimeout(() => {
            currentSourceIndex++;
            tryNextSource();
        }, 3000);
        
        img.onload = function() {
            clearTimeout(timeout);
            if (img.naturalWidth > 1 && img.naturalHeight > 1) {
                img.style.display = 'block';
                iconElement.innerHTML = '';
                iconElement.appendChild(img);
            } else {
                currentSourceIndex++;
                tryNextSource();
            }
        };
        
        img.onerror = function() {
            clearTimeout(timeout);
            currentSourceIndex++;
            tryNextSource();
        };
    }
    
    tryNextSource();
}

// 添加快捷方式
function addShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();
    
    if (name && url) {
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;
        
        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
        
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
    localStorage.setItem('shortcuts', JSON.stringify(shortcutsList));
    renderShortcuts(shortcutsList);
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
    
    if (!searchHistoryEnabled) {
        searchHistoryDropdown.classList.remove('active');
    }
    
    showNotification(searchHistoryEnabled ? '将记录搜索历史' : '不再记录搜索历史');
}

// 显示搜索历史记录
function showSearchHistory() {
    if (!searchHistoryEnabled) {
        return;
    }
    
    if (hideSearchHistoryTimeout) {
        clearTimeout(hideSearchHistoryTimeout);
        hideSearchHistoryTimeout = null;
    }
    
    if (document.activeElement === searchInput) {
        searchHistoryDropdown.classList.add('active');
    }
}

// 隐藏搜索历史记录
function hideSearchHistory() {
    if (hideSearchHistoryTimeout) {
        clearTimeout(hideSearchHistoryTimeout);
        hideSearchHistoryTimeout = null;
    }
    
    if (document.activeElement !== searchInput) {
        searchHistoryDropdown.classList.remove('active');
    }
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
                searchHistoryDropdown.classList.add('active');
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
