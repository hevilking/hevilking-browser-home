const BING_DAILY_URL = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';

async function fetchBingDailyImage(signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 7000);
    try {
        const response = await fetch(BING_DAILY_URL, { method: 'GET', signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Bing 响应异常: ${response.status}`);
        }
        const payload = await response.json();
        const image = payload && payload.images && payload.images[0];
        if (!image || !image.url) {
            throw new Error('Bing 返回数据中缺少图片信息');
        }
        return image.url.startsWith('http') ? image.url : `https://www.bing.com${image.url}`;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

function createPicsumCandidates() {
    const seed = Date.now();
    return [1, 2, 3].map((offset) => `https://picsum.photos/1920/1080?random=${seed + offset}`);
}

export async function getOnlineCandidates(signal) {
    const candidates = [];

    try {
        const bingUrl = await fetchBingDailyImage(signal);
        candidates.push({
            type: 'image',
            source: 'bing',
            url: bingUrl
        });
    } catch (error) {
        if (signal?.aborted) throw error;
        console.warn('获取 Bing 每日壁纸失败:', error);
    }

    createPicsumCandidates().forEach((url) => {
        candidates.push({
            type: 'image',
            source: 'picsum',
            url
        });
    });

    return candidates;
}

