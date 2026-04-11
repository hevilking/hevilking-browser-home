export function preloadImage(url, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        let finished = false;

        const done = (callback) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(timeoutId);
            callback();
        };

        const timeoutId = setTimeout(() => {
            done(() => reject(new Error(`背景加载超时: ${url}`)));
        }, timeoutMs);

        image.onload = () => done(() => resolve(url));
        image.onerror = () => done(() => reject(new Error(`背景加载失败: ${url}`)));

        image.src = url;
    });
}

