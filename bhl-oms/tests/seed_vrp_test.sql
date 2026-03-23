-- Create 3000 orders + shipments for VRP load test (2026-03-22)
DO $$
DECLARE
  cids UUID[]; pids UUID[]; ppr NUMERIC[];
  pwt NUMERIC[]; pvol NUMERIC[]; pdep NUMERIC[];
  cnt INT; pcnt INT;
  oid UUID; sid UUID; cid UUID;
  i INT; j INT; pidx INT; q INT;
  ta NUMERIC; td NUMERIC; tw NUMERIC; tv NUMERIC;
  base_seq INT;
BEGIN
  -- Use a high base to avoid conflicts with existing orders
  base_seq := (SELECT COALESCE(MAX(
    CASE WHEN order_number ~ E'^SO-\\d{8}-\\d+$'
    THEN CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER) ELSE 0 END), 0) + 1 FROM sales_orders);
  -- Also advance the sequence past our range
  PERFORM setval('order_number_seq', base_seq + 3001, false);
  
  SELECT array_agg(id), COUNT(*) INTO cids, cnt FROM customers LIMIT 700;
  SELECT array_agg(id ORDER BY sku), array_agg(price ORDER BY sku),
         array_agg(weight_kg ORDER BY sku), array_agg(volume_m3 ORDER BY sku),
         array_agg(deposit_price ORDER BY sku), COUNT(*)
  INTO pids, ppr, pwt, pvol, pdep, pcnt FROM products WHERE is_active;
  FOR i IN 1..3000 LOOP
    oid := gen_random_uuid(); sid := gen_random_uuid();
    cid := cids[1+((i-1)%cnt)];
    ta:=0; td:=0; tw:=0; tv:=0;
    INSERT INTO sales_orders (id,order_number,customer_id,warehouse_id,status,
      delivery_date,total_amount,deposit_amount,total_weight_kg,total_volume_m3,
      atp_status,credit_status,created_by,approved_by,approved_at)
    VALUES (oid,'SO-20260322-'||LPAD((base_seq + i)::TEXT,6,'0'),cid,
      'a0000000-0000-0000-0000-000000000001','approved','2026-03-22',
      0,0,0,0,'passed','passed',
      'b0000000-0000-0000-0000-000000000002',
      'b0000000-0000-0000-0000-000000000004',now());
    FOR j IN 1..3 LOOP
      pidx:=1+((i+j)%pcnt); q:=10+((i*7+j*13)%91);
      INSERT INTO order_items (order_id,product_id,quantity,unit_price,amount,deposit_amount)
      VALUES (oid,pids[pidx],q,ppr[pidx],ppr[pidx]*q,pdep[pidx]*q);
      ta:=ta+ppr[pidx]*q; td:=td+pdep[pidx]*q;
      tw:=tw+pwt[pidx]*q; tv:=tv+pvol[pidx]*q;
    END LOOP;
    UPDATE sales_orders SET total_amount=ta,deposit_amount=td,
      total_weight_kg=tw,total_volume_m3=tv WHERE id=oid;
    INSERT INTO shipments (id,shipment_number,order_id,customer_id,warehouse_id,
      status,delivery_date,total_weight_kg,total_volume_m3,items)
    VALUES (sid,'SH-20260322-'||LPAD((base_seq + i)::TEXT,6,'0'),oid,cid,
      'a0000000-0000-0000-0000-000000000001','pending',
      '2026-03-22',tw,tv,'[]');
  END LOOP;
  RAISE NOTICE 'Created 3000 orders + shipments for VRP test (base_seq=%)', base_seq;
END $$;
