import {
    CUSTOM_IMAGE_MAX_COUNT,
    CUSTOM_IMAGE_MAX_FILE_SIZE_BYTES,
    CUSTOM_IMAGE_MAX_TOTAL_BYTES
} from './config.js';
import { LocalizedError } from '../i18n/messages.js';

const DB_NAME = 'hevilking-background-db';
const DB_VERSION = 1;
const STORE_NAME = 'custom-background-images';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error || new LocalizedError('gallery.databaseFailed'));
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

function withStore(mode, executor) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result;
        let settled = false;
        const fail = error => {
            if (settled) return;
            settled = true;
            db.close();
            reject(error || tx.error || new LocalizedError('gallery.transactionFailed'));
        };
        tx.oncomplete = () => {
            db.close();
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };
        tx.onerror = () => fail(tx.error);
        tx.onabort = () => fail(tx.error || new LocalizedError('gallery.transactionAborted'));
        try {
            // 请求成功不等于事务落盘，统一等待 oncomplete 后反馈成功。
            executor(store, value => { result = value; }, fail);
        } catch (error) {
            tx.abort();
            fail(error);
        }
    }));
}

function readAllRawRecords() {
    return withStore('readonly', (store, resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new LocalizedError('gallery.loadFailed'));
    });
}

function generateId() {
    return `bg_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeName(fileName) {
    if (!fileName) {
        return '';
    }
    if (fileName.length <= 60) {
        return fileName;
    }
    return `${fileName.slice(0, 57)}...`;
}

async function compressImageIfNeeded(file) {
    const shouldCompress = file.size > 2 * 1024 * 1024 || file.type !== 'image/webp';
    if (!shouldCompress) {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const maxWidth = 2560;
    const maxHeight = 1440;

    let targetWidth = bitmap.width;
    let targetHeight = bitmap.height;

    const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight, 1);
    targetWidth = Math.max(1, Math.floor(targetWidth * ratio));
    targetHeight = Math.max(1, Math.floor(targetHeight * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (!result) {
                reject(new LocalizedError('gallery.compressFailed'));
                return;
            }
            resolve(result);
        }, 'image/webp', 0.86);
    });

    return new File([blob], normalizeName(file.name.replace(/\.\w+$/, '.webp')), { type: 'image/webp' });
}

function validateFile(file) {
    if (!file) {
        throw new LocalizedError('gallery.noFile');
    }
    if (!file.type.startsWith('image/')) {
        throw new LocalizedError('gallery.imageOnly');
    }
    if (file.size > CUSTOM_IMAGE_MAX_FILE_SIZE_BYTES) {
        throw new LocalizedError('gallery.tooLarge');
    }
}

function calculateStats(records) {
    return {
        count: records.length,
        totalBytes: records.reduce((sum, item) => sum + (item.size || 0), 0)
    };
}

function toPublicRecord(record) {
    return {
        id: record.id,
        name: record.name,
        mimeType: record.mimeType,
        size: record.size,
        createdAt: record.createdAt
    };
}

export async function listCustomImages() {
    const records = await readAllRawRecords();
    return records
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(toPublicRecord);
}

export async function getCustomImageBlob(recordId) {
    return withStore('readonly', (store, resolve, reject) => {
        const request = store.get(recordId);
        request.onsuccess = () => {
            const record = request.result;
            if (!record || !record.blob) {
                reject(new LocalizedError('gallery.missing'));
                return;
            }
            resolve(record.blob);
        };
        request.onerror = () => reject(request.error || new LocalizedError('gallery.readFailed'));
    });
}

export async function saveCustomImage(file) {
    validateFile(file);

    const optimizedFile = await compressImageIfNeeded(file);
    validateFile(optimizedFile);

    const existing = await readAllRawRecords();
    const stats = calculateStats(existing);
    if (stats.count >= CUSTOM_IMAGE_MAX_COUNT) {
        throw new LocalizedError('gallery.countLimit', { count: CUSTOM_IMAGE_MAX_COUNT });
    }
    if (stats.totalBytes + optimizedFile.size > CUSTOM_IMAGE_MAX_TOTAL_BYTES) {
        throw new LocalizedError('gallery.storageFull');
    }

    const now = Date.now();
    const record = {
        id: generateId(),
        name: normalizeName(optimizedFile.name || file.name),
        mimeType: optimizedFile.type || file.type || 'image/webp',
        size: optimizedFile.size,
        createdAt: now,
        blob: optimizedFile
    };

    await withStore('readwrite', (store, resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new LocalizedError('gallery.uploadFailed'));
    });

    return toPublicRecord(record);
}

export async function removeCustomImage(recordId) {
    await withStore('readwrite', (store, resolve, reject) => {
        const request = store.delete(recordId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new LocalizedError('gallery.deleteFailed'));
    });
}

export async function getCustomImageStats() {
    const records = await readAllRawRecords();
    return calculateStats(records);
}

