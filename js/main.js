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
let searchHistoryEnabled = localStorage.getItem('searchHistoryEnabled') !== 'false'; // 默认开启
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
let hideSearchHistoryTimeout = null; // 用于延迟隐藏搜索历史记录

// 编辑模式相关变量
let editingIndex = -1; // -1表示添加模式，其他值表示编辑模式

// 壁纸文件夹路径
const wallpaperPath = 'assets/images/';





// 默认快捷方式
const defaultShortcuts = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Bilibili', url: 'https://www.bilibili.com' },
];

// 网站图标映射
const siteIcons = {
    'github.com': '📦',
    'bilibili.com': '📺',
    'zhihu.com': '💡',
    'weibo.com': '📢',
    'baidu.com': '🔍',
    'google.com': '🔍',
    'bing.com': '🔍',
    'duckduckgo.com': '🦆',
    'youtube.com': '📹',
    'twitter.com': '🐦',
    'facebook.com': '📘',
    'instagram.com': '📷',
    'linkedin.com': '💼',
    'reddit.com': '🤖',
    'pinterest.com': '📌',
    'tiktok.com': '🎵',
    'taobao.com': '🛒',
    'jd.com': '🛒',
    'tmall.com': '🛍️',
    'netflix.com': '🎬',
    'amazon.com': '📦',
    'microsoft.com': '🖥️',
    'apple.com': '🍎',
    'spotify.com': '🎵',
    'discord.com': '💬',
    'telegram.org': '✈️',
    'whatsapp.com': '💬',
    'wechat.com': '💬',
    'qq.com': '💬',
    'weiyun.com': '☁️',
    'bilibili.tv': '📺',
    'douyin.com': '🎵',
    'kuaishou.com': '📹',
    'xiaohongshu.com': '📖',
    'toutiao.com': '📰',
    '163.com': '📧',
    '126.com': '📧',
    'qqmail.com': '📧',
    'gmail.com': '📧',
    'outlook.com': '📧',
    'yahoo.com': '📧',
    'hotmail.com': '📧',
    'icloud.com': '☁️',
    'onedrive.com': '☁️',
    'dropbox.com': '☁️',
    'baiducloud.com': '☁️',
    'aliyun.com': '☁️',
    'tencentcloud.com': '☁️',
    'csdn.net': '💻',
    'juejin.cn': '💻',
    'segmentfault.com': '💻',
    'stackoverflow.com': '💻',
    'github.io': '📄',
    'gitee.com': '📦',
    'coding.net': '💻',
    'jianshu.com': '📖',
    'cnblogs.com': '📝'
};

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 先设置默认壁纸
    setDefaultWallpaper();
    
    // 设置默认搜索引擎
    currentEngine.textContent = 'Bing';
    searchEngineBtn.setAttribute('data-engine', 'Bing');
    
    // 获取搜索引擎选项元素
    engineOptions = document.querySelectorAll('.engine-option');
    
    // 加载快捷方式
    loadShortcuts();
    
    // 初始化搜索历史记录
    initSearchHistory();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 然后尝试设置随机壁纸（只调用一次）
    try {
        setRandomWallpaper();
    } catch (error) {
        // 初始化壁纸失败，使用默认壁纸
        setDefaultWallpaper();
    }
});

// 设置随机壁纸
function setRandomWallpaper() {
    showNotification('正在寻觅新的风景...');
    
    // 保存当前背景，以便在加载失败时恢复
    const currentBackground = background.style.backgroundImage;
    
    // 在浏览器扩展环境中，使用安全的壁纸源或本地壁纸
    const wallpapers = [
        'assets/images/undifine.webp'
    ];
    
    // 添加一些在线壁纸源（使用安全的HTTPS链接）
    const onlineWallpapers = [
        'https://picsum.photos/1920/1080?random=1',
        'https://picsum.photos/1920/1080?random=2',
        'https://picsum.photos/1920/1080?random=3',
        'https://picsum.photos/1920/1080?random=4',
        'https://picsum.photos/1920/1080?random=5'
    ];
    
    // 合并壁纸列表
    const allWallpapers = [...wallpapers, ...onlineWallpapers];
    
    // 随机选择一个壁纸
    const randomIndex = Math.floor(Math.random() * allWallpapers.length);
    const wallpaperUrl = allWallpapers[randomIndex];
    
    console.log('尝试加载壁纸:', wallpaperUrl);
    
    const img = new Image();
    
    const handleError = () => {
        console.error('壁纸加载失败:', wallpaperUrl);
        showNotification('网络如梦，暂留素雅');
        // 恢复之前的背景，而不是设置为默认背景
        if (currentBackground) {
            background.style.backgroundImage = currentBackground;
        }
    };
    
    const handleSuccess = () => {
        clearTimeout(timeoutId);
        try {
            console.log('壁纸加载成功，设置背景:', wallpaperUrl);
            background.style.backgroundImage = `url('${wallpaperUrl}')`;
            // 强制重绘背景
            background.style.display = 'none';
            background.offsetHeight; // 触发重排
            background.style.display = '';
            showNotification('风景如画，心境如诗');
        } catch (error) {
            console.error('设置壁纸时出错:', error);
            handleError();
        }
    };
    
    img.onload = handleSuccess;
    img.onerror = handleError;
    
    // 设置超时处理
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



// 设置默认壁纸（undifine.png）
function setDefaultWallpaper() {
    const defaultUrl = `${wallpaperPath}undifine.webp`;
    background.style.backgroundImage = `url('${defaultUrl}')`;
}



// 设置事件监听器
function setupEventListeners() {
    // 壁纸切换按钮 - 左键点击切换壁纸
    wallpaperSwitch.addEventListener('click', setRandomWallpaper);
    
    // 搜索功能
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && performSearch());
    
    // 搜索历史记录开关
    searchHistorySwitch.addEventListener('change', toggleSearchHistory);
    
    // 搜索输入框聚焦和失焦事件
    searchInput.addEventListener('focus', showSearchHistory);
    searchInput.addEventListener('blur', function() {
        // 延迟隐藏，以便用户有时间点击历史记录
        hideSearchHistoryTimeout = setTimeout(hideSearchHistory, 300);
    });
    
    // 搜索历史记录下拉框鼠标事件
    searchHistoryDropdown.addEventListener('mouseenter', function() {
        // 鼠标进入下拉框时，取消隐藏
        if (hideSearchHistoryTimeout) {
            clearTimeout(hideSearchHistoryTimeout);
            hideSearchHistoryTimeout = null;
        }
    });
    
    searchHistoryDropdown.addEventListener('mouseleave', function() {
        // 鼠标离开下拉框时，检查搜索框是否还有焦点
        setTimeout(() => {
            // 如果搜索框没有焦点，则延迟隐藏
            if (document.activeElement !== searchInput) {
                hideSearchHistoryTimeout = setTimeout(hideSearchHistory, 300);
            }
        }, 50);
    });
    
    // 点击历史记录项时，保持焦点在搜索框上
    searchHistoryDropdown.addEventListener('mousedown', function(e) {
        if (e.target.closest('.search-history-item') || e.target.closest('.search-history-item-delete')) {
            // 阻止默认行为，防止搜索框失去焦点
            e.preventDefault();
        }
    });
    
    searchHistoryDropdown.addEventListener('click', function(e) {
        if (e.target.closest('.search-history-item')) {
            // 将焦点重新设置到搜索框
            setTimeout(() => searchInput.focus(), 0);
        } else if (e.target.closest('.search-history-item-delete')) {
            // 将焦点重新设置到搜索框
            setTimeout(() => searchInput.focus(), 0);
        }
    });
    
    // 清除搜索历史记录
    clearHistoryBtn.addEventListener('click', clearSearchHistory);
    
    // 搜索引擎选择按钮点击事件
    searchEngineBtn.addEventListener('click', openSearchEngineModal);
    
    // 搜索引擎弹窗关闭事件
    closeSearchModal.addEventListener('click', closeSearchEngineModal);
    modalBackdrop.addEventListener('click', closeSearchEngineModal);
    
    // 搜索引擎选项点击事件
    engineOptions.forEach(option => {
        option.addEventListener('click', function() {
            selectSearchEngine(this);
        });
    });
    
    // 添加快捷方式
    addShortcutBtn.addEventListener('click', () => {
        addShortcutModal.classList.add('active');
    });
    
    // 关闭模态框
    closeModal.addEventListener('click', () => {
        addShortcutModal.classList.remove('active');
        shortcutForm.reset();
        // 重置编辑模式
        editingIndex = -1;
        // 恢复弹窗标题和按钮文本
        modalTitle.textContent = '添加快捷方式';
        submitBtn.textContent = '添加快捷方式';
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === addShortcutModal) {
            addShortcutModal.classList.remove('active');
            shortcutForm.reset();
            // 重置编辑模式
            editingIndex = -1;
            // 恢复弹窗标题和按钮文本
            modalTitle.textContent = '添加快捷方式';
            submitBtn.textContent = '添加快捷方式';
        }
    });
    
    // 提交快捷方式表单
    shortcutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (editingIndex >= 0) {
            // 编辑模式
            saveEditedShortcut();
        } else {
            // 添加模式
            addShortcut();
        }
    });
}

// 显示通知
function showNotification(message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => notification.classList.add('show'), 10);
    
    // 3秒后隐藏通知
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// 执行搜索
function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        // 如果搜索历史记录功能开启，则添加到搜索历史
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
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 关闭搜索引擎选择弹窗
function closeSearchEngineModal() {
    searchEngineModal.classList.remove('active');
    document.body.style.overflow = ''; // 恢复滚动
}

// 选择搜索引擎
function selectSearchEngine(element) {
    const engineName = element.getAttribute('data-engine');
    const engineUrl = element.getAttribute('data-url');
    
    // 更新当前选中的搜索引擎URL
    currentSearchEngineUrl = engineUrl;
    
    // 更新按钮显示的搜索引擎名称
    currentEngine.textContent = engineName;
    
    // 更新按钮的data-engine属性以显示正确的图标
    searchEngineBtn.setAttribute('data-engine', engineName);
    
    // 添加选中效果
    engineOptions.forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
    
    // 关闭弹窗
    closeSearchEngineModal();
    
    // 显示通知
    showNotification(`已切换到 ${engineName}`);
}

// 加载快捷方式
function loadShortcuts() {
    // 从localStorage获取快捷方式，如果没有则使用默认快捷方式
    let savedShortcuts = localStorage.getItem('shortcuts');
    
    try {
        savedShortcuts = savedShortcuts ? JSON.parse(savedShortcuts) : defaultShortcuts;
    } catch (e) {
        savedShortcuts = defaultShortcuts;
    }
    
    // 如果没有保存的快捷方式，保存默认快捷方式到localStorage
    if (!localStorage.getItem('shortcuts')) {
        localStorage.setItem('shortcuts', JSON.stringify(defaultShortcuts));
    }
    
    // 渲染快捷方式
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
    
    // 获取域名
    let domain = '';
    try {
        domain = new URL(shortcut.url).hostname.toLowerCase();
    } catch (e) {
        // 忽略错误，使用空域名
    }
    
    // 如果无法获取域名，使用默认图标
    if (!domain) {
        const iconChar = '🌐';
        icon.innerHTML = `<span style="font-size:24px;">${iconChar}</span>`;
    } else {
        // 使用 favicon API 获取网站图标，支持多个服务备选
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
    
    // 添加拖拽事件监听器
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragenter', handleDragEnter);
    div.addEventListener('dragleave', handleDragLeave);
    
    div.addEventListener('click', function(e) {
        // 如果正在拖拽，不触发点击事件
        if (e.target.closest('.shortcut').classList.contains('dragging')) {
            return;
        }
        window.open(shortcut.url, '_blank');
    });
    
    return div;
}

// 加载 favicon，支持多个服务备选
function loadFavicon(iconElement, domain, name) {
    const faviconSources = [
        `https://${domain}/favicon.ico`,
    ];
    
    let currentSourceIndex = 0;
    
    // 创建图片元素
    const img = document.createElement('img');
    img.alt = name;
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'contain';
    img.style.display = 'none';
    
    // 尝试加载下一个 favicon 源
    function tryNextSource() {
        if (currentSourceIndex >= faviconSources.length) {
            // 所有源都失败了，使用 emoji 回退
            const iconChar = siteIcons[domain] || '🌐';
            iconElement.innerHTML = `<span style="font-size:24px;">${iconChar}</span>`;
            return;
        }
        
        const src = faviconSources[currentSourceIndex];
        img.src = src;
        
        // 设置超时，如果 3 秒内没有加载完成，尝试下一个源
        const timeout = setTimeout(() => {
            currentSourceIndex++;
            tryNextSource();
        }, 3000);
        
        img.onload = function() {
            clearTimeout(timeout);
            // 检查图片是否有效（不是 0x0 或 1x1 的占位图）
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
    
    // 开始尝试加载
    tryNextSource();
}

// 添加快捷方式
function addShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();
    
    if (name && url) {
        // 确保URL有协议
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;
        
        // 获取当前快捷方式列表
        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
        
        // 添加新快捷方式
        shortcutsList.push({ name, url: formattedUrl });
        
        // 保存到localStorage并重新渲染
        saveAndRenderShortcuts(shortcutsList);
        
        // 关闭弹窗并重置表单
        addShortcutModal.classList.remove('active');
        shortcutForm.reset();
    }
}

// 编辑快捷方式
function editShortcut(index) {
    // 获取当前快捷方式列表
    const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
    const shortcut = shortcutsList[index];
    
    if (shortcut) {
        // 设置编辑模式
        editingIndex = index;
        
        // 更新弹窗标题和按钮文本
        modalTitle.textContent = '编辑快捷方式';
        submitBtn.textContent = '保存修改';
        
        // 填充表单数据
        shortcutName.value = shortcut.name;
        shortcutUrl.value = shortcut.url;
        
        // 显示弹窗
        addShortcutModal.classList.add('active');
    }
}

// 保存编辑的快捷方式
function saveEditedShortcut() {
    const name = shortcutName.value.trim();
    const url = shortcutUrl.value.trim();
    
    if (name && url) {
        // 确保URL有协议
        const formattedUrl = url.startsWith('http') ? url : 'https://' + url;
        
        // 获取当前快捷方式列表
        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
        
        // 更新快捷方式
        shortcutsList[editingIndex] = { name, url: formattedUrl };
        
        // 保存到localStorage并重新渲染
        saveAndRenderShortcuts(shortcutsList);
        
        // 重置编辑模式
        editingIndex = -1;
        
        // 关闭弹窗并重置表单
        addShortcutModal.classList.remove('active');
        shortcutForm.reset();
        
        // 恢复弹窗标题和按钮文本
        modalTitle.textContent = '添加快捷方式';
        submitBtn.textContent = '添加快捷方式';
    }
}

// 删除快捷方式
function deleteShortcut(index) {
    const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
    
    // 删除指定索引的快捷方式
    shortcutsList.splice(index, 1);
    
    // 保存到localStorage并重新渲染
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
    // 首次拖拽时显示提示
    if (!hasDraggedBefore) {
        showNotification('拖拽到其他快捷方式上可以重新排序');
        localStorage.setItem('hasDraggedBefore', 'true');
        hasDraggedBefore = true;
    }
    
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    
    // 设置拖拽数据
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
    
    // 如果拖拽到自身，不做处理
    if (draggedElement !== this) {
        const dropIndex = parseInt(this.dataset.index);
        
        // 获取当前快捷方式列表
        const shortcutsList = JSON.parse(localStorage.getItem('shortcuts')) || [];
        
        // 移动快捷方式
        const draggedShortcut = shortcutsList[draggedIndex];
        shortcutsList.splice(draggedIndex, 1);
        shortcutsList.splice(dropIndex, 0, draggedShortcut);
        
        // 保存并重新渲染
        saveAndRenderShortcuts(shortcutsList);
    }
    
    return false;
}

// 拖拽结束
function handleDragEnd(e) {
    // 清除所有拖拽相关的类
    const shortcuts = document.querySelectorAll('.shortcut');
    shortcuts.forEach(shortcut => {
        shortcut.classList.remove('dragging');
        shortcut.classList.remove('drag-over');
    });
}

// 初始化搜索历史记录
function initSearchHistory() {
    // 确保开关状态与localStorage中的值一致
    searchHistoryEnabled = localStorage.getItem('searchHistoryEnabled') !== 'false'; // 默认开启
    searchHistorySwitch.checked = searchHistoryEnabled;
    
    // 初始化事件监听器
    initSearchHistoryEvents();
    
    // 渲染搜索历史记录
    renderSearchHistory();
}

// 切换搜索历史记录功能
function toggleSearchHistory() {
    searchHistoryEnabled = searchHistorySwitch.checked;
    localStorage.setItem('searchHistoryEnabled', searchHistoryEnabled);
    
    // 如果关闭搜索历史记录功能，隐藏下拉框
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
    
    // 清除任何待执行的隐藏操作
    if (hideSearchHistoryTimeout) {
        clearTimeout(hideSearchHistoryTimeout);
        hideSearchHistoryTimeout = null;
    }
    
    // 确保搜索框有焦点时才显示历史记录
    if (document.activeElement === searchInput) {
        searchHistoryDropdown.classList.add('active');
    }
}

// 隐藏搜索历史记录
function hideSearchHistory() {
    // 清除任何现有的隐藏定时器
    if (hideSearchHistoryTimeout) {
        clearTimeout(hideSearchHistoryTimeout);
        hideSearchHistoryTimeout = null;
    }
    
    // 检查搜索框是否还有焦点
    if (document.activeElement !== searchInput) {
        // 搜索框没有焦点，隐藏历史记录
        searchHistoryDropdown.classList.remove('active');
    }
}

// 添加搜索历史记录
function addSearchHistory(searchTerm) {
    // 检查是否已存在相同的搜索记录
    const existingIndex = searchHistory.findIndex(item => item === searchTerm);
    
    if (existingIndex !== -1) {
        // 如果已存在，将其移到最前面
        searchHistory.splice(existingIndex, 1);
    }
    
    // 添加到最前面
    searchHistory.unshift(searchTerm);
    
    // 限制最多保存5条记录
    if (searchHistory.length > MAX_SEARCH_HISTORY) {
        searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
    }
    
    // 保存到localStorage
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    
    // 重新渲染搜索历史记录
    renderSearchHistory();
}

// 移除搜索历史记录项
function removeSearchHistory(query) {
    searchHistory = searchHistory.filter(item => item !== query);
    
    // 保存到本地存储
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
        
        // 鼠标进入历史记录项时，取消隐藏
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
    // 使用事件委托处理历史记录项的点击
    searchHistoryList.addEventListener('click', function(e) {
        const historyItem = e.target.closest('.search-history-item');
        if (!historyItem) return;
        
        const term = historyItem.dataset.term;
        const index = parseInt(historyItem.dataset.index);
        
        if (e.target.closest('.search-history-item-text')) {
            // 点击历史记录项文本
            e.preventDefault();
            
            // 清除任何待执行的隐藏操作
            if (hideSearchHistoryTimeout) {
                clearTimeout(hideSearchHistoryTimeout);
                hideSearchHistoryTimeout = null;
            }
            
            searchInput.value = term;
            performSearch();
            
            // 搜索后重新渲染历史记录，并保持下拉框显示
            setTimeout(() => {
                renderSearchHistory();
                searchHistoryDropdown.classList.add('active');
            }, 100);
        } else if (e.target.closest('.search-history-item-delete')) {
            // 点击删除按钮
            e.stopPropagation();
            searchHistory.splice(index, 1);
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
            renderSearchHistory();
            // 保持焦点在搜索框上
            setTimeout(() => searchInput.focus(), 0);
        }
    });
}