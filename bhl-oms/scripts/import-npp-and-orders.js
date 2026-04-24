/**
 * Import NPP (customers) from Excel and create test orders for today.
 * 
 * Usage: node scripts/import-npp-and-orders.js
 * 
 * This generates SQL files:
 *   migrations/import_npp_new.sql    — truncate + insert 218 NPPs
 *   migrations/import_test_orders.sql — 28 real orders for today
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXCEL_FILE = path.join(__dirname, '..', '..', 'Tai lieu', 'Data for test.xlsx');
const NPP_SQL_FILE = path.join(__dirname, '..', 'migrations', 'import_npp_new.sql');
const ORDERS_SQL_FILE = path.join(__dirname, '..', 'migrations', 'import_test_orders.sql');

// Product mapping: Excel name → DB product ID
const PRODUCT_MAP = {
  'Bia Hạ Long Lon 330ml (24 lon/thùng)': { id: 'c0000000-0000-0000-0000-000000000001', sku: 'BHL-LON-330', weight_kg: 8.5, unit: 'thùng' },
  'Bia Hạ Long Chai 450ml (20 chai/két)': { id: 'c0000000-0000-0000-0000-000000000003', sku: 'BHL-CHAI-450', weight_kg: 14.0, unit: 'két' },
  'Bia Hạ Long Chai 330ml (20 chai/két)': { id: 'c0000000-0000-0000-0000-000000000016', sku: 'BHL-CHAI-355', weight_kg: 15.0, unit: 'két' },
  'Bia Hạ Long Keg 30 Lít':              { id: 'c0000000-0000-0000-0000-000000000007', sku: 'BHL-DRAFT-30', weight_kg: 32.0, unit: 'keg' },
  'Bia HL Keg 30L':                       { id: 'c0000000-0000-0000-0000-000000000007', sku: 'BHL-DRAFT-30', weight_kg: 32.0, unit: 'keg' },
  'Bia Hạ Long PET 2 Lít':               { id: 'c0000000-0000-0000-0000-000000000009', sku: 'NGK-CHANH-330', weight_kg: 25.2, unit: 'két' }, // closest match, PET not in DB
};

// Warehouse
const WAREHOUSE_ID = 'a0000000-0000-0000-0000-000000000001'; // Kho Hạ Long

// Today's date  
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

function escSql(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function generateNppSql() {
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets['1. DM NPP'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const lines = [];
  lines.push('-- Auto-generated: Import 218 NPPs from "Data for test.xlsx"');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('-- Delete all dependent data first');
  lines.push('DELETE FROM trip_stops;');
  lines.push('DELETE FROM trips;');
  lines.push('DELETE FROM shipments;');
  lines.push('DELETE FROM order_items;');
  lines.push('DELETE FROM sales_orders;');
  lines.push('DELETE FROM credit_limits;');
  lines.push('DELETE FROM receivable_ledger;');
  lines.push('DELETE FROM customers;');
  lines.push('');

  // Map region → province
  const regionToProvince = {
    'Bắc Giang': 'Bắc Giang',
    'Bắc Ninh': 'Bắc Ninh',
    'Hưng Yên': 'Hưng Yên',
    'Hải Dương': 'Hải Dương',
    'Hải Phòng': 'Hải Phòng',
    'Lạng Sơn': 'Lạng Sơn',
    'Nam Định': 'Nam Định',
    'Ninh Bình': 'Ninh Bình',
    'Phú Thọ': 'Phú Thọ',
    'Quảng Ninh': 'Quảng Ninh',
    'TP.HỒ CHÍ MINH': 'TP. Hồ Chí Minh',
    'Thanh Hóa': 'Thanh Hóa',
    'Thanh Xuân, Hà Đông': 'Hà Nội',
    'Thái Bình': 'Thái Bình',
    'Thái Nguyên': 'Thái Nguyên',
  };

  let count = 0;
  const seenCodes = new Set();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[3]) continue; // skip rows without code
    
    const code = row[3];
    if (seenCodes.has(code)) {
      console.warn(`Skipping duplicate NPP code: ${code}`);
      continue;
    }
    seenCodes.add(code);
    
    const stt = row[0];
    const region = row[1];
    const name = row[2];
    // code already declared above
    const address = row[4] || 'Chưa có địa chỉ';
    const custType = row[5];
    const lng = row[6];
    const lat = row[7];
    const province = regionToProvince[region] || region;

    lines.push(`INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)`);
    lines.push(`  VALUES (${escSql(code)}, ${escSql(name)}, ${escSql(address)}, ${escSql(province)}, ${lng}, ${lat}, true);`);
    count++;
  }

  // Add credit limits for all new customers
  lines.push('');
  lines.push('-- Credit limits for all NPPs');
  lines.push(`INSERT INTO credit_limits (customer_id, credit_limit, effective_from)`);
  lines.push(`  SELECT id, 500000000, CURRENT_DATE FROM customers;`);

  lines.push('');
  lines.push('COMMIT;');
  lines.push(`-- Total: ${count} NPPs imported`);

  fs.writeFileSync(NPP_SQL_FILE, lines.join('\n'), 'utf8');
  console.log(`Generated ${NPP_SQL_FILE} with ${count} NPPs`);
  return count;
}

function generateOrdersSql() {
  const wb = XLSX.readFile(EXCEL_FILE);
  
  // Read NPP data for coordinate lookup
  const wsNpp = wb.Sheets['1. DM NPP'];
  const nppData = XLSX.utils.sheet_to_json(wsNpp, { header: 1 });
  const nppByCode = {};
  const nppByRegion = {};
  for (let i = 1; i < nppData.length; i++) {
    const row = nppData[i];
    if (!row[3]) continue;
    const code = row[3];
    const region = row[1];
    nppByCode[code] = { name: row[2], code, region, address: row[4], lng: row[6], lat: row[7] };
    if (!nppByRegion[region]) nppByRegion[region] = [];
    nppByRegion[region].push(nppByCode[code]);
  }

  // Parse orders from sheet 4
  const ws4 = wb.Sheets['4. Data Test 13-06'];
  const d4 = XLSX.utils.sheet_to_json(ws4, { header: 1 });
  
  const orders = [];
  let current = null;
  for (let i = 4; i < d4.length; i++) {
    const r = d4[i];
    if (r[0] && typeof r[0] === 'string' && r[0].startsWith('DH-')) {
      if (current) orders.push(current);
      current = { code: r[0], npp: r[2], region: r[3], addr: r[4], trips: r[5] || 1, items: [] };
    } else if (r[0] && typeof r[0] === 'string' && r[0].startsWith('CHI TIẾT')) {
      break;
    }
    if (current && r[6] && typeof r[6] === 'string' && PRODUCT_MAP[r[6]]) {
      current.items.push({ product: r[6], qty: r[7] || 0, unit: r[8] });
    }
  }
  if (current) orders.push(current);

  const lines = [];
  lines.push('-- Auto-generated: 28 real orders from June 13 data, date = today');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Delivery date: ${TODAY}`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('-- Clean existing orders/shipments for today');
  lines.push('DELETE FROM trip_stops;');
  lines.push('DELETE FROM trips;');
  lines.push(`DELETE FROM shipments WHERE delivery_date = '${TODAY}';`);
  lines.push(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE delivery_date = '${TODAY}');`);
  lines.push(`DELETE FROM sales_orders WHERE delivery_date = '${TODAY}';`);
  lines.push('');

  // For "Khu vực" orders: assign to first NPP in that region
  // For specific NPPs: use their code to find customer
  const regionMap = {
    'Bắc Giang': 'Bắc Giang',
    'Bắc Ninh': 'Bắc Ninh',
    'Hải Dương': 'Hải Dương',
    'Hải Phòng': 'Hải Phòng',
    'Nam Định': 'Nam Định',
    'NĐ + NB': 'Nam Định',
    'Nội bộ': 'Quảng Ninh',
    'Thái Bình': 'Thái Bình',
    'Thái Nguyên': 'Thái Nguyên',
    'Hà Nội': 'Thanh Xuân, Hà Đông',
  };

  let orderNum = 1;
  let shipmentNum = 1;
  
  for (const order of orders) {
    // Find customer: specific NPP code or first in region
    let customerCode = null;
    const nppName = order.npp || '';
    
    // Extract code from NPP name like "Tạ Hữu Bản-QY-121" → "QY-121"
    const codeMatch = nppName.match(/\b([A-Z]{1,5}\d?-\d{1,3}(?:-\d{1,3})?)\b/i);
    if (codeMatch && nppByCode[codeMatch[1]]) {
      customerCode = codeMatch[1];
    } else {
      // Region-based: pick first NPP in that region
      const mappedRegion = regionMap[order.region] || order.region;
      const regionNpps = nppByRegion[mappedRegion];
      if (regionNpps && regionNpps.length > 0) {
        customerCode = regionNpps[0].code;
      }
    }

    if (!customerCode) {
      console.warn(`Cannot find NPP for order ${order.code}: ${nppName} (${order.region})`);
      continue;
    }

    // Calculate totals
    let totalWeight = 0;
    let totalVolume = 0;
    let totalAmount = 0;
    const itemsSql = [];

    for (const item of order.items) {
      const prod = PRODUCT_MAP[item.product];
      if (!prod) continue;
      const qty = item.qty || 0;
      const weight = prod.weight_kg * qty;
      totalWeight += weight;
      totalVolume += qty * 0.05; // ~0.05 m3 per unit estimate
      const unitPrice = prod.sku.startsWith('BHL-DRAFT') ? 800000 : 
                         prod.sku.startsWith('BHL-CHAI') ? 250000 : 180000;
      totalAmount += unitPrice * qty;
      
      itemsSql.push({ productId: prod.id, qty, weight, unitPrice });
    }

    if (order.items.length === 0) continue;

    const orderNumber = `ORD-${TODAY.replace(/-/g, '')}-${String(orderNum).padStart(3, '0')}`;
    const orderId = `d0000000-0000-0000-0000-${String(orderNum).padStart(12, '0')}`;
    
    // Create sales_order
    lines.push(`-- ${order.code}: ${nppName} (${order.region})`);
    lines.push(`INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)`);
    lines.push(`  SELECT '${orderId}', ${escSql(orderNumber)}, c.id, '${WAREHOUSE_ID}', 'confirmed'::order_status, '${TODAY}', ${totalWeight.toFixed(2)}, ${totalVolume.toFixed(4)}, ${totalAmount.toFixed(2)}, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)`);
    lines.push(`  FROM customers c WHERE c.code = ${escSql(customerCode)};`);

    // Create order_items
    for (let j = 0; j < itemsSql.length; j++) {
      const item = itemsSql[j];
      lines.push(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)`);
      lines.push(`  VALUES ('${orderId}', '${item.productId}', ${item.qty}, ${item.unitPrice}, ${item.unitPrice * item.qty});`);
    }

    // Create shipments — split into trips based on vehicle capacity (~8 tons per trip)
    const numTrips = order.trips;
    const weightPerTrip = totalWeight / numTrips;
    
    for (let t = 0; t < numTrips; t++) {
      const shipNumber = `SHP-${TODAY.replace(/-/g, '')}-${String(shipmentNum).padStart(3, '0')}`;
      const shipId = `e0000000-0000-0000-0000-${String(shipmentNum).padStart(12, '0')}`;
      const tripWeight = (t < numTrips - 1) ? weightPerTrip : (totalWeight - weightPerTrip * (numTrips - 1));
      const tripVolume = totalVolume / numTrips;
      
      // Distribute items proportionally across trips
      const tripItems = order.items.map(item => {
        const prod = PRODUCT_MAP[item.product];
        if (!prod) return null;
        const tripQty = Math.ceil(item.qty / numTrips);
        return {
          product_id: prod.id,
          product_name: item.product,
          quantity: tripQty,
          weight_kg: prod.weight_kg * tripQty
        };
      }).filter(Boolean);

      lines.push(`INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)`);
      lines.push(`  SELECT '${shipId}', ${escSql(shipNumber)}, '${orderId}', c.id, '${WAREHOUSE_ID}', 'pending'::shipment_status, '${TODAY}', ${tripWeight.toFixed(2)}, ${tripVolume.toFixed(4)}, '${JSON.stringify(tripItems)}'::jsonb`);
      lines.push(`  FROM customers c WHERE c.code = ${escSql(customerCode)};`);
      
      shipmentNum++;
    }
    
    lines.push('');
    orderNum++;
  }

  lines.push('COMMIT;');
  lines.push(`-- Total: ${orderNum - 1} orders, ${shipmentNum - 1} shipments`);

  fs.writeFileSync(ORDERS_SQL_FILE, lines.join('\n'), 'utf8');
  console.log(`Generated ${ORDERS_SQL_FILE} with ${orderNum - 1} orders, ${shipmentNum - 1} shipments`);
}

// Run
console.log('Reading:', EXCEL_FILE);
generateNppSql();
generateOrdersSql();
console.log('\nDone! Now run:');
console.log(`  docker exec -i bhl-oms-postgres-1 psql -U bhl -d bhl_dev < migrations/import_npp_new.sql`);
console.log(`  docker exec -i bhl-oms-postgres-1 psql -U bhl -d bhl_dev < migrations/import_test_orders.sql`);
