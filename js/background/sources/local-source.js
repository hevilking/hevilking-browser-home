import { LOCAL_WALLPAPERS } from '../config.js';
import { listCustomImages, getCustomImageBlob } from '../custom-image-library.js';

export async function getLocalCandidates() {
    const builtInCandidates = LOCAL_WALLPAPERS.map((url) => ({
        type: 'image',
        source: 'local',
        url,
        cacheKey: url
    }));

    const customRecords = await listCustomImages();
    const customCandidates = await Promise.all(customRecords.map(async (record) => {
        const blob = await getCustomImageBlob(record.id);
        const blobUrl = URL.createObjectURL(blob);
        return {
            type: 'image',
            source: 'custom',
            id: record.id,
            name: record.name,
            url: blobUrl,
            cacheKey: `custom:${record.id}`,
            temporary: true
        };
    }));

    return [...customCandidates, ...builtInCandidates];
}

export async function getPreferredCustomCandidate() {
    const customRecords = await listCustomImages();
    if (customRecords.length === 0) {
        return null;
    }
    const first = customRecords[0];
    const blob = await getCustomImageBlob(first.id);
    const blobUrl = URL.createObjectURL(blob);
    return {
        type: 'image',
        source: 'custom',
        id: first.id,
        name: first.name,
        url: blobUrl,
        cacheKey: `custom:${first.id}`,
        temporary: true
    };
}

export function getDefaultTransitionCandidates() {
    return LOCAL_WALLPAPERS.map((url) => ({
        type: 'image',
        source: 'local-default',
        url,
        cacheKey: url
    }));
}

