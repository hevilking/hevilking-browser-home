// 浏览器扩展后台脚本

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('浏览器主页扩展已安装');
        
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

// 监听消息传递
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('收到消息:', request);
    
    if (request.action === 'getSettings') {
        chrome.storage.local.get(['searchHistoryEnabled', 'defaultSearchEngine'], function(result) {
            sendResponse(result);
        });
        return true;
    }
    
    if (request.action === 'saveSettings') {
        chrome.storage.local.set(request.data, function() {
            sendResponse({success: true});
        });
        return true;
    }
});
