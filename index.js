// fetch-vk-video-comments.mjs
import fs from 'node:fs';

// Ленивая загрузка переменных из .env (без зависимости dotenv)
function loadEnvFile() {
  try {
    const content = fs.readFileSync('.env', 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    });
  } catch { }
}

loadEnvFile();

const VK_TOKEN = process.env.VK_TOKEN;       // ваш токен (обязателен)
const DEFAULT_OWNER_ID = -204749195;         // значения по умолчанию (можно переопределить флагами)
const DEFAULT_VIDEO_ID = 456243585;
const API = 'https://api.vk.com/method';
const API_VERSION = '5.199';

if (!VK_TOKEN) {
  console.error('Отсутствует VK_TOKEN. Укажите пользовательский токен (scope: video, offline) или токен сообщества с правом "video".');
  process.exit(1);
}

function parseVideoUrl(url) {
  // Ищем шаблон video<owner>_<video>, например: video-204749195_456243585
  const m = String(url).match(/video(-?\d+)_([0-9]+)/);
  if (!m) return {};
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

function parseArgs(argv) {
  const getVal = (nameVariants) => {
    for (const name of nameVariants) {
      const idx = argv.indexOf(name);
      if (idx !== -1) return argv[idx + 1];
      const withEq = argv.find(a => a.startsWith(name + '='));
      if (withEq) return withEq.split('=')[1];
    }
    return undefined;
  };

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Использование: node index.js [--url <vk_video_url>] [--owner_id <id>] [--video_id <id>] [--out <file>]\n\n` +
      `Параметры:\n` +
      `  --url           Ссылка вида https://vk.com/video-<owner>_<video>\n` +
      `  --owner_id      Идентификатор владельца (отрицательный для сообщества)\n` +
      `  --video_id      Идентификатор видео\n` +
      `  --out           Путь к файлу результата (по умолчанию vk-video-comments.json)\n` +
      `\nЕсли указана --url, owner_id/video_id можно не передавать.\nДокументация API: https://dev.vk.com/ru/method/video.getComments`);
    process.exit(0);
  }

  const url = getVal(['--url']);
  const fromUrl = url ? parseVideoUrl(url) : {};
  const ownerIdStr = getVal(['--owner_id', '--owner-id']);
  const videoIdStr = getVal(['--video_id', '--video-id']);
  const outPath = getVal(['--out']) || 'vk-video-comments.json';

  const ownerId = ownerIdStr !== undefined ? Number(ownerIdStr) : (fromUrl.ownerId ?? DEFAULT_OWNER_ID);
  const videoId = videoIdStr !== undefined ? Number(videoIdStr) : (fromUrl.videoId ?? DEFAULT_VIDEO_ID);

  if (!Number.isFinite(ownerId) || !Number.isFinite(videoId)) {
    console.error('Некорректные owner_id/video_id. Передайте --url или оба параметра --owner_id и --video_id.');
    process.exit(1);
  }

  return { ownerId, videoId, outPath };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, params) {
  const query = new URLSearchParams({
    v: API_VERSION,
    access_token: VK_TOKEN,
    ...params
  });
  const res = await fetch(`${API}/${method}?${query.toString()}`);
  const json = await res.json();
  if (json.error) {
    if (json.error.error_code === 28) {
      throw new Error('28: Метод недоступен с сервисным ключом. Используйте пользовательский access_token со scope "video,offline" или токен сообщества с правом "video".');
    }
    if (json.error.error_code === 801) {
      throw new Error('801: Комментарии к этому видео закрыты.');
    }
    throw new Error(`${json.error.error_code}: ${json.error.error_msg}`);
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

async function fetchAllTopLevel(ownerId, videoId) {
  const all = [];
  let offset = 0;
  while (true) {
    const resp = await call('video.getComments', {
      owner_id: ownerId,
      video_id: videoId,
      count: 100,
      offset,
      sort: 'asc',
      need_likes: 1,
      extended: 1,
      fields: 'first_name,last_name,domain'
    });
    const profilesMap = indexBy(resp.profiles, 'id');
    const groupsMap = indexBy(resp.groups, 'id');

    const batch = resp.items.map(c => ({
      raw: c,
      norm: normalizeComment(c, profilesMap, groupsMap)
    }));
    all.push(...batch);
    if (resp.items.length < 100) break;
    offset += resp.items.length;
    await sleep(350); // ограничение 3 запроса/сек.
  }
  return all;
}

async function fetchThread(ownerId, videoId, parentId) {
  const replies = [];
  let offset = 0;
  while (true) {
    const resp = await call('video.getComments', {
      owner_id: ownerId,
      video_id: videoId,
      comment_id: parentId,
      count: 100,
      offset,
      sort: 'asc',
      need_likes: 1,
      extended: 1,
      fields: 'first_name,last_name,domain'
    });
    const profilesMap = indexBy(resp.profiles, 'id');
    const groupsMap = indexBy(resp.groups, 'id');
    replies.push(...resp.items.map(c => normalizeComment(c, profilesMap, groupsMap)));
    if (resp.items.length < 100) break;
    offset += resp.items.length;
    await sleep(350);
  }
  return replies;
}

(async () => {
  try {
    const { ownerId, videoId, outPath } = parseArgs(process.argv.slice(2));
    const topLevel = await fetchAllTopLevel(ownerId, videoId);
    for (const c of topLevel) {
      const threadCount = c.raw.thread?.count ?? 0;
      if (threadCount > (c.raw.thread?.items?.length || 0)) {
        c.norm.replies = await fetchThread(ownerId, videoId, c.raw.id);
      } else {
        const profilesMap = indexBy(c.raw.thread?.profiles, 'id');
        const groupsMap = indexBy(c.raw.thread?.groups, 'id');
        c.norm.replies = (c.raw.thread?.items || []).map(x => normalizeComment(x, profilesMap, groupsMap));
      }
      delete c.raw;
    }
    const result = {
      owner_id: ownerId,
      video_id: videoId,
      total_top_level: topLevel.length,
      comments: topLevel.map(x => x.norm)
    };
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`✔ Готово: ${outPath}`);
  } catch (e) {
    console.error('API error:', e.message);
    process.exit(1);
  }
})();
