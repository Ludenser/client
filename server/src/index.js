import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllComments, toCsv } from './vk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
});

// POST /api/video/comments  { ownerId, videoId }  — токен в Authorization: Bearer <token>
app.post('/api/video/comments', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'missing_token' });

        const { ownerId, videoId } = req.body || {};
        if (!Number.isFinite(ownerId) || !Number.isFinite(videoId)) {
            return res.status(400).json({ error: 'bad_params', message: 'ownerId/videoId required' });
        }

        const result = await fetchAllComments({ token, ownerId, videoId });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'server_error', message: e.message });
    }
});

// GET /api/video/comments.csv?ownerId=..&videoId=..  — токен в Authorization
app.get('/api/video/comments.csv', async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return res.status(401).json({ error: 'missing_token' });

        const ownerId = Number(req.query.ownerId);
        const videoId = Number(req.query.videoId);
        if (!Number.isFinite(ownerId) || !Number.isFinite(videoId)) {
            return res.status(400).json({ error: 'bad_params' });
        }

        const result = await fetchAllComments({ token, ownerId, videoId });
        const csv = toCsv(result.comments);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="vk-comments-${ownerId}_${videoId}.csv"`);
        res.send('\uFEFF' + csv);
    } catch (e) {
        res.status(500).json({ error: 'server_error', message: e.message });
    }
});

// Статика собранного фронта (если есть)
const distDir = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
