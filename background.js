// 浏览器扩展后台脚本
// 这个文件用于处理扩展的后台逻辑

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('浏览器主页扩展已安装');
        
        // 初始化默认设置
        chrome.storage.local.set({
            'searchHistoryEnabled': true,
            'defaultSearchEngine': 'Bing'
        });
    } else if (details.reason === 'update') {
        console.log('浏览器主页扩展已更新');
    }
});

// 监听浏览器启动事件
chrome.runtime.onStartup.addListener(function() {
    console.log('浏览器启动，主页扩展已加载');
});

// 监听消息传递（用于与内容脚本通信）
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('收到消息:', request);
    
    if (request.action === 'getSettings') {
        // 获取设置
        chrome.storage.local.get(['searchHistoryEnabled', 'defaultSearchEngine'], function(result) {
            sendResponse(result);
        });
        return true; // 保持消息通道开放
    }
    
    if (request.action === 'saveSettings') {
        // 保存设置
        chrome.storage.local.set(request.data, function() {
            sendResponse({success: true});
        });
        return true;
    }
});