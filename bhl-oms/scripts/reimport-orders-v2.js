// Re-import test orders with max 4800kg per shipment (to fit 5T trucks)
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '../../Tai lieu/Data for test.xlsx'));
const ws4 = wb.Sheets['4. Data Test 13-06'];
const d4 = XLSX.utils.sheet_to_json(ws4, {header:1});

const PRODUCT_MAP = {
  'Bia Hạ Long Lon 330ml (24 lon/thùng)': {sku:'BHL-LON-330', weight:8.5, price:180000},
  'Bia Hạ Long Chai 450ml (20 chai/két)': {sku:'BHL-CHAI-450', weight:14.0, price:250000},
  'Bia Hạ Long Chai 330ml (20 chai/két)': {sku:'BHL-CHAI-355', weight:15.0, price:250000},
  'Bia Hạ Long Keg 30 Lít':              {sku:'BHL-DRAFT-30', weight:32.0, price:800000},
  'Bia HL Keg 30L':                       {sku:'BHL-DRAFT-30', weight:32.0, price:800000},
  'Bia Hạ Long PET 2 Lít':               {sku:'NGK-CHANH-330', weight:25.2, price:180000},
};

const codeRegex = /\b([A-Z]{1,5}\d?-\d{1,4}(?:-\d{1,3})?)\b/i;
const regionFallback = {
  'Bắc Giang':'BG-112','Bắc Ninh':'BN-24','Nội bộ':'QN-HH',
  'Hải Dương':'HD-70','Hải Phòng':'HP-4745','Nam Định':'NĐ-4766',
  'NĐ + NB':'NĐ-4767','Thái Bình':'TB-125','Thái Nguyên':'TN-4793',
  'Hà Nội':'HNI-48','Quảng Ninh':'QN-HH'
};

const specialNames = {
  'Cty TNHH TMTH và DV Hằng Hiền': 'QN-HH2',
  'Cty TNHH MTV TM Hồng Hải HL': 'QN-HH',
  'Nội bộ Công ty Bia Hạ Long': 'QN-HH',
  'Cty TNHH NN quốc tế Thái Nguyên': 'QN-TN',
};

// Parse orders
const orders = [];
let current = null;
for(let i=4; i<d4.length; i++) {
  const r = d4[i];
  if(r[0] && typeof r[0]==='string' && r[0].startsWith('DH-')) {
    if(current) orders.push(current);
    current = {code:r[0], npp:r[2]||'', region:r[3]||'', trips:r[5]||1, items:[]};
  } else if(r[0] && typeof r[0]==='string' && r[0].startsWith('CHI TIẾT')) break;
  if(current && r[6] && typeof r[6]==='string' && PRODUCT_MAP[r[6]]) {
    current.items.push({product:r[6], qty:r[7]||0});
  }
}
if(current) orders.push(current);

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

const MAX_PER_SHIP = 4800;
const lines = [];
lines.push('BEGIN;');
lines.push('-- Re-import with max 4800kg per shipment');

let shipIdx = 0;
for(let i=0; i<orders.length; i++) {
  const o = orders[i];
  let custCode;
  const m = o.npp.match(codeRegex);
  if(m) custCode = m[1];
  else if(specialNames[o.npp]) custCode = specialNames[o.npp];
  else custCode = regionFallback[o.region] || 'QN-HH';

  let totalWeight = 0, totalAmount = 0;
  for(const it of o.items) {
    const p = PRODUCT_MAP[it.product];
    totalWeight += p.weight * it.qty;
    totalAmount += p.price * it.qty;
  }

  let actualTrips = o.trips;
  if(totalWeight / actualTrips > MAX_PER_SHIP) {
    actualTrips = Math.floor(totalWeight / MAX_PER_SHIP) + 1;
  }

  const seq = String(i+1).padStart(3, '0');
  const orderNum = `ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-${seq}`;

  lines.push('');
  lines.push(`-- ${o.code} | ${custCode} | ${totalWeight.toFixed(0)}kg | ${actualTrips} trips (orig: ${o.trips})`);
  lines.push('DO $$');
  lines.push('DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;');
  lines.push('BEGIN');
  lines.push(`  SELECT id INTO v_cid FROM customers WHERE code = ${q(custCode)};`);
  lines.push(`  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';`);
  lines.push(`  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;`);
  lines.push(`  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,`);
  lines.push(`    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)`);
  lines.push(`  VALUES (gen_random_uuid(), '${orderNum}', v_cid, v_wid, 'confirmed', CURRENT_DATE,`);
  lines.push(`    ${totalAmount}, 0, ${totalWeight.toFixed(2)}, ${(totalWeight/500).toFixed(1)}, v_uid, 'passed', 'passed')`);
  lines.push(`  RETURNING id INTO v_oid;`);

  for(const it of o.items) {
    const p = PRODUCT_MAP[it.product];
    lines.push(`  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)`);
    lines.push(`    SELECT v_oid, id, ${it.qty}, ${p.price}, ${p.price*it.qty} FROM products WHERE sku = ${q(p.sku)};`);
  }

  const weightPerTrip = totalWeight / actualTrips;
  for(let t=0; t<actualTrips; t++) {
    shipIdx++;
    const shipSeq = String(shipIdx).padStart(3, '0');
    const shipNum = `SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-${shipSeq}`;
    let tw = weightPerTrip;
    if(t === actualTrips-1) tw = totalWeight - weightPerTrip*(actualTrips-1);

    let itemsArr = [];
    for(const it of o.items) {
      const p = PRODUCT_MAP[it.product];
      let tq = Math.floor(it.qty / actualTrips);
      if(t === actualTrips-1) tq = it.qty - Math.floor(it.qty/actualTrips)*(actualTrips-1);
      itemsArr.push({product_sku:p.sku, quantity:tq, weight_kg:+(p.weight*tq).toFixed(1)});
    }
    const itemsJson = JSON.stringify(itemsArr).replace(/'/g, "''");

    lines.push(`  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,`);
    lines.push(`    delivery_date, total_weight_kg, total_volume_m3, items)`);
    lines.push(`  VALUES ('${shipNum}', v_oid, v_cid, v_wid, 'pending',`);
    lines.push(`    CURRENT_DATE, ${tw.toFixed(2)}, ${(tw/500).toFixed(1)}, '${itemsJson}'::jsonb);`);
  }

  lines.push('END $$;');
}

lines.push('');
lines.push(`UPDATE stock_quants SET quantity = 500000, reserved_qty = 0;`);
lines.push(`INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)`);
lines.push(`SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'`);
lines.push(`FROM drivers d WHERE d.status = 'active'`);
lines.push(`ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';`);
lines.push('COMMIT;');
lines.push(`-- Total: ${orders.length} orders, ${shipIdx} shipments (max ${MAX_PER_SHIP}kg each)`);

const outPath = path.join(__dirname, '../migrations/import_test_orders_v2.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Generated ${orders.length} orders, ${shipIdx} shipments → ${outPath}`);
