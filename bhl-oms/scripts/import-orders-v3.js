// Import 105 orders from "Don hang test.xlsx" → SQL for test portal SC-10
// Each order = 1 product. Heavy orders split into shipments ≤ 7500kg (fit 8T truck).
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('D:/New folder/OneDrive/Desktop/Don hang test.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(ws, {header:1});

const PRODUCT_MAP = {
  'Bia Hạ Long Lon 330ml (24 lon/thùng)': {sku:'BHL-LON-330', weight:8.5, price:180000},
  'Bia Hạ Long Chai 450ml (20 chai/két)': {sku:'BHL-CHAI-450', weight:14.0, price:250000},
  'Bia Hạ Long Chai 330ml (20 chai/két)': {sku:'BHL-CHAI-355', weight:15.0, price:250000},
  'Bia Hạ Long Keg 30 Lít':              {sku:'BHL-DRAFT-30', weight:32.0, price:800000},
  'Bia HL Keg 30L':                       {sku:'BHL-DRAFT-30', weight:32.0, price:800000},
  'Bia Hạ Long PET 2 Lít':               {sku:'NGK-CHANH-330', weight:25.2, price:180000},
};

// NPP name → customer code mapping
const NPP_MAP = {
  // Exact name matches (no regex code in name)
  'Khu vực Bắc Giang (nhiều NPP)': 'BG-112',
  'Khu vực Bắc Giang': 'BG-112',
  'Khu vực Bắc Ninh (nhiều NPP)': 'BN-24',
  'Khu vực Bắc Ninh': 'BN-24',
  'Nội bộ Công ty Bia Hạ Long': 'QN-HH',
  'Nội bộ Cty Bia Hạ Long': 'QN-HH',
  'Khu vực Hải Dương (nhiều NPP)': 'HD-70',
  'Khu vực Hải Dương': 'HD-70',
  'Khu vực Hải Phòng (nhiều NPP)': 'HP-4745',
  'Khu vực Hải Phòng': 'HP-4745',
  'Cty TNHH TMTH và DV Hằng Hiền': 'QN-HH2',
  'Cty TNHH MTV TM Hồng Hải HL': 'QN-HH',
  'Vũ Minh Chung-NT6BC-115': 'NT6BC-115',
  'Khu vực Nam Định (nhiều NPP)': 'NĐ-4766',
  'Khu vực Nam Định': 'NĐ-4766',
  'Khu vực Nam Định + Ninh Bình': 'NĐ-4767',
  'KV Nam Định + Ninh Bình': 'NĐ-4767',
  'Khu vực Thái Bình (nhiều NPP)': 'TB-125',
  'Khu vực Thái Bình': 'TB-125',
  'Cty TNHH NN quốc tế Thái Nguyên': 'QN-TN',
  'Cty TNHH NN QT Thái Nguyên': 'QN-TN',
  'Khu vực Thái Nguyên': 'TN-4793',
  'KV Thái Nguyên': 'TN-4793',
};

const codeRegex = /\b([A-Z]{1,5}\d?-\d{1,4}(?:-\d{1,3})?)\b/i;

function resolveCustomerCode(nppName) {
  // 1. Exact name match
  if (NPP_MAP[nppName]) return NPP_MAP[nppName];
  // 2. Regex code in name (e.g. "Tạ Hữu Bản-QY-121")
  const m = nppName.match(codeRegex);
  if (m) return m[1];
  // 3. Substring check for partial matches
  for (const [key, code] of Object.entries(NPP_MAP)) {
    if (nppName.includes(key) || key.includes(nppName)) return code;
  }
  console.warn('UNMAPPED NPP:', nppName);
  return 'QN-HH'; // fallback
}

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

// Parse orders
const orders = [];
for (let i = 4; i < d.length; i++) {
  const r = d[i];
  if (!r[0] || !String(r[0]).startsWith('DH-')) continue;
  const code = String(r[0]).trim();
  const npp = String(r[2] || '').trim();
  const product = String(r[5] || '').trim();
  const qty = r[6] || 0;
  const p = PRODUCT_MAP[product];
  if (!p) { console.warn('Unknown product:', product, 'in', code); continue; }
  const custCode = resolveCustomerCode(npp);
  const weight = p.weight * qty;
  const amount = p.price * qty;
  orders.push({ code, custCode, npp, sku: p.sku, qty, weight, amount, unitWeight: p.weight, unitPrice: p.price });
}

console.log(`Parsed ${orders.length} orders`);

// Check max weight
const maxW = Math.max(...orders.map(o => o.weight));
const minW = Math.min(...orders.map(o => o.weight));
console.log(`Weight range: ${minW.toFixed(0)}kg - ${maxW.toFixed(0)}kg`);

// Generate SQL
const MAX_SHIP_KG = 7500; // fit 8T truck
const lines = [];
lines.push('BEGIN;');
lines.push('-- Import 105 orders from Don hang test.xlsx (13/06 data)');
lines.push('-- Each order = 1 product. Heavy orders split into shipments <= 7500kg.');
lines.push('');

let shipIdx = 0;
let totalShipments = 0;

for (let i = 0; i < orders.length; i++) {
  const o = orders[i];
  const seq = String(i + 1).padStart(3, '0');

  // How many shipments for this order?
  let numShips = 1;
  if (o.weight > MAX_SHIP_KG) {
    numShips = Math.ceil(o.weight / MAX_SHIP_KG);
  }

  lines.push(`-- ${o.code} | ${o.custCode} | ${o.sku} x${o.qty} = ${o.weight.toFixed(0)}kg → ${numShips} ship`);
  lines.push('DO $$');
  lines.push('DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;');
  lines.push('BEGIN');
  lines.push(`  SELECT id INTO v_cid FROM customers WHERE code = ${q(o.custCode)};`);
  lines.push(`  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', ${q(o.custCode)}; END IF;`);
  lines.push(`  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';`);
  lines.push(`  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;`);
  lines.push(`  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,`);
  lines.push(`    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)`);
  lines.push(`  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-${seq}',`);
  lines.push(`    v_cid, v_wid, 'confirmed', CURRENT_DATE,`);
  lines.push(`    ${o.amount}, 0, ${o.weight.toFixed(2)}, ${(o.weight / 500).toFixed(1)}, v_uid, 'passed', 'passed')`);
  lines.push(`  RETURNING id INTO v_oid;`);

  // Order item
  lines.push(`  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)`);
  lines.push(`    SELECT v_oid, id, ${o.qty}, ${o.unitPrice}, ${o.amount} FROM products WHERE sku = ${q(o.sku)};`);

  // Shipments
  const qtyPerShip = Math.floor(o.qty / numShips);
  for (let s = 0; s < numShips; s++) {
    shipIdx++;
    totalShipments++;
    const shipSeq = String(shipIdx).padStart(3, '0');
    const isLast = (s === numShips - 1);
    const shipQty = isLast ? o.qty - qtyPerShip * (numShips - 1) : qtyPerShip;
    const shipWeight = o.unitWeight * shipQty;
    const itemJson = JSON.stringify([{
      product_sku: o.sku,
      quantity: shipQty,
      weight_kg: +(shipWeight).toFixed(1)
    }]).replace(/'/g, "''");

    lines.push(`  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,`);
    lines.push(`    delivery_date, total_weight_kg, total_volume_m3, items)`);
    lines.push(`  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-${shipSeq}',`);
    lines.push(`    v_oid, v_cid, v_wid, 'pending',`);
    lines.push(`    CURRENT_DATE, ${shipWeight.toFixed(2)}, ${(shipWeight / 500).toFixed(1)}, '${itemJson}'::jsonb);`);
  }

  lines.push('END $$;');
  lines.push('');
}

// Boost stock & check-in drivers
lines.push('UPDATE stock_quants SET quantity = 500000, reserved_qty = 0;');
lines.push(`INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)`);
lines.push(`SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'`);
lines.push(`FROM drivers d WHERE d.status = 'active'`);
lines.push(`ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';`);
lines.push('COMMIT;');
lines.push(`-- Total: ${orders.length} orders, ${totalShipments} shipments (max ${MAX_SHIP_KG}kg each)`);

const outPath = path.join(__dirname, '../migrations/import_test_orders_v3.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Generated ${orders.length} orders, ${totalShipments} shipments → ${outPath}`);

// Summary stats
const totalW = orders.reduce((s, o) => s + o.weight, 0);
const custCodes = new Set(orders.map(o => o.custCode));
console.log(`Total weight: ${(totalW / 1000).toFixed(1)}T, unique NPPs: ${custCodes.size}`);
console.log('NPP codes:', [...custCodes].sort().join(', '));
