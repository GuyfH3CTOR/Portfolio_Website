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

// load CSV by path (relative to site root). Requires serving via HTTP (not file://)
async function loadCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch CSV: ' + res.status + ' ' + path);
  const text = await res.text();
  return parseCSV(text);
}

// parse a File object (from <input type="file">) via FileReader
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(parseCSV(String(r.result)));
    r.onerror = reject;
    r.readAsText(file, 'utf-8');
  });
}

// Expose utilities to the window for the page to reuse
window.parseCSV = parseCSV;
window.parseCSVFile = parseCSVFile;
window.loadCSV = loadCSV;

// Try to load CSV from a list of candidate paths; returns parsed or null
async function tryLoadAllCSV(paths) {
  const CSV_PATHS = paths || [
    'portfolio.csv' // prioritize this file
  ];

  for (const p of CSV_PATHS) {
    try {
      const parsed = await loadCSV(p);
      console.log('CSV loaded from', p, parsed.header, parsed.rows.length);
      return parsed;
    } catch (err) {
      // fetch failed -> try next path
      console.warn('CSV fetch failed for', p, err && err.message);
    }
  }
  return null;
}
window.tryLoadAllCSV = tryLoadAllCSV;

/**
 * Loads a CSV, finds the row where 'name' column matches nameValue,
 * and sets element text by mapping {csvColumn: elementId}
 * Example: loadCSVAndSetElements('portfolio.csv', 'Project 1', {title: 'titleEl', desc: 'descEl'})
 */
async function loadCSVAndSetElements(csvPath, nameValue, mapping) {
  try {
    const parsed = await loadCSV(csvPath);
    if (!parsed || !parsed.rows) return;

    // new: log and search rows with a loop (exact then case-insensitive)
    console.log('Parsed rows count:', parsed.rows.length);
    let row = null;

    // exact match loop
    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      if ((r.name || '').trim() === nameValue) {
        row = r;
        break;
      }
    }

    // fallback: case-insensitive match
    if (!row) {
      const target = (nameValue || '').trim().toLowerCase();
      for (let i = 0; i < parsed.rows.length; i++) {
        const r = parsed.rows[i];
        if ((r.name || '').trim().toLowerCase() === target) {
          row = r;
          break;
        }
      }
    }

    if (!row) {
      console.warn('No row found matching nameValue:', nameValue);
      return;
    }

    for (const [csvCol, elId] of Object.entries(mapping)) {
      const el = document.getElementById(elId);
      if (el && row[csvCol] !== undefined) el.textContent = row[csvCol];
    }
  } catch (e) {
    console.error('loadCSVAndSetElements error:', e);
  }
}
window.loadCSVAndSetElements = loadCSVAndSetElements;

// Example usage: load from disk (when served) or fall back to file input
(async function initCSV() {
  // try fetch first (auto-run)
  try {
    const parsed = await tryLoadAllCSV();
    if (parsed) {
      window.__CSV = parsed;
      if (typeof window.onCSVLoaded === 'function') window.onCSVLoaded(parsed);
      console.log('CSV loaded on init', parsed.header, parsed.rows.length);
      return;
    }
  } catch (e) {
    console.error('CSV auto-load error', e);
  }

  // fallback: wait for user to select a file if there's an input#fileInput
  const input = document.querySelector('#fileInput');
  if (input) {
    input.addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      try {
        const parsed = await parseCSVFile(file);
        console.log('CSV parsed from file input', parsed.header, parsed.rows.length);
        window.__CSV = parsed;
        if (typeof window.onCSVLoaded === 'function') window.onCSVLoaded(parsed);
      } catch (e) { console.error(e); }
    });
    return;
  }

  console.warn('CSV not loaded automatically. Serve site via HTTP so fetch() can load the CSV, or use the file input to pick the CSV file.');
})();