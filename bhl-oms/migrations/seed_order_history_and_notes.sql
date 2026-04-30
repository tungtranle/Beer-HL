-- =============================================================================
-- SEED: Order History, Notes, Transaction Comments
-- Mục đích: Bổ sung lịch sử đơn hàng, ghi chú giao dịch thực tế
-- KHÔNG dùng 1 transaction lớn — mỗi INSERT auto-commit riêng
-- =============================================================================

-- Xóa entity_events order cũ (52 bản ghi order.planned)
DELETE FROM entity_events WHERE entity_type = 'order';

-- =============================================================================
-- EVENT 1: order.created
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.created',
  'user',
  '39103d66-70c0-4f3f-8122-a115701fe43a',
  'Nhân Viên DVKH',
  'Đơn hàng được tạo mới',
  jsonb_build_object(
    'order_number', so.order_number,
    'channel', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 3
      WHEN 0 THEN 'Gọi điện'
      WHEN 1 THEN 'Zalo OA'
      ELSE 'Đặt trực tiếp'
    END
  ),
  so.created_at + make_interval(mins => ((hashtext(so.id::text)::bigint & 2147483647))::int % 25 + 2)
FROM sales_orders so;

-- =============================================================================
-- EVENT 2: order.confirmed
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.confirmed',
  'user',
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid
       ELSE '55cf323c-bdab-496d-018e-942ce6284694'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Điều Phối Hạ Long' ELSE 'Điều Phối Hải Phòng' END,
  'Đơn hàng đã được xác nhận',
  jsonb_build_object(
    'order_number', so.order_number,
    'note', CASE ((hashtext(so.order_number)::bigint & 2147483647))::int % 4
      WHEN 0 THEN 'Xác nhận với NPP qua điện thoại'
      WHEN 1 THEN 'Đã kiểm tra tồn kho, đủ hàng giao'
      WHEN 2 THEN 'NPP xác nhận đặt hàng qua Zalo'
      ELSE 'Xác nhận thông tin giao hàng với khách'
    END
  ),
  so.created_at + make_interval(
    hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 8 + 2,
    mins  => ((hashtext(so.order_number)::bigint & 2147483647))::int % 45
  )
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id;

-- =============================================================================
-- EVENT 3: order.processing
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.processing',
  'user',
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN '0e39b13a-4c5e-4ee8-d642-ac19f395cb16'::uuid
       ELSE '114c67fe-0f4a-4d16-fb29-ad5679ce248f'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Thủ Kho Hạ Long' ELSE 'Thủ Kho Hải Phòng' END,
  'Kho bắt đầu xử lý đơn hàng',
  jsonb_build_object(
    'order_number', so.order_number,
    'warehouse', CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
                      THEN 'Kho Hạ Long' ELSE 'Kho Hải Phòng' END,
    'note', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 3
      WHEN 0 THEN 'Đang lấy hàng từ kệ, kiểm tra số lượng'
      WHEN 1 THEN 'Đóng gói và dán nhãn xong, chờ xe'
      ELSE 'Hàng đã sẵn sàng, đang chờ xếp lên xe'
    END
  ),
  COALESCE(t.started_at, so.created_at + make_interval(hours => 24))
    - make_interval(
        hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 2 + 1,
        mins  => ((hashtext(so.order_number)::bigint & 2147483647))::int % 50
      )
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
WHERE so.status::text <> 'cancelled';

-- =============================================================================
-- EVENT 4: order.planned
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.planned',
  'user',
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid
       ELSE '55cf323c-bdab-496d-018e-942ce6284694'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Điều Phối Hạ Long' ELSE 'Điều Phối Hải Phòng' END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Điều Phối Hạ Long' ELSE 'Điều Phối Hải Phòng' END || ' đã xếp vào chuyến',
  jsonb_build_object(
    'order_number', so.order_number,
    'driver', COALESCE(drv.full_name, 'Tài xế BHL')
  ),
  COALESCE(t.started_at, so.created_at + make_interval(hours => 20))
    - make_interval(
        hours => 1,
        mins  => ((hashtext(so.order_number)::bigint & 2147483647))::int % 30
      )
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
WHERE so.status::text <> 'cancelled' AND t.id IS NOT NULL;

-- =============================================================================
-- EVENT 5: order.shipped
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.shipped',
  'system',
  NULL,
  'Hệ thống',
  'Xe đã xuất bến, bắt đầu vận chuyển',
  jsonb_build_object(
    'order_number', so.order_number,
    'driver', COALESCE(drv.full_name, 'Tài xế BHL'),
    'note', 'Xe đã rời kho, đang trên đường giao hàng'
  ),
  COALESCE(t.started_at, so.created_at + make_interval(hours => 20))
    + make_interval(mins => ((hashtext(so.id::text)::bigint & 2147483647))::int % 15 + 5)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
WHERE so.status::text IN ('delivered','partially_delivered','returned') AND t.id IS NOT NULL;

-- =============================================================================
-- EVENT 6: order.delivered
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.delivered',
  'user',
  COALESCE(t.driver_id, 'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'),
  COALESCE(drv.full_name, 'Tài xế BHL'),
  'Giao hàng thành công tại NPP',
  jsonb_build_object(
    'order_number', so.order_number,
    'note', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 5
      WHEN 0 THEN 'Giao hàng thành công, NPP ký nhận đủ hàng'
      WHEN 1 THEN 'Đã giao và thu tiền mặt tại điểm'
      WHEN 2 THEN 'Giao hàng xong, chụp ảnh biên bản nhận hàng'
      WHEN 3 THEN 'NPP nhận hàng, kiểm đủ số lượng và chất lượng'
      ELSE 'Hoàn tất giao hàng, lấy chữ ký xác nhận'
    END
  ),
  COALESCE(ts.actual_arrival, t.completed_at, so.created_at + make_interval(hours => 28))
    + make_interval(mins => ((hashtext(so.order_number)::bigint & 2147483647))::int % 20)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
WHERE so.status::text IN ('delivered','partially_delivered');

-- =============================================================================
-- EVENT 7: order.payment_collected
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.payment_collected',
  'user',
  COALESCE(t.driver_id, '9c30b7bf-3570-4d78-73bd-e6006fee9783'),
  CASE WHEN t.driver_id IS NOT NULL THEN COALESCE(drv.full_name, 'Tài xế BHL') ELSE 'Kế Toán Trưởng' END,
  CASE p.payment_method::text
    WHEN 'cash' THEN 'Thu tiền mặt tại điểm giao'
    WHEN 'transfer' THEN 'Xác nhận chuyển khoản từ NPP'
    ELSE 'Thanh toán qua thẻ fleet card'
  END,
  jsonb_build_object(
    'order_number', so.order_number,
    'amount', p.amount,
    'method', CASE p.payment_method::text
      WHEN 'cash' THEN 'Tiền mặt'
      WHEN 'transfer' THEN 'Chuyển khoản'
      ELSE 'Fleet Card'
    END
  ),
  COALESCE(p.collected_at, ts.actual_arrival, t.completed_at, so.created_at + make_interval(hours => 29))
    + make_interval(mins => ((hashtext(so.id::text)::bigint & 2147483647))::int % 10 + 5)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
LEFT JOIN payments p ON p.order_id = so.id
WHERE so.status::text IN ('delivered','partially_delivered') AND p.amount IS NOT NULL;

-- =============================================================================
-- EVENT 8: order.return_attempted
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.return_attempted',
  'user',
  COALESCE(t.driver_id, 'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'),
  COALESCE(drv.full_name, 'Tài xế BHL'),
  'Giao hàng thất bại, không giao được',
  jsonb_build_object(
    'order_number', so.order_number,
    'reason', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 5
      WHEN 0 THEN 'Khách hàng vắng mặt, không liên lạc được'
      WHEN 1 THEN 'NPP từ chối nhận hàng, cần xác nhận lại đơn'
      WHEN 2 THEN 'Địa chỉ giao hàng không đúng'
      WHEN 3 THEN 'NPP không có tiền mặt thanh toán'
      ELSE 'Hàng bị kiểm tra phát hiện lỗi, NPP không nhận'
    END
  ),
  COALESCE(ts.actual_arrival, t.completed_at, so.created_at + make_interval(hours => 28))
    + make_interval(mins => ((hashtext(so.order_number)::bigint & 2147483647))::int % 15 + 5)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
WHERE so.status::text = 'returned';

-- =============================================================================
-- EVENT 9: order.returned
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.returned',
  'user',
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN '0e39b13a-4c5e-4ee8-d642-ac19f395cb16'::uuid
       ELSE '114c67fe-0f4a-4d16-fb29-ad5679ce248f'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Thủ Kho Hạ Long' ELSE 'Thủ Kho Hải Phòng' END,
  'Hàng hoàn về kho sau khi giao thất bại',
  jsonb_build_object(
    'order_number', so.order_number,
    'note', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 3
      WHEN 0 THEN 'Hàng về kho nguyên vẹn, đã kiểm tra và nhập lại tồn kho'
      WHEN 1 THEN 'Nhận hàng hoàn, đang chờ điều phối liên hệ lại NPP'
      ELSE 'Hàng hoàn đã được lưu kho, cần xem xét tái giao'
    END
  ),
  COALESCE(t.completed_at, so.created_at + make_interval(hours => 36))
    + make_interval(
        hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 2,
        mins  => ((hashtext(so.order_number)::bigint & 2147483647))::int % 30 + 15
      )
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
WHERE so.status::text = 'returned';

-- =============================================================================
-- EVENT 10: order.cancelled
-- =============================================================================
INSERT INTO entity_events (id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at)
SELECT
  gen_random_uuid(),
  'order',
  so.id,
  'order.cancelled',
  'user',
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid
       ELSE '55cf323c-bdab-496d-018e-942ce6284694'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Điều Phối Hạ Long' ELSE 'Điều Phối Hải Phòng' END,
  'Đơn hàng đã bị huỷ',
  jsonb_build_object(
    'order_number', so.order_number,
    'reason', CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 5
      WHEN 0 THEN 'NPP yêu cầu huỷ đơn, thay đổi kế hoạch nhập hàng'
      WHEN 1 THEN 'Hàng không đủ tồn kho tại thời điểm xử lý'
      WHEN 2 THEN 'NPP quá hạn công nợ, tạm dừng cung cấp'
      WHEN 3 THEN 'Lỗi nhập đơn, cần đặt lại đơn mới'
      ELSE 'Điều phối huỷ do không đủ xe trong ngày'
    END
  ),
  so.created_at + make_interval(hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 12 + 4)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
WHERE so.status::text = 'cancelled';

SELECT event_type, COUNT(*) FROM entity_events GROUP BY 1 ORDER BY 2 DESC;

-- =============================================================================
-- ORDER_NOTES
-- =============================================================================

-- 2a. Ghi chú điều phối (~50% đơn không bị huỷ)
INSERT INTO order_notes (id, order_id, user_id, user_name, content, note_type, is_pinned, created_at)
SELECT
  gen_random_uuid(),
  so.id,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid
       ELSE '55cf323c-bdab-496d-018e-942ce6284694'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Điều Phối Hạ Long' ELSE 'Điều Phối Hải Phòng' END,
  CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 8
    WHEN 0 THEN 'NPP yêu cầu giao trước 10h sáng, vui lòng ưu tiên cho điểm này'
    WHEN 1 THEN 'Địa chỉ giao hàng trong ngõ hẹp, xe tải nhỏ mới vào được. Liên hệ NPP trước 30 phút'
    WHEN 2 THEN 'NPP có cổng bảo vệ, tài xế phải báo trước khi vào'
    WHEN 3 THEN 'Hàng có mặt hàng dễ vỡ, tài xế chú ý khi xếp dỡ'
    WHEN 4 THEN 'NPP nhận hàng vào buổi chiều, không nhận trước 13h'
    WHEN 5 THEN 'Đơn hàng ưu tiên, NPP đang cần gấp cho đợt khuyến mại'
    WHEN 6 THEN 'Liên hệ trực tiếp chủ cửa hàng khi giao, không liên hệ nhân viên khác'
    ELSE 'Thanh toán tiền mặt khi giao, không nhận chuyển khoản trước'
  END,
  'dispatcher',
  CASE WHEN ((hashtext(so.id::text)::bigint & 2147483647))::int % 15 = 0 THEN TRUE ELSE FALSE END,
  so.created_at + make_interval(hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 6 + 2)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
WHERE so.status::text <> 'cancelled'
  AND ((hashtext(so.id::text)::bigint & 2147483647))::int % 2 = 0;

-- 2b. Ghi chú kho (~33% đơn không bị huỷ)
INSERT INTO order_notes (id, order_id, user_id, user_name, content, note_type, is_pinned, created_at)
SELECT
  gen_random_uuid(),
  so.id,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN '0e39b13a-4c5e-4ee8-d642-ac19f395cb16'::uuid
       ELSE '114c67fe-0f4a-4d16-fb29-ad5679ce248f'::uuid END,
  CASE WHEN sh.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       THEN 'Thủ Kho Hạ Long' ELSE 'Thủ Kho Hải Phòng' END,
  CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 7
    WHEN 0 THEN 'Đã xuất kho đủ số lượng theo phiếu, hàng nguyên đai nguyên kiện'
    WHEN 1 THEN 'Có 2 thùng bao bì ngoài bị móp nhẹ, hàng bên trong vẫn nguyên vẹn. Đã chụp ảnh lưu hồ sơ'
    WHEN 2 THEN 'Xuất hàng đúng giờ theo lịch, tài xế đã kiểm tra và ký biên bản bàn giao'
    WHEN 3 THEN 'Hàng đã được sắp xếp theo thứ tự giao, điểm đầu tiên ở trên cùng'
    WHEN 4 THEN 'Kiểm tra hạn sử dụng trước khi xuất: tất cả còn hạn trên 6 tháng'
    WHEN 5 THEN 'Hàng xuất kho: lô sản xuất ' || to_char(('2024-01-01'::date + ((hashtext(so.order_number)::bigint & 2147483647))::int % 365), 'YYYYMMDD')
    ELSE 'Đã dán nhãn QR cho từng thùng, scan OK, đã cập nhật tồn kho hệ thống'
  END,
  'warehouse',
  FALSE,
  COALESCE(t.started_at, so.created_at + make_interval(hours => 20))
    - make_interval(
        hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 2,
        mins  => ((hashtext(so.order_number)::bigint & 2147483647))::int % 40 + 10
      )
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
WHERE so.status::text <> 'cancelled'
  AND ((hashtext(so.id::text)::bigint & 2147483647))::int % 3 = 0;

-- 2c. Ghi chú tài xế (~40% đơn delivered) — dùng drivers.user_id
INSERT INTO order_notes (id, order_id, user_id, user_name, content, note_type, is_pinned, created_at)
SELECT
  gen_random_uuid(),
  so.id,
  COALESCE(drv.user_id, '39103d66-70c0-4f3f-8122-a115701fe43a'::uuid),
  COALESCE(drv.full_name, 'Tài xế BHL'),
  CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 8
    WHEN 0 THEN 'Giao hàng thành công. Người nhận: quản lý kho NPP. Đã ký nhận đủ hàng'
    WHEN 1 THEN 'Đã giao và thu tiền mặt. NPP đếm tiền và xác nhận đủ số tiền trên hóa đơn'
    WHEN 2 THEN 'Giao hàng tại điểm. NPP kiểm tra hàng kỹ trước khi ký, mất khoảng 15 phút. Hàng OK'
    WHEN 3 THEN 'Đến điểm đúng giờ. Cửa hàng đang có khách, chờ 10 phút rồi giao. NPP hài lòng'
    WHEN 4 THEN 'Giao đủ hàng theo phiếu xuất kho. Chụp ảnh biên bản, upload lên app xong'
    WHEN 5 THEN 'NPP nhận hàng, ký xác nhận. Một số thùng bên ngoài hơi bám bụi đường, hàng trong OK'
    WHEN 6 THEN 'Hoàn thành giao hàng. Đường vào điểm giao hẹp, phải đậu xa đi bộ vào'
    ELSE 'Giao hàng thành công. NPP ký nhận đủ số lượng và ký tên trên app'
  END,
  'driver',
  FALSE,
  COALESCE(ts.actual_arrival, t.completed_at, so.created_at + make_interval(hours => 28))
    + make_interval(mins => ((hashtext(so.id::text)::bigint & 2147483647))::int % 15 + 3)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
LEFT JOIN drivers drv ON drv.id = t.driver_id
WHERE so.status::text IN ('delivered','partially_delivered')
  AND t.driver_id IS NOT NULL
  AND ((hashtext(so.id::text)::bigint & 2147483647))::int % 5 < 2;

-- 2d. Ghi chú DVKH cho đơn hoàn
INSERT INTO order_notes (id, order_id, user_id, user_name, content, note_type, is_pinned, created_at)
SELECT
  gen_random_uuid(),
  so.id,
  '39103d66-70c0-4f3f-8122-a115701fe43a'::uuid,
  'Nhân Viên DVKH',
  CASE ((hashtext(so.id::text)::bigint & 2147483647))::int % 5
    WHEN 0 THEN 'DVKH đã liên hệ lại NPP sau khi nhận hoàn hàng. NPP xác nhận sẽ đặt lại đơn trong tuần tới'
    WHEN 1 THEN 'NPP giải trình lý do từ chối: thay đổi kế hoạch nhập hàng tháng. Đã ghi nhận, chờ đơn mới'
    WHEN 2 THEN 'Đã gọi điện cho NPP, xác nhận hàng đã về kho nguyên vẹn. NPP đồng ý tái đặt đơn sau 7 ngày'
    WHEN 3 THEN 'NPP phản ánh bao bì ngoài bị móp trong vận chuyển. Đã ghi nhận, chuyển QC xử lý'
    ELSE 'Đã tiếp nhận hàng hoàn, cập nhật trạng thái. Liên hệ NPP để xếp lịch giao lại'
  END,
  'dvkh',
  TRUE,
  COALESCE(t.completed_at, so.created_at + make_interval(hours => 36))
    + make_interval(hours => ((hashtext(so.id::text)::bigint & 2147483647))::int % 3 + 1)
FROM sales_orders so
LEFT JOIN shipments sh ON sh.order_id = so.id
LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
LEFT JOIN trips t ON t.id = ts.trip_id
WHERE so.status::text = 'returned';

SELECT 'order_notes' AS table_name, COUNT(*) AS records FROM order_notes;

-- =============================================================================
-- PAYMENTS.NOTES
-- =============================================================================
UPDATE payments SET notes =
  CASE payment_method::text
    WHEN 'cash' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 6
        WHEN 0 THEN 'Thu tiền mặt tại điểm giao. Đã đếm kiểm đủ số tiền. Không có tiền lẻ thối lại'
        WHEN 1 THEN 'NPP thanh toán đủ theo hóa đơn. Tiền mặt đã được giao nộp về kế toán'
        WHEN 2 THEN 'Thu tiền COD tại điểm. NPP trả đủ, đã ký biên lai'
        WHEN 3 THEN 'Tài xế thu tiền mặt, đã xác nhận trên app. Nộp tiền cuối ngày về quỹ công ty'
        WHEN 4 THEN 'Thu COD đủ. Khách đưa tiền chẵn, không cần thối. Đã ký biên lai'
        ELSE 'Thanh toán tiền mặt hoàn tất. Tài xế nộp tiền về kế toán lúc kết chuyến'
      END
    WHEN 'transfer' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 5
        WHEN 0 THEN 'NPP chuyển khoản trước khi giao. Kế toán xác nhận đã nhận trên tài khoản ngân hàng'
        WHEN 1 THEN 'Chuyển khoản xác nhận qua Zalo. Đã đối chiếu với sao kê, khớp số tiền'
        WHEN 2 THEN 'NPP thanh toán qua Internet Banking. Đã đối chiếu mã giao dịch'
        WHEN 3 THEN 'Nhận chuyển khoản OK. Không cần thu tiền mặt khi giao hàng'
        ELSE 'Xác nhận chuyển khoản từ NPP. Số tiền khớp với đơn hàng, không có chênh lệch'
      END
    ELSE
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
        WHEN 0 THEN 'Thanh toán qua fleet card. Hệ thống xác nhận giao dịch thành công'
        WHEN 1 THEN 'Quẹt fleet card tại điểm giao. Giao dịch thành công, không có lỗi'
        ELSE 'Fleet card: giao dịch được phê duyệt tự động. Đã lưu receipt điện tử'
      END
  END
WHERE notes IS NULL;

SELECT 'payments' AS table_name, COUNT(*) FILTER(WHERE notes IS NOT NULL) AS with_notes FROM payments;

-- =============================================================================
-- EPOD NOTES & REJECT_DETAIL
-- =============================================================================
UPDATE epod SET notes =
  CASE ((hashtext(id::text)::bigint & 2147483647))::int % 8
    WHEN 0 THEN 'Người nhận: chủ cửa hàng. Hàng đầy đủ, nguyên vẹn. Ký nhận OK'
    WHEN 1 THEN 'Giao tại kho NPP. Người nhận: nhân viên kho. Hàng xếp gọn, đúng số lượng'
    WHEN 2 THEN 'Giao thành công. NPP kiểm tra hàng trực tiếp trước khi ký, xác nhận đủ'
    WHEN 3 THEN 'Đã giao đủ hàng. Người ký: quản lý cửa hàng. Ghi nhận giao đúng giờ'
    WHEN 4 THEN 'Hoàn thành giao hàng theo lịch. NPP hài lòng về dịch vụ giao hàng'
    WHEN 5 THEN 'NPP nhận hàng, ký biên bản đầy đủ. Không có khiếu nại về hàng hóa'
    WHEN 6 THEN 'Giao hàng xong. Chụp ảnh toàn bộ hàng hóa trước và sau khi NPP nhận'
    ELSE 'Giao đúng địa chỉ, đúng giờ. NPP xác nhận số lượng và ký nhận'
  END
WHERE delivery_status = 'delivered' AND notes IS NULL;

UPDATE epod SET reject_detail =
  CASE reject_reason
    WHEN 'customer_refused' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 4
        WHEN 0 THEN 'NPP từ chối nhận toàn bộ lô hàng, nêu lý do thay đổi kế hoạch nhập hàng. Đã liên hệ điều phối để xử lý'
        WHEN 1 THEN 'Chủ cửa hàng không có nhà, nhân viên không có quyền ký nhận. Đã gọi điện nhiều lần không liên lạc được'
        WHEN 2 THEN 'NPP phản ánh hàng không đúng chủng loại với đơn đặt hàng ban đầu, từ chối nhận'
        ELSE 'NPP từ chối do chưa thanh toán công nợ cũ, chưa được phép nhập thêm hàng'
      END
    WHEN 'no_payment' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
        WHEN 0 THEN 'NPP không có tiền mặt tại thời điểm giao. Chuyển khoản chưa xử lý được. Hàng phải mang về'
        WHEN 1 THEN 'NPP thiếu tiền, chỉ có thể thanh toán một phần. Không đủ điều kiện nhận hàng COD'
        ELSE 'NPP yêu cầu trả sau nhưng không nằm trong chính sách công nợ. Phải thu tiền mặt theo hợp đồng'
      END
    WHEN 'damaged_goods' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
        WHEN 0 THEN 'NPP phát hiện 3 thùng bị vỡ trong quá trình vận chuyển. Hàng bên trong bị hư hỏng. Tài xế đã chụp ảnh lưu hồ sơ'
        WHEN 1 THEN 'Bao bì ngoài bị móp do xếp chồng không đúng cách. NPP không chấp nhận nhận hàng bị hư hỏng'
        ELSE 'Phát hiện 1 thùng có dấu hiệu bị thấm nước. NPP từ chối nhận, yêu cầu giao hàng mới'
      END
    WHEN 'customer_absent' THEN
      'NPP vắng mặt toàn bộ buổi giao hàng. Đã gọi điện 3 lần, không có phản hồi. Hàng mang về kho chờ lịch giao lại'
    WHEN 'wrong_address' THEN
      'Địa chỉ trên đơn không khớp thực tế. GPS dẫn đến địa điểm khác. Đã xác nhận lại với điều phối, cần cập nhật địa chỉ NPP'
    ELSE 'Giao hàng thất bại. Đã báo cáo về điều phối để xử lý'
  END
WHERE delivery_status = 'rejected' AND reject_detail IS NULL AND reject_reason IS NOT NULL;

UPDATE epod SET notes =
  CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
    WHEN 0 THEN 'Giao được một phần do xe không chở đủ. Phần còn lại sẽ giao trong chuyến tiếp theo'
    WHEN 1 THEN 'NPP chỉ nhận một phần hàng theo nhu cầu thực tế, phần còn lại trả về kho'
    ELSE 'Giao hàng một phần: một số SKU tạm hết hàng, sẽ giao bù trong 2-3 ngày tới'
  END
WHERE delivery_status = 'partial' AND notes IS NULL;

SELECT 'epod' AS table_name,
  COUNT(*) FILTER(WHERE notes IS NOT NULL) AS with_notes,
  COUNT(*) FILTER(WHERE reject_detail IS NOT NULL) AS with_reject_detail
FROM epod;

-- =============================================================================
-- RECONCILIATIONS.DETAILS
-- =============================================================================
UPDATE reconciliations SET details =
  CASE recon_type::text
    WHEN 'payment' THEN jsonb_build_object(
      'type', 'payment',
      'verified_by', CASE ((hashtext(id::text)::bigint & 2147483647))::int % 2
        WHEN 0 THEN 'Kế Toán Trưởng' ELSE 'Kế Toán Tổng Hợp' END,
      'note', CASE ((hashtext(id::text)::bigint & 2147483647))::int % 5
        WHEN 0 THEN 'Đối chiếu sao kê ngân hàng khớp hoàn toàn'
        WHEN 1 THEN 'Tiền mặt tài xế nộp về đúng số liệu trên hệ thống'
        WHEN 2 THEN 'Đối chiếu hóa đơn và biên lai: không có chênh lệch'
        WHEN 3 THEN 'Xác nhận thu COD đủ theo danh sách chuyến'
        ELSE 'Thanh toán qua chuyển khoản: khớp với sao kê tháng'
      END
    )
    WHEN 'goods' THEN jsonb_build_object(
      'type', 'goods',
      'checked_by', CASE ((hashtext(id::text)::bigint & 2147483647))::int % 2
        WHEN 0 THEN 'Thủ Kho Hạ Long' ELSE 'Thủ Kho Hải Phòng' END,
      'note', CASE ((hashtext(id::text)::bigint & 2147483647))::int % 5
        WHEN 0 THEN 'Đối chiếu phiếu xuất kho và biên bản giao hàng: khớp 100%'
        WHEN 1 THEN 'Kiểm tra số lượng hàng hoàn về kho đúng với số liệu tài xế báo cáo'
        WHEN 2 THEN 'Hàng xuất đủ theo lịch. Không có phát sinh chênh lệch hàng hóa'
        WHEN 3 THEN 'Một số mặt hàng hoàn lại do NPP từ chối, đã nhập lại tồn kho'
        ELSE 'Đối chiếu số lượng cuối chuyến: kết quả OK, không có mất mát'
      END
    )
    ELSE jsonb_build_object(
      'type', 'asset',
      'note', CASE ((hashtext(id::text)::bigint & 2147483647))::int % 4
        WHEN 0 THEN 'Kiểm tra pallet, cần kéo và thùng chứa: đủ số lượng sau chuyến'
        WHEN 1 THEN 'Tài sản trả về kho đủ. Không mất mát thiết bị hỗ trợ giao hàng'
        WHEN 2 THEN 'Kiểm tra máy POS, máy scan: hoạt động bình thường sau chuyến'
        ELSE 'Đối chiếu tài sản: OK. Tài xế bàn giao đủ thiết bị trước khi nghỉ'
      END
    )
  END;

-- =============================================================================
-- DRIVER_CHECKINS.NOTE
-- =============================================================================
UPDATE driver_checkins SET note =
  CASE status
    WHEN 'leave' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 5
        WHEN 0 THEN 'Nghỉ phép năm theo kế hoạch. Đã bàn giao xe cho tài xế hỗ trợ'
        WHEN 1 THEN 'Nghỉ phép có lương. Đơn nghỉ phép đã được quản lý duyệt qua hệ thống'
        WHEN 2 THEN 'Nghỉ phép cá nhân, đã thông báo trước 3 ngày theo quy định'
        WHEN 3 THEN 'Nghỉ phép định kỳ tháng. Xe được bàn giao cho tài xế thay thế'
        ELSE 'Nghỉ phép: sự kiện gia đình quan trọng. Đã xin phép quản lý và được chấp thuận'
      END
    WHEN 'sick' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 4
        WHEN 0 THEN 'Ốm: sốt cao, đã đi khám bác sĩ. Có giấy nghỉ ốm từ bệnh viện'
        WHEN 1 THEN 'Nghỉ bệnh: đau đầu, chóng mặt, không đủ điều kiện an toàn để lái xe. Đã báo quản lý'
        WHEN 2 THEN 'Nghỉ ốm: mệt mỏi, sốt nhẹ. Có đơn thuốc từ phòng khám, nghỉ 1 ngày'
        ELSE 'Nghỉ ốm đột xuất, đã gọi điện báo trưởng nhóm từ 5h sáng. Xe được bố trí tài xế khác'
      END
    WHEN 'training' THEN
      CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
        WHEN 0 THEN 'Đào tạo lái xe an toàn tháng theo kế hoạch của công ty'
        WHEN 1 THEN 'Tham gia khóa huấn luyện kỹ năng giao hàng và chăm sóc khách hàng'
        ELSE 'Đào tạo quy trình mới: sử dụng app giao hàng phiên bản cập nhật'
      END
    ELSE NULL
  END
WHERE status IN ('leave','sick','training') AND note IS NULL;

UPDATE driver_checkins SET note =
  CASE ((hashtext(id::text)::bigint & 2147483647))::int % 3
    WHEN 0 THEN 'Check-in đúng giờ. Xe đã kiểm tra đủ nhiên liệu, áp suất lốp OK'
    WHEN 1 THEN 'Sẵn sàng nhận lịch chạy. Đã nhận briefing từ điều phối về chuyến hôm nay'
    ELSE 'Nhận xe từ ca trước. Không phát sinh sự cố đêm qua, xe tình trạng tốt'
  END
WHERE status = 'available' AND note IS NULL
  AND ((hashtext(id::text)::bigint & 2147483647))::int % 5 IN (0,1,2);

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT 'entity_events'              AS table_name, COUNT(*) AS records FROM entity_events
UNION ALL
SELECT 'order_notes',                              COUNT(*) FROM order_notes
UNION ALL
SELECT 'payments with notes',                      COUNT(*) FROM payments WHERE notes IS NOT NULL
UNION ALL
SELECT 'epod with notes',                          COUNT(*) FROM epod WHERE notes IS NOT NULL
UNION ALL
SELECT 'epod with reject_detail',                  COUNT(*) FROM epod WHERE reject_detail IS NOT NULL
UNION ALL
SELECT 'reconciliations enriched',                 COUNT(*) FROM reconciliations WHERE details ? 'note'
UNION ALL
SELECT 'driver_checkins with note',                COUNT(*) FROM driver_checkins WHERE note IS NOT NULL
ORDER BY table_name;
