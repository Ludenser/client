// export JSON comments to CSV for Excel
import fs from 'node:fs';

function parseArgs(argv) {
    const get = (names, def) => {
        for (const n of names) {
            const i = argv.indexOf(n);
            if (i !== -1 && argv[i + 1]) return argv[i + 1];
            const withEq = argv.find(a => a.startsWith(n + '='));
            if (withEq) return withEq.split('=')[1];
        }
        return def;
    };
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log('Использование: node export.js [--in comments.json] [--out comments.csv] [--delimiter ;]');
        process.exit(0);
    }
    const input = get(['--in', '--input'], 'comments.json');
    const output = get(['--out', '--output'], 'comments.csv');
    const delimiter = get(['--delimiter', '-d'], ';'); // ; лучше открывается в RU Excel
    return { input, output, delimiter };
}

function csvEscape(value, delimiter) {
    if (value === null || value === undefined) return '';
    let s = String(value);
    // Заменим переводы строк для удобства просмотра в Excel
    s = s.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    const mustQuote = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
    if (s.includes('"')) s = s.replace(/"/g, '""');
    return mustQuote ? `"${s}"` : s;
}

function flattenComments(rootComments) {
    const rows = [];
    const walk = (comment, level) => {
        const attachments = comment.attachments || [];
        rows.push({
            comment_id: comment.id,
            parent_id: comment.parent_id ?? '',
            reply_level: level,
            author_id: comment.from?.id ?? '',
            author_name: comment.from?.name ?? '',
            author_screen_name: comment.from?.screen_name ?? '',
            date_iso: comment.date_iso ?? '',
            text: comment.text ?? '',
            likes: comment.likes ?? 0,
            attachments_count: attachments.length,
            attachment_types: attachments.map(a => a.type).join('|')
        });
        (comment.replies || []).forEach(r => walk(r, level + 1));
    };
    rootComments.forEach(c => walk(c, 0));
    return rows;
}

function writeCsv(rows, output, delimiter) {
    const headers = [
        'comment_id', 'parent_id', 'reply_level', 'author_id', 'author_name',
        'author_screen_name', 'date_iso', 'text', 'likes', 'attachments_count', 'attachment_types'
    ];
    const lines = [];
    lines.push(headers.join(delimiter));
    for (const row of rows) {
        const line = headers.map(h => csvEscape(row[h], delimiter)).join(delimiter);
        lines.push(line);
    }
    const csvContent = '\uFEFF' + lines.join('\n'); // BOM для Excel
    fs.writeFileSync(output, csvContent, 'utf-8');
}

(function main() {
    try {
        const { input, output, delimiter } = parseArgs(process.argv.slice(2));
        const json = JSON.parse(fs.readFileSync(input, 'utf-8'));
        const comments = Array.isArray(json?.comments) ? json.comments : [];
        const rows = flattenComments(comments);
        writeCsv(rows, output, delimiter);
        console.log(`✔ Экспортировано: ${rows.length} строк → ${output}`);
    } catch (e) {
        console.error('Export error:', e.message);
        process.exit(1);
    }
})();
