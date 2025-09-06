export function buildAuthUrl(appId, scope = 'video') {
    const redirect = 'https://oauth.vk.com/blank.html';
    const params = new URLSearchParams({
        client_id: appId,
        display: 'page',
        redirect_uri: redirect,
        scope,
        response_type: 'token',
        v: '5.199'
    });
    return `https://oauth.vk.com/authorize?${params.toString()}`;
}

export function parseVideoUrl(url) {
    const m = String(url).match(/video(-?\d+)_([0-9]+)/);
    if (!m) return {};
    return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

export function tryExtractToken(input) {
    try {
        const str = String(input || '');
        const fromHash = new URLSearchParams(str.replace(/^.*#/, ''));
        const t1 = fromHash.get('access_token');
        if (t1) return t1;
        if (/^vk\d?\./i.test(str) || str.length > 50) return str.trim();
        return '';
    } catch {
        return '';
    }
}

export function detectRunMode() {
    try {
        const h = window.location.hostname;
        return h && h !== 'localhost' && h !== '127.0.0.1' ? 'client' : 'server';
    } catch {
        return 'server';
    }
}
