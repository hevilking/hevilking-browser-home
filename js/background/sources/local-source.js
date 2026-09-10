import { LOCAL_WALLPAPERS } from '../config.js';
import { listCustomImages } from '../custom-image-library.js';

export async function getLocalCandidates() {
    const builtInCandidates = LOCAL_WALLPAPERS.map((url) => ({
        type: 'image',
        source: 'local',
        url,
        cacheKey: url
    }));

    const customRecords = await listCustomImages();
    // 只构造元数据，实际选中时再读取图片和创建临时 URL。
    const customCandidates = customRecords.map(record => ({
        type: 'image', source: 'custom', id: record.id, name: record.name,
        cacheKey: `custom:${record.id}`
    }));

    return [...customCandidates, ...builtInCandidates];
}

export function getDefaultTransitionCandidates() {
    return LOCAL_WALLPAPERS.map((url) => ({
        type: 'image',
        source: 'local-default',
        url,
        cacheKey: url
    }));
}

