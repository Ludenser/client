const API = "https://api.vk.com/method";
const API_VERSION = "5.199";

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonpRequest(url, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const cbName = `vkcb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const sep = url.includes("?") ? "&" : "?";
        const src = `${url}${sep}callback=${cbName}`;
        let timeoutId;
        function cleanup() {
            try { delete window[cbName]; } catch { }
            if (script.parentNode) script.parentNode.removeChild(script);
            if (timeoutId) clearTimeout(timeoutId);
        }
        window[cbName] = (data) => { cleanup(); resolve(data); };
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onerror = () => { cleanup(); reject(new Error("JSONP load error")); };
        document.head.appendChild(script);
        timeoutId = setTimeout(() => { cleanup(); reject(new Error("JSONP timeout")); }, timeoutMs);
    });
}

export async function vkCallClient({ token, method, params }) {
    const query = new URLSearchParams({ v: API_VERSION, access_token: token, ...params });
    const url = `${API}/${method}?${query.toString()}`;
    try {
        const res = await fetch(url, { method: "GET", credentials: "omit" });
        const json = await res.json();
        if (json.error) throw new Error(`${json.error.error_code}: ${json.error.error_msg}`);
        return json.response;
    } catch (e) {
        const data = await jsonpRequest(url);
        if (data.error) throw new Error(`${data.error.error_code}: ${data.error.error_msg}`);
        return data.response;
    }
}

function normalizeComment(c, profilesMap, groupsMap) {
    const from_id = c.from_id;
    let from;
    if (from_id > 0) {
        const p = profilesMap.get(from_id);
        from = p ? { id: p.id, name: `${p.first_name} ${p.last_name}`, screen_name: p.domain } : { id: from_id };
    } else {
        const g = groupsMap.get(-from_id);
        from = g ? { id: -g.id, name: g.name, screen_name: g.screen_name } : { id: from_id };
    }
    return {
        id: c.id,
        parent_id: c.parent_stack?.[0] ?? null,
        from,
        date_iso: new Date(c.date * 1000).toISOString(),
        text: c.text || "",
        likes: c.likes?.count ?? 0,
        attachments: (c.attachments || []).map((a) => ({ type: a.type })),
        replies: [],
    };
}

export async function fetchAllCommentsClient({ token, ownerId, videoId }) {
    const all = [];
    let offset = 0;
    while (true) {
        const resp = await vkCallClient({
            token, method: "video.getComments", params: {
                owner_id: ownerId,
                video_id: videoId,
                count: 100,
                offset,
                sort: "asc",
                need_likes: 1,
                extended: 1,
                fields: "first_name,last_name,domain"
            }
        });
        const profiles = new Map((resp.profiles || []).map((p) => [p.id, p]));
        const groups = new Map((resp.groups || []).map((g) => [g.id, g]));
        const batch = (resp.items || []).map((c) => ({ raw: c, norm: normalizeComment(c, profiles, groups) }));
        all.push(...batch);
        if ((resp.items || []).length < 100) break;
        offset += resp.items.length;
        await sleep(350);
    }
    for (const c of all) {
        const threadCount = c.raw.thread?.count ?? 0;
        if (threadCount > (c.raw.thread?.items?.length || 0)) {
            c.norm.replies = await fetchThreadClient({ token, ownerId, videoId, parentId: c.raw.id });
        } else {
            const profiles = new Map((c.raw.thread?.profiles || []).map((p) => [p.id, p]));
            const groups = new Map((c.raw.thread?.groups || []).map((g) => [g.id, g]));
            c.norm.replies = (c.raw.thread?.items || []).map((x) => normalizeComment(x, profiles, groups));
        }
        delete c.raw;
    }
    return {
        owner_id: ownerId,
        video_id: videoId,
        total_top_level: all.length,
        comments: all.map((x) => x.norm),
    };
}

async function fetchThreadClient({ token, ownerId, videoId, parentId }) {
    const replies = [];
    let offset = 0;
    while (true) {
        const resp = await vkCallClient({
            token, method: "video.getComments", params: {
                owner_id: ownerId,
                video_id: videoId,
                comment_id: parentId,
                count: 100,
                offset,
                sort: "asc",
                need_likes: 1,
                extended: 1,
                fields: "first_name,last_name,domain"
            }
        });
        const profiles = new Map((resp.profiles || []).map((p) => [p.id, p]));
        const groups = new Map((resp.groups || []).map((g) => [g.id, g]));
        replies.push(...(resp.items || []).map((c) => normalizeComment(c, profiles, groups)));
        if ((resp.items || []).length < 100) break;
        offset += resp.items.length;
        await sleep(350);
    }
    return replies;
}
