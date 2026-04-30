const fs = require('fs');
const file = 'd:/Beer HL/bhl-oms/web/src/app/dashboard/reconciliation/page.tsx';

// Read as raw bytes then decode as latin1 to see the original bytes
const buf = fs.readFileSync(file);
let c = buf.toString('utf8');

// Map of garbled → correct Vietnamese
const replacements = [
  // Already partially fixed in earlier edits, so some may not match
  ['Tất cả', 'Tất cả'], // noop to verify
  ['Chuyến xe', 'Chuyến xe'], // noop
];

// Remaining garbled strings found in grep
const fixes = {
  'Táº¥t cáº£': 'Tất cả',
  'Chuyáº¿n xe': 'Chuyến xe',
  'Loáº¡i': 'Loại',
  'Ká»³ vá»ng': 'Kỳ vọng',
  'Thá»±c táº¿': 'Thực tế',
  'ChÃªnh lá»\u2021ch': 'Chênh lệch',
  'Tráº¡ng thÃ¡i': 'Trạng thái',
  'NgÃ y': 'Ngày',
  'MÃ´ táº£': 'Mô tả',
  'HÃ nh Ä\u0091á»\u0099ng': 'Hành động',
  'LÆ°u': 'Lưu',
  'Há»§y': 'Hủy',
  'nÃ o': 'nào',
  'ÄÆ¡n hÃ ng': 'Đơn hàng',
  'sáº¯p quÃ¡ háº¡n': 'sắp quá hạn',
};

let count = 0;
for (const [from, to] of Object.entries(fixes)) {
  if (c.includes(from)) {
    c = c.split(from).join(to);
    count++;
    console.log(`Fixed: "${from}" -> "${to}"`);
  }
}

fs.writeFileSync(file, c, 'utf8');
console.log(`\nApplied ${count} fixes`);

// Verify remaining garbled chars
const remaining = c.match(/[Ã¡Ã³Ã£Ã¢Ã©Ã¨Ã´Ã¬Ã¼Ã¹Ã°Ä]/g);
if (remaining) {
  console.log(`WARNING: ${remaining.length} potentially garbled chars remaining`);
}
