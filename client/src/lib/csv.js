export function toCsv(comments, delimiter = ';') {
    const headers = [
        'comment_id', 'parent_id', 'reply_level', 'author_id', 'author_name',
        'author_screen_name', 'date_iso', 'text', 'likes', 'attachments_count', 'attachment_types'
    ];
    const escape = (v) => {
        if (v === null || v === undefined) return '';
        let s = String(v).replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
        const must = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
        if (s.includes('"')) s = s.replace(/"/g, '""');
        return must ? `"${s}"` : s;
    };
    const lines = [headers.join(delimiter)];
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
            attachment_types: attachments.map((a) => a.type).join('|'),
        };
        lines.push(headers.map((h) => escape(row[h])).join(delimiter));
        (c.replies || []).forEach((r) => walk(r, level + 1));
    };
    (comments || []).forEach((c) => walk(c, 0));
    return lines.join('\n');
}
