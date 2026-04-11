import { BackgroundController } from './controller.js';

export function initBackgroundSystem(options = {}) {
    return new BackgroundController(options);
}

