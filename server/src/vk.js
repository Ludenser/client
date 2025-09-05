const API = 'https://api.vk.com/method';
const API_VERSION = '5.199';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function vkCall({ token, method, params }) {
    const query = new URLSearchParams({ v: API_VERSION, access_token: token, ...params });
    const res = await fetch(`${API}/${method}?${query.toString()}`);
    const json = await res.json();
    if (json.error) {
        const code = json.error.error_code;
        if (code === 28) throw new Error('Метод недоступен с сервисным ключом');
        if (code === 801) throw new Error('Комментарии к этому видео закрыты');
        throw new Error(`${code}: ${json.error.error_msg}`);
    }
    return json.response;
}

function indexBy(arr, key = 'id') {
    const map = new Map();
    (arr || []).forEach(item => map.set(item[key], item));
    return map;
}

function authorLookup(from_id, profilesMap, groupsMap) {
    if (from_id > 0) {
        const p = profilesMap.get(from_id);
        return p ? { id: p.id, name: `${p.first_name} ${p.last_name}`, screen_name: p.domain } : { id: from_id };
    }
    const g = groupsMap.get(-from_id);
    return g ? { id: -g.id, name: g.name, screen_name: g.screen_name } : { id: from_id };
}

function normalizeComment(c, profilesMap, groupsMap) {
    return {
        id: c.id,
        parent_id: c.parent_stack?.[0] ?? null,
        from: authorLookup(c.from_id, profilesMap, groupsMap),
        date_iso: new Date(c.date * 1000).toISOString(),
        text: c.text || '',
        likes: c.likes?.count ?? 0,
        attachments: (c.attachments || []).map(a => ({ type: a.type })),
        replies: []
    };
}

export async function fetchAllComments({ token, ownerId, videoId }) {
    const all = [];
    let offset = 0;
    while (true) {
        const resp = await vkCall({
            token, method: 'video.getComments', params: {
                owner_id: ownerId,
                video_id: videoId,
                count: 100,
                offset,
                sort: 'asc',
                need_likes: 1,
                extended: 1,
                fields: 'first_name,last_name,domain'
            }
        });
        const profilesMap = indexBy(resp.profiles, 'id');
        const groupsMap = indexBy(resp.groups, 'id');
        const batch = (resp.items || []).map(c => ({ raw: c, norm: normalizeComment(c, profilesMap, groupsMap) }));
        all.push(...batch);
        if ((resp.items || []).length < 100) break;
        offset += resp.items.length;
        await sleep(350);
    }

    for (const c of all) {
        const threadCount = c.raw.thread?.count ?? 0;
        if (threadCount > (c.raw.thread?.items?.length || 0)) {
            c.norm.replies = await fetchThread({ token, ownerId, videoId, parentId: c.raw.id });
        } else {
            const profilesMap = indexBy(c.raw.thread?.profiles, 'id');
            const groupsMap = indexBy(c.raw.thread?.groups, 'id');
            c.norm.replies = (c.raw.thread?.items || []).map(x => normalizeComment(x, profilesMap, groupsMap));
        }
        delete c.raw;
    }

    return {
        owner_id: ownerId,
        video_id: videoId,
        total_top_level: all.length,
        comments: all.map(x => x.norm)
    };
}

async function fetchThread({ token, ownerId, videoId, parentId }) {
    const replies = [];
    let offset = 0;
    while (true) {
        const resp = await vkCall({
            token, method: 'video.getComments', params: {
                owner_id: ownerId,
                video_id: videoId,
                comment_id: parentId,
                count: 100,
                offset,
                sort: 'asc',
                need_likes: 1,
                extended: 1,
                fields: 'first_name,last_name,domain'
            }
        });
        const profilesMap = indexBy(resp.profiles, 'id');
        const groupsMap = indexBy(resp.groups, 'id');
        replies.push(...(resp.items || []).map(c => normalizeComment(c, profilesMap, groupsMap)));
        if ((resp.items || []).length < 100) break;
        offset += resp.items.length;
        await sleep(350);
    }
    return replies;
}

export function toCsv(comments, delimiter = ';') {
    const headers = [
        'comment_id', 'parent_id', 'reply_level', 'author_id', 'author_name',
        'author_screen_name', 'date_iso', 'text', 'likes', 'attachments_count', 'attachment_types'
    ];
    const lines = [headers.join(delimiter)];
    const escape = (v) => {
        if (v === null || v === undefined) return '';
        let s = String(v).replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
        const must = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
        if (s.includes('"')) s = s.replace(/"/g, '""');
        return must ? `"${s}"` : s;
    };
    const walk = (c, level) => {
        const attachments = c.attachments || [];
        const row = {
            comment_id: c.id,
            parent_id: c.parent_id ?? '',
            reply_level: level,
            author_id: c.from?.id ?? '',
            author_name: c.from?.name ?? '',
            author_screen_name: c.from?.screen_name ?? '',
            date_iso: c.date_iso ?? '',
            text: c.text ?? '',
            likes: c.likes ?? 0,
            attachments_count: attachments.length,
            attachment_types: attachments.map(a => a.type).join('|')
        };
        lines.push(headers.map(h => escape(row[h])).join(delimiter));
        (c.replies || []).forEach(r => walk(r, level + 1));
    };
    (comments || []).forEach(c => walk(c, 0));
    return lines.join('\n');
}
