export function preloadImage(url, timeoutMs = 7000, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('背景加载已取消', 'AbortError'));
            return;
        }
        const image = new Image();
        let finished = false;

        const done = (callback) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(timeoutId);
            signal?.removeEventListener('abort', abort);
            image.onload = null;
            image.onerror = null;
            callback();
        };

        const abort = () => done(() => {
            image.src = '';
            reject(new DOMException('背景加载已取消', 'AbortError'));
        });

        const timeoutId = setTimeout(() => {
            done(() => reject(new Error(`背景加载超时: ${url}`)));
        }, timeoutMs);

        image.onload = () => done(() => resolve(url));
        image.onerror = () => done(() => reject(new Error(`背景加载失败: ${url}`)));
        signal?.addEventListener('abort', abort, { once: true });

        image.src = url;
    });
}

