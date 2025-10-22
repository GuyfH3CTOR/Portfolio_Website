// Simple CSV loader + parser (handles quoted fields) and file-input fallback

// parse CSV text -> { header: [...], rows: [ {col: val, ...}, ... ] }
function parseCSV(text) {
  // remove BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let i = 0, cur = '', inQuotes = false, row = [], ch;
  while (i <= text.length) {
    ch = text[i++] || '\n'; // treat EOF as newline
    if (inQuotes) {
      if (ch === '"') {
        if (text[i] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\r') { /* ignore */ }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
  }

  if (rows.length === 0) return { header: [], rows: [] };
  const header = rows.shift().map(h => h.trim());
  const objects = rows.map(r => {
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] || '').trim();
    return obj;
  });
  return { header, rows: objects };
}

// load CSV by path (relative to site root). Use cache-busting to avoid stale responses.
async function loadCSV(path, { noCache = true } = {}) {
  // append a timestamp query param to bypass caches when requested
  const url = noCache ? `${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}` : path;
  const res = await fetch(url, { cache: noCache ? 'no-store' : 'default' });
  if (!res.ok) throw new Error('Failed to fetch CSV: ' + res.status + ' ' + path);
  const text = await res.text();
  return parseCSV(text);
}

// Expose utilities to the window for the page to reuse
window.parseCSV = parseCSV;
window.loadCSV = loadCSV;
