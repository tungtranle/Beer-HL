const fs = require('fs');
const file = 'web/src/app/dashboard/reconciliation/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Function to fix double-encoded UTF-8
// Double-encoding: UTF-8 bytes interpreted as Latin-1, then re-encoded to UTF-8
function fixDoubleEncoding(str) {
  try {
    // Convert string to Buffer using latin1 (preserving byte values)
    const buf = Buffer.from(str, 'latin1');
    // Try to decode as UTF-8
    const decoded = buf.toString('utf8');
    // Check if result looks like valid Vietnamese (no replacement chars)
    if (!decoded.includes('\ufffd') && decoded.length <= str.length) {
      return decoded;
    }
  } catch (e) {}
  return str;
}

// Process string segments that look garbled (contain characters > 0x7F in sequences typical of double-encoded UTF-8)
// Look for patterns like Ã followed by another char (typical double-encoded pattern)
const lines = content.split('\n');
let fixCount = 0;
const fixedLines = lines.map((line, i) => {
  // Only fix lines that contain garbled-looking patterns
  if (!/[\xC0-\xDF][\x80-\xBF]/.test(line) && !/Ã/.test(line)) return line;
  
  // Extract text content (between > and <, or in quotes)
  const fixed = line.replace(/(>)([^<]+)(<)/g, (m, p1, text, p3) => {
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;
    return p1 + decoded + p3;
  }).replace(/(['"])([^'"]{2,})(['"])/g, (m, q1, text, q2) => {
    if (q1 !== q2) return m;
    // Don't fix class names, URLs, etc
    if (/^(bg-|text-|px-|py-|hover:|border|rounded|shadow|flex|gap|font|divide|w-|h-|max-|min-|animate|overflow|fixed|inset|z-|items-|justify-)/.test(text)) return m;
    if (/^[a-z_-]+$/.test(text)) return m; // all ascii lowercase with dashes
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;
    return q1 + decoded + q2;
  }).replace(/(\{\/\*\s*)([^*]+)(\s*\*\/\})/g, (m, p1, text, p3) => {
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;
    return p1 + decoded + p3;
  }).replace(/(placeholder=")([^"]+)(")/g, (m, p1, text, p3) => {
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;
    return p1 + decoded + p3;
  }).replace(/(title=")([^"]+)(")/g, (m, p1, text, p3) => {
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;  
    return p1 + decoded + p3;
  }).replace(/(alert\(')([^']+)('\))/g, (m, p1, text, p3) => {
    const decoded = fixDoubleEncoding(text);
    if (decoded !== text) fixCount++;
    return p1 + decoded + p3;
  });
  
  return fixed;
});

const result = fixedLines.join('\n');
fs.writeFileSync(file, result, 'utf8');
console.log(`Applied ${fixCount} text fixes`);

// Final check
const remaining = result.split('\n');
remaining.forEach((l, i) => {
  if (/[ÃÄÆ]/.test(l) && !/className|import |\/\/|â/.test(l)) {
    console.log(`Still garbled line ${i+1}: ${l.trim().substring(0, 80)}`);
  }
});
