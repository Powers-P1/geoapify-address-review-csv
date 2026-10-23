// Strict comma-separated UTF-8 CSV. Quoted newlines and escaped quotes are supported.
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  if (text.includes('\0')) throw new Error('CSV contains NUL');
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const pushRow = () => {
    // The first collected row is the header; every subsequent record counts.
    if (rows.length > 10_000) throw new Error('Input exceeds 10000 data record limit');
    pushCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === ',') pushCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Malformed CSV quoting');
    else cell += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length || closed) pushRow();
  if (!rows.length) throw new Error('CSV header is required');
  const headers = rows.shift();
  if (headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) throw new Error('CSV headers must be nonempty and unique');
  const records = rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV record ${index + 2} has the wrong field count`);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
  return { headers, records };
}

function safeCell(value) {
  let s = String(value ?? '');
  // Mitigate formula injection when opened by spreadsheet software, including whitespace prefixes.
  if (/^[\s]*[=+@-]/u.test(s) || /^[\t\r\n]/u.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function writeCsv(headers, records) {
  return [headers, ...records.map(r => headers.map(h => r[h]))]
    .map(row => row.map(safeCell).join(','))
    .join('\r\n') + '\r\n';
}
