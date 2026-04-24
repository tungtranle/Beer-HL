-- Auto-generated: Import 218 NPPs from "Data for test.xlsx"
-- Generated: 2026-04-17T08:57:36.254Z

BEGIN;

-- Delete all dependent data first
DELETE FROM trip_stops;
DELETE FROM trips;
DELETE FROM shipments;
DELETE FROM order_items;
DELETE FROM sales_orders;
DELETE FROM credit_limits;
DELETE FROM receivable_ledger;
DELETE FROM customers;

INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-112', 'Công ty TNHH Chín Loan', 'Thôn Phúc Long,Xã Tăng Tiến,Huyện Việt Yên,Tỉnh Bắc Giang', 'Bắc Giang', 106.1998, 21.2819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-5', 'Hoàng Thị Tiến-BG-5', 'Tân Yên - Bắc Giang', 'Bắc Giang', 106.14, 21.38, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-3', 'Hoàng Văn Nam-BG-3', 'Số 2 Hoàng Công Phụ - Trần Nguyên Hãn - Bắc Giang', 'Bắc Giang', 106.1998, 21.2819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-2', 'Hà Trọng Tưởng-BG-2', 'Phố Bằng - An Hà - Lạng Giang - Bắc Giang', 'Bắc Giang', 106.249, 21.349, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-12', 'Hồ Thành-BG-12', 'Cổng Chợ Trung Tâm,Khu 3,TT.An Châu,Sơn Động,Bắc Giang', 'Bắc Giang', 106.713, 21.335, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-21', 'Lê Ngọc Huân-BG-21', 'Thôn Chùa - An Thịnh - Lục Yên - Yên Bái', 'Bắc Giang', 106.1998, 21.2819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-8', 'Nguyễn Công Nguyệt-BG-8', 'TT.Thắng-H.Hiệp Hòa-T.Bắc Giang', 'Bắc Giang', 106.052, 21.352, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-9', 'Nguyễn Quý Hợi-BG-9', 'Giáp Nguột - Dĩnh Kế - Bắc Giang', 'Bắc Giang', 106.1998, 21.2819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-4', 'Nguyễn Thành Oanh-BG-4', 'Phố Thống Nhất- TT Bố Hạ - Yên Thế -Bắc Giang', 'Bắc Giang', 106.134, 21.425, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-19', 'Nguyễn Thị Bình-BG-19', 'Tổ 3, TT Vôi, Lạng Giang, Bắc Giang', 'Bắc Giang', 106.249, 21.349, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-15', 'Nguyễn Văn Khánh-BG-15', 'Lạng Giang - Bắc Giang', 'Bắc Giang', 106.249, 21.349, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-20', 'Nguyễn Văn Thảo-BG-20', 'Xã Phương Sơn, Lục Nam, Bắc Giang', 'Bắc Giang', 106.372, 21.272, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-11', 'Nguyễn Văn Tùng-BG-11', 'Thôn Ải - Phượng Sơn - Lục Ngạn - Bắc Giang', 'Bắc Giang', 106.514, 21.373, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-6', 'Ngụy Văn Cao-BG-6', 'Thôn Nguyễn-Tân An-Yên Dũng-Bắc Giang', 'Bắc Giang', 106.293, 21.215, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-4837', 'Phan Thành Luân-BG-4837', 'Khu 1-TT.An Châu - Sơn Động-Bắc Giang', 'Bắc Giang', 106.713, 21.335, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-10', 'Phạm Phú Lương-BG-10', 'Khu Dốc Đồn-TT Chũ-Lục Ngạn-Tỉnh Bắc Giang', 'Bắc Giang', 106.514, 21.373, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-14', 'Phạm Thanh Dũng-BG-14', 'Huyện Yên Dũng-Tỉnh Bắc Giang', 'Bắc Giang', 106.293, 21.215, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-22', 'Phạm Văn Hưng-BG-22', 'Khu 2, TT.Bích Động, Việt Yên, Bắc Giang', 'Bắc Giang', 106.098, 21.279, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-18', 'Phạm Văn Tuyên-BG-18', 'Thôn An Mô, Xã Liên Chung, H. Tân Yên, T. Bắc Giang', 'Bắc Giang', 106.14, 21.38, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-7', 'Trần Văn Huệ-BG-7', 'Tổ 6 TT Thắng - Hiệp Hoà - Bắc Giang', 'Bắc Giang', 106.052, 21.352, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-16', 'Đồng Quang Minh-BG-16', 'X.Neo,H.Yên Dũng,T.Bắc Giang', 'Bắc Giang', 106.293, 21.215, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BG-13', 'Đặng Văn Trung-BG-13', 'Lục Nam - Bắc Giang', 'Bắc Giang', 106.372, 21.272, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-24', 'Bùi Quang Trường-BN-24', 'K1-TT Chờ - Yên Phong - Bắc Ninh', 'Bắc Ninh', 106.005, 21.21, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4836', 'Nguyễn Mạnh Tương-BN-4836', 'SN 23/5, TT Hồ, H. Thuận Thành, T. Bắc Ninh', 'Bắc Ninh', 106.099, 21.03, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-23', 'Nguyễn Thị Biên Thùy-BN-23', 'Thôn Liễu Thượng -Đại Xuân - Quế Võ - Bắc Ninh', 'Bắc Ninh', 106.152, 21.133, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-26', 'Nguyễn Thị Thanh-BN-26', 'Tổ 3, Khu 2, TT Gia Bình, Bắc Ninh', 'Bắc Ninh', 106.179, 21.065, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4833', 'Nguyễn Văn Cường-BN-4833', 'TT Thứa-Lương Tài-Bắc Ninh', 'Bắc Ninh', 106.232, 21.065, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4834', 'Nguyễn Văn Linh-BN-4834', 'SN 53 đường Phú Xuân, tổ 3, khu Phú Xuân, phường Đại Phúc, TP Bắc Ninh', 'Bắc Ninh', 106.0763, 21.1862, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-25', 'Phạm Chí Kiên-BN-25', 'TT Hồ - Thuận Thành - Bắc Ninh', 'Bắc Ninh', 106.099, 21.03, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4835', 'Trần Thanh Lâm-BN-4835', 'Xuân Lai, Gia Bình, Bắc Ninh', 'Bắc Ninh', 106.179, 21.065, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4832', 'Trần Thị Thu Phương-BN-4832', 'Đường Thành, An Bình, Từ Sơn, Bắc Ninh', 'Bắc Ninh', 105.967, 21.114, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-27', 'Trần Văn Chiến-BN-27', 'Tiên Du - Bắc Ninh', 'Bắc Ninh', 106.015, 21.126, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-4831', 'Vũ Đức Tuấn-BN-4831', 'Yên Phong - Bắc Ninh', 'Bắc Ninh', 106.005, 21.21, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BN-28', 'Đặng Lê Dũng-BN-28', 'Khu Viềng-Phố Mới-Quế Võ-Bắc Ninh', 'Bắc Ninh', 106.152, 21.133, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4753', 'Bùi Huy Huy-HY-4753', 'TT Ân Thi - Ân Thi - Hưng Yên', 'Hưng Yên', 106.065, 20.735, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4839', 'Bùi Tiến Phát-HY-4839', 'Thôn Yên Vĩnh, xã Nghĩa Trụ, huyện Văn Giang, Hưng Yên', 'Hưng Yên', 105.94, 20.95, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4758', 'Dương Anh Quân-HY-4758', 'Khoái Châu - Hưng Yên', 'Hưng Yên', 105.959, 20.752, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4755', 'Lưu Quý Mão-HY-4755', 'Yên Mỹ - Hưng Yên', 'Hưng Yên', 106.014, 20.837, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4752', 'Nguyễn Thị Hiếu-HY-4752', 'Tiên Lữ - Hưng Yên', 'Hưng Yên', 106.114, 20.62, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4757', 'Nguyễn Văn Hiến-HY-4757', 'Kim Động - Hưng Yên', 'Hưng Yên', 106.023, 20.672, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4756', 'Nguyễn Văn Kỳ-HY-4756', 'Phù Cừ - Hưng Yên', 'Hưng Yên', 106.172, 20.696, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-97', 'Nguyễn Văn Nam-HY-97', 'Văn Lâm - Hưng Yên', 'Hưng Yên', 106.015, 20.945, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-100', 'Nguyễn Văn Thực-HY-100', 'Phố Nối - Mỹ Hào - Hưng Yên', 'Hưng Yên', 106.089, 20.86, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4838', 'Nguyễn Đăng Chiến-HY-4838', 'Khoái Châu - Hưng Yên', 'Hưng Yên', 105.959, 20.752, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4754', 'Phạm Duy Vĩ-HY-4754', 'Mỹ Hào - Hưng Yên', 'Hưng Yên', 106.089, 20.86, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-4840', 'Phạm Ngọc Thuận-HY-4840', 'Văn Giang - Hưng Yên', 'Hưng Yên', 105.94, 20.95, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-99', 'Phạm Ngọc Ánh-HY-99', 'Thôn Thanh Xá,X.Thanh Long-H.Yên Mỹ-T.Hưng Yên', 'Hưng Yên', 106.014, 20.837, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-98', 'Phạm Văn Thái-HY-98', 'TT Ân Thi - H.Ân Thi - T.Hưng Yên', 'Hưng Yên', 106.065, 20.735, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-96', 'Trần Văn Chung-HY-96', 'Số 12, Ngõ 95 Phố Mới - phường Lam Sơn - TP Hưng Yên', 'Hưng Yên', 106.0515, 20.6463, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HY-95', 'Đặng Đình Xuân-HY-95', 'Thị trấn - Văn Lâm - Hưng Yên', 'Hưng Yên', 106.015, 20.945, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-70', 'Bùi Đình Nghiệp-HD-70', 'Thôn Ô Xuyên, xã Cổ Bì, huyện Bình Giang, Hải Dương', 'Hải Dương', 106.247765, 20.859175, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-75', 'Cao Anh Tuấn-HD-75', 'Bình Giang - Hải Dương', 'Hải Dương', 106.197, 20.867, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-113', 'Cty TNHH TM và DV Phú Sơn', 'Nghĩa An, Ninh Giang, Hải Dương', 'Hải Dương', 106.323, 20.748, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-80', 'Dư Hồng Quân-HD-80', 'Thôn Lôi Khê, X. Thái Học, H.Bình Giang, T.Hải Dương', 'Hải Dương', 106.197, 20.867, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-51', 'Dương Quý Hợi-HD-51', 'Thôn Tiền Trung- X.Việt Hồng -H.Thanh Hà -T.Hải Dương', 'Hải Dương', 106.368, 20.855, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-71', 'Hoàng Văn Thưởng-HD-71', 'Bình Giang - Hải Dương', 'Hải Dương', 106.197, 20.867, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-54', 'Lê Thị Chính-HD-54', 'Xã Cổ Dũng-H.Kim Thành-T.Hải Dương', 'Hải Dương', 106.481, 20.94, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-77', 'Lê Thị Thanh Tuyết-HD-77', 'TT Kẻ Sặt-H.Bình Giang-T.Hải Dương', 'Hải Dương', 106.197, 20.867, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-56', 'Lê Văn Mạnh-HD-56', 'Ninh Giang - Hải Dương', 'Hải Dương', 106.323, 20.748, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-83', 'Lưu Đình Hiến-HD-83', 'X.Thanh Sơn-H.Thanh Hà-T.Hải Dương', 'Hải Dương', 106.368, 20.855, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-74', 'Lương Quang Vịnh-HD-74', 'TT.Nam Sách-H.Nam Sách-T.Hải Dương', 'Hải Dương', 106.342, 21.001, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-68', 'Nguyễn Duy Khánh-HD-68', 'Tứ Kỳ - Hải Dương', 'Hải Dương', 106.344, 20.807, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-78', 'Nguyễn Thế Anh-HD-78', 'X.Gia Xuyên-H.Gia Lộc-T.Hải Dương', 'Hải Dương', 106.243, 20.858, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-50', 'Nguyễn Trung Thành-HD-50', 'Khu Bãi Xuyên-P.Tân Bình-TX.Chí Linh-T.Hải Dương', 'Hải Dương', 106.392, 21.135, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-55', 'Nguyễn Thị Hiên-HD-55', 'Thôn Nam Đông-X.Cổ Thành-TX.Chí Linh-T.Hải Dương', 'Hải Dương', 106.392, 21.135, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-72', 'Nguyễn Văn Lai-HD-72', 'Thôn Bình Phiên, xã Cổ Bì, Bình Giang, Hải Dương', 'Hải Dương', 106.197, 20.867, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-66', 'Nguyễn Văn Quyền-HD-66', 'Hải Dương', 'Hải Dương', 106.3146, 20.9373, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-67', 'Phạm Văn Bốn-HD-67', 'Hải Dương', 'Hải Dương', 106.3146, 20.9373, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NG-109', 'Phan Đăng Kế-NG-109', 'Ninh Giang -Hải Dương', 'Hải Dương', 106.323, 20.748, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-57', 'Phạm Hồng Thái-HD-57', 'Kinh Môn - Hải Dương', 'Hải Dương', 106.483, 21.036, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-52', 'Phạm Ngọc Thắng-HD-52', 'X.Hoàng Tân-H.Chí Linh-T.Hải Dương', 'Hải Dương', 106.392, 21.135, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-79', 'Phạm Văn Hiếu-HD-79', 'Cẩm Giàng - Hải Dương', 'Hải Dương', 106.22, 20.965, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-76', 'Phạm Văn Tuyền-HD-76', 'Thanh Miện - Hải Dương', 'Hải Dương', 106.188, 20.759, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-82', 'Trần Ngọc Dũng-HD-82', 'Cẩm Giàng - Hải Dương', 'Hải Dương', 106.22, 20.965, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-53', 'Trần Ngọc Sáng-HD-53', 'Kim Thành - Hải Dương', 'Hải Dương', 106.481, 20.94, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-4848', 'Trần Văn Xuân-HD-4848', 'Cẩm Giàng - Hải Dương', 'Hải Dương', 106.22, 20.965, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-73', 'Trần Đức Phúc-HD-73', 'Thôn Trại Bắc, X.Bắc An, H.Chí Linh, T.Hải Dương', 'Hải Dương', 106.392, 21.135, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-69', 'Trịnh Đức Ngọ-HD-69', 'Tứ Kỳ - Hải Dương', 'Hải Dương', 106.344, 20.807, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-81', 'Vũ Thị Thanh Huệ-HD-81', 'Gia Lộc - Hải Dương', 'Hải Dương', 106.243, 20.858, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-84', 'Vũ Thị Thu Hường-HD-84', 'Gia Lộc - Hải Dương', 'Hải Dương', 106.243, 20.858, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-4844', 'Vũ Tiến Đạt-HD-4844', 'X.Văn Hội-H.Ninh Giang-T.Hải Dương', 'Hải Dương', 106.323, 20.748, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-4843', 'Đào Duy Thăng-HD-4843', 'Khu Tân Bình-TX.Chí Linh-T.Hải Dương', 'Hải Dương', 106.392, 21.135, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HD-4845', 'Đặng Ngọc Hoàng-HD-4845', 'Thanh Hà - Hải Dương', 'Hải Dương', 106.368, 20.855, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4745', 'Hoàng Sĩ Hậu-HP-4745', 'Quán Bơ - Du Lễ - Kiến Thụy - Hải Phòng', 'Hải Phòng', 106.63405, 20.736416, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4750', 'Lê Thị Thanh Chi-HP-4750', 'SN35-Tổ dân phố 7- Cát Bà - Hải Phòng', 'Hải Phòng', 106.8919, 20.8044, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-40', 'Nguyễn Thị Thanh Nhung-HP-40', 'Lê Chân - Hải Phòng', 'Hải Phòng', 106.68, 20.85, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-43', 'Nguyễn Văn Dũng-HP-43', 'Kiến An - Hải Phòng', 'Hải Phòng', 106.626, 20.826, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4748', 'Nguyễn Văn Tuấn-HP-4748', 'Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.666, 20.9429, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-45', 'Nguyễn Văn Đạt-HP-45', 'Thôn 5 - Đông Sơn -Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.666, 20.9429, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-41', 'Nguyễn Đức Thiệu-HP-41', 'An Dương - Hải Phòng', 'Hải Phòng', 106.614, 20.8679, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-42', 'Phạm Duy Hải-HP-42', 'Xã Ngũ Phúc - Kiến Thụy - Hải Phòng', 'Hải Phòng', 106.6256, 20.742, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4741', 'Phạm Ngọc Lâm-HP-4741', 'An Lão - Hải Phòng', 'Hải Phòng', 106.5543, 20.8142, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4742', 'Phạm Thị Ngát-HP-4742', 'Kiến Thụy - Hải Phòng', 'Hải Phòng', 106.6256, 20.742, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4746', 'Phạm Văn Hải-HP-4746', 'Kiến An - Hải Phòng', 'Hải Phòng', 106.626, 20.826, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4749', 'Phạm Văn Liêm-HP-4749', 'An Dương - Hải Phòng', 'Hải Phòng', 106.614, 20.8679, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-46', 'Trần Quốc Phương-HP-46', 'An Lão - Hải Phòng', 'Hải Phòng', 106.5543, 20.8142, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4744', 'Trần Quốc Phương-HP-4744', 'Tiên Lãng - Hải Phòng', 'Hải Phòng', 106.5656, 20.7244, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-48', 'Trần Văn Cường-HP-48', 'Vĩnh Bảo - Hải Phòng', 'Hải Phòng', 106.4826, 20.7179, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4743', 'Trần Văn Thuấn-HP-4743', 'Đồ Sơn - Hải Phòng', 'Hải Phòng', 106.7626, 20.7098, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-47', 'Trần Văn Tính-HP-47', 'Tiên Lãng - Hải Phòng', 'Hải Phòng', 106.5656, 20.7244, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4751', 'Vũ Hùng Mạnh-HP-4751', 'Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.666, 20.9429, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4747', 'Vũ Tuấn Cường-HP-4747', 'Vĩnh Bảo - Hải Phòng', 'Hải Phòng', 106.4826, 20.7179, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-39', 'Vũ Văn Minh-HP-39', 'Hải Phòng', 'Hải Phòng', 106.688, 20.8449, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4740', 'Đỗ Duy Đạt-HP-4740', 'Hải Phòng', 'Hải Phòng', 106.688, 20.8449, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-38', 'Đỗ Văn Nam-HP-38', 'Thuỷ Nguyên - Hải Phòng', 'Hải Phòng', 106.61736, 20.952616, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-49', 'Đỗ Văn Sơn-HP-49', 'Vĩnh Niệm, Lê Chân, Hải Phòng', 'Hải Phòng', 106.68, 20.85, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-44', 'Đỗ Văn Tuyên-HP-44', 'An Dương - Hải Phòng', 'Hải Phòng', 106.614, 20.8679, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4739', 'Đỗ Đức Thuận-HP-4739', 'Đặng Cương - An Dương - Hải Phòng', 'Hải Phòng', 106.614, 20.8679, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HP-4738', 'Đinh Văn Ngà-HP-4738', 'An Lão - Hải Phòng', 'Hải Phòng', 106.5543, 20.8142, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('LS-104', 'Hoàng Kim Tuyền-LS-104', 'Chi Lăng - Lạng Sơn', 'Lạng Sơn', 106.61, 21.65, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('LS-107', 'Hoàng Minh Hiếu-LS-107', 'Hữu Lũng - Lạng Sơn', 'Lạng Sơn', 106.35, 21.5, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('LS-105', 'Trần Văn Hoàn-LS-105', 'Bắc Sơn - Lạng Sơn', 'Lạng Sơn', 106.32, 21.89, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('LS-106', 'Tống Đức Tuệ-LS-106', 'Văn Quan - Lạng Sơn', 'Lạng Sơn', 106.54, 21.86, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('LS-103', 'Vi Đức Nghiêm-LS-103', 'Lạng Sơn', 'Lạng Sơn', 106.7572, 21.8537, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4776', 'Hoàng Minh Quân-NĐ-4776', 'Giao Thủy - Nam Định', 'Nam Định', 106.359, 20.265, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4767', 'Lê Thị Nhẫn-NĐ-4767', 'Nam Định', 'Nam Định', 106.1652, 20.4274, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4773', 'Nguyễn Danh Tuyên-NĐ-4773', 'Ý Yên - Nam Định', 'Nam Định', 105.966, 20.335, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4768', 'Nguyễn Thanh Bình-NĐ-4768', 'Trực Ninh - Nam Định', 'Nam Định', 106.182, 20.325, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4772', 'Nguyễn Thị Loan-NĐ-4772', 'Vụ Bản - Nam Định', 'Nam Định', 106.069, 20.375, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4771', 'Nguyễn Thị Mai-NĐ-4771', 'Xuân Trường - Nam Định', 'Nam Định', 106.24, 20.323, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4774', 'Nguyễn Thị Phú-NĐ-4774', 'Hải Hậu - Nam Định', 'Nam Định', 106.233, 20.276, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4770', 'Nguyễn Văn Sáu-NĐ-4770', 'Nghĩa Hưng - Nam Định', 'Nam Định', 106.132, 20.235, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4769', 'Nguyễn Văn Thanh-NĐ-4769', 'Mỹ Lộc - Nam Định', 'Nam Định', 106.124, 20.458, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4766', 'Phạm Quang Hòa-NĐ-4766', 'Nam Trực - Nam Định', 'Nam Định', 106.138, 20.362, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4775', 'Phạm Thị Dung-NĐ-4775', 'Giao Thủy - Nam Định', 'Nam Định', 106.359, 20.265, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4765', 'Trần Văn Chiến-NĐ-4765', 'Nam Định', 'Nam Định', 106.1652, 20.4274, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4764', 'Vũ Thị Thanh-NĐ-4764', 'Nam Định', 'Nam Định', 106.1652, 20.4274, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4762', 'Đặng Thế Đạt-NĐ-4762', 'Nam Định', 'Nam Định', 106.1652, 20.4274, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NĐ-4763', 'Đặng Văn Thiện-NĐ-4763', 'Nam Định', 'Nam Định', 106.1652, 20.4274, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4782', 'Nguyễn Thị Lệ-NB-4782', 'Ninh Bình', 'Ninh Bình', 105.9741, 20.2506, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4781', 'Nguyễn Thị Tuyến-NB-4781', 'Ninh Bình', 'Ninh Bình', 105.9741, 20.2506, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4779', 'Phạm Thị Hoa-NB-4779', 'Kim Sơn - Ninh Bình', 'Ninh Bình', 106.087, 20.144, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4783', 'Phạm Thị Thanh Hoa-NB-4783', 'Yên Khánh - Ninh Bình', 'Ninh Bình', 106.072, 20.23, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4780', 'Phạm Thế Quyền-NB-4780', 'Nho Quan - Ninh Bình', 'Ninh Bình', 105.752, 20.32, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NB-4778', 'Phạm Văn Hùng-NB-4778', 'Ninh Bình', 'Ninh Bình', 105.9741, 20.2506, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('PT-4777', 'Nguyễn Thị Thu Hà-PT-4777', 'Việt Trì - Phú Thọ', 'Phú Thọ', 105.401, 21.306, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-VTD', 'Chi nhánh Cty TNHH vòng tròn đỏ tại Hà Nội', 'Số 8-Phan Văn Trường-Dịch Vọng Hậu-Cầu Giấy-Hà Nội', 'Quảng Ninh', 105.7823, 21.034, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-LSHD', 'Công ty TNHH Lâm Sinh Hoàng Duy', 'Công ty TNHH Lâm Sinh Hoàng Duy', 'Quảng Ninh', 107.0844, 20.9517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-HH', 'Công ty TNHH MTV TM Hồng Hải HL', 'Số 5-Phố Kim Hoàn-Bạch Đằng-Hạ Long-QN', 'Quảng Ninh', 107.08608, 20.952538, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-HH2', 'Công ty TNHH TMTH và DV Hằng Hiền', 'Tổ 5 khu Tân Lập 4-Cẩm Thủy-Cẩm Phả-QN', 'Quảng Ninh', 107.2502, 21.0234, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-TN', 'Cty TNHH nông nghiệp quốc tế Thái Nguyên', 'Thái Nguyên', 'Quảng Ninh', 105.8441, 21.5928, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-KK', 'KHÁCH KHÔNG RÕ TÊN', 'Chưa có địa chỉ', 'Quảng Ninh', 107.0844, 20.9517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HB-73', 'Lại Thị Quyên-HB-73', 'Tổ 5 khu 1,TT Trới-H.Hoành Bồ-T.Quảng Ninh', 'Quảng Ninh', 107.0148, 21.0541, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HH2-70', 'Lê Thị Nga-HH2-70', 'Hải Hà - Quảng Ninh', 'Quảng Ninh', 107.7122, 21.4491, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('ĐT1-32', 'Lê Trọng Nghĩa-ĐT1-32', 'Đông Triều - Quảng Ninh', 'Quảng Ninh', 106.4995, 21.0684, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TY-118', 'Ma Quang Mạnh-TY-118', 'Tiên Yên - Quảng Ninh', 'Quảng Ninh', 107.3956, 21.3449, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NT1-3-4847', 'Mai Duy Tùng-NT1-3-4847', 'Số 140-Tổ 41-Khu 3-P.Bạch Đằng-TP.Hạ Long-QN', 'Quảng Ninh', 107.08, 20.953, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QN-NTD', 'NGƯỜI TIÊU DÙNG KHU VỰC QUẢNG NINH', 'Chưa có địa chỉ', 'Quảng Ninh', 107.0844, 20.9517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NT1-3-115', 'Nguyễn Duy Anh-NT1-3-115', 'Số nhà 36, Ô số 35 lô A7 khu đô thị cột 5-cột 8, P.Hồng Hà, Hạ Long', 'Quảng Ninh', 107.13012, 20.940548, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NT1-3-110', 'Nguyễn Duy Hải-NT1-3-110', 'Hạ Long - Quảng Ninh', 'Quảng Ninh', 107.0844, 20.9517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('VD2-142', 'Nguyễn Thị Cậy-VD2-142', 'Vân Đồn - Quảng Ninh', 'Quảng Ninh', 107.4181, 20.9025, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('BL-137', 'Nguyễn Thị Hải Yến-BL-137', 'Bình Liêu - Quảng Ninh', 'Quảng Ninh', 107.37, 21.53, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('ĐT2-140', 'Nguyễn Thị Thanh Tâm-ĐT2-140', 'Đông Triều - Quảng Ninh', 'Quảng Ninh', 106.4995, 21.0684, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('DT1-34', 'Nguyễn Thị Yến-DT1-34', 'Đông Triều - Quảng Ninh', 'Quảng Ninh', 106.4995, 21.0684, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TY-122', 'Ngô Hiếu Công-TY-122', 'Tiên Yên - Quảng Ninh', 'Quảng Ninh', 107.3956, 21.3449, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('MC4-93', 'Ngô Thị Hường-MC4-93', 'Móng Cái - Quảng Ninh', 'Quảng Ninh', 107.9662, 21.5241, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('CP2-29', 'Phạm Thị Nhung-CP2-29', 'Cẩm Phả - Quảng Ninh', 'Quảng Ninh', 107.2502, 21.0234, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('VD2-143', 'Phạm Văn Cửu-VD2-143', 'Vân Đồn - Quảng Ninh', 'Quảng Ninh', 107.4181, 20.9025, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-48', 'Phạm Văn Thụ-HNI-48', 'Làng Bè-An Khoái-Phúc Tiến-Phú Xuyên-Hà Nội', 'Quảng Ninh', 105.8073, 20.9913, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QY-121', 'Tạ Hữu Bản-QY-121', 'Uông Bí - Quảng Ninh', 'Quảng Ninh', 106.7766, 21.0346, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NT5-139', 'Trần Thị Thanh Dung-NT5-139', 'Hạ Long - Quảng Ninh', 'Quảng Ninh', 107.0844, 20.9517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QY2-136', 'Trần Văn Quân-QY2-136', 'Quảng Yên - Quảng Ninh', 'Quảng Ninh', 106.8053, 20.9399, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('NT6BC-115', 'Vũ Minh Chung-NT6BC-115', 'Cao Xanh-Hạ Long-Quảng Ninh', 'Quảng Ninh', 107.075, 20.96, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HH1-35', 'Vũ Ngọc Thắng-HH1-35', 'Quảng Thành-Hải Hà-Quảng Ninh', 'Quảng Ninh', 107.7122, 21.4491, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('QY-120', 'Vũ Tuấn Dũng-QY-120', 'Minh Thành-Yên Hưng-Quảng Ninh', 'Quảng Ninh', 106.8053, 20.9399, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HH2-69', 'Vũ Văn Tuyên-HH2-69', 'Hải Hà - Quảng Ninh', 'Quảng Ninh', 107.7122, 21.4491, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('CP-138', 'Vũ Xuân Hải-CP-138', 'Cẩm Phả - Quảng Ninh', 'Quảng Ninh', 107.2502, 21.0234, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TY-117', 'Đào Anh Tuấn-TY-117', 'Tiên Yên - Quảng Ninh', 'Quảng Ninh', 107.3956, 21.3449, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('DT1-33', 'Đỗ Thị Yến-DT1-33', 'Đông Triều - Quảng Ninh', 'Quảng Ninh', 106.4995, 21.0684, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('UB-4846', 'Đỗ Xuân Hải-UB-4846', 'Uông Bí - Quảng Ninh', 'Quảng Ninh', 106.7766, 21.0346, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('UB-90', 'Đỗ Xuân Hùng-UB-90', 'Uông Bí - Quảng Ninh', 'Quảng Ninh', 106.7766, 21.0346, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('DH-141', 'Đặng Sỹ Mạnh-DH-141', 'Đầm Hà - Quảng Ninh', 'Quảng Ninh', 107.5883, 21.3486, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('MC-91', 'Đặng Thị Thu Hường-MC-91', 'Móng Cái - Quảng Ninh', 'Quảng Ninh', 107.9662, 21.5241, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('MC-92', 'Đặng Thị Thu Hường-MC-92', 'Móng Cái - Quảng Ninh', 'Quảng Ninh', 107.9662, 21.5241, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('CP3-94', 'Đinh Văn Minh-CP3-94', 'Cẩm Phả - Quảng Ninh', 'Quảng Ninh', 107.2502, 21.0234, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-133', 'Nguyễn Văn Khu-TB-133', 'Đông Đô-Hưng Hà-Thái Bình', 'Quảng Ninh', 106.218, 20.598, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HCM-116', 'Cty TNHH ĐT - PT Quốc Thái', 'TP.Hồ Chí Minh', 'TP. Hồ Chí Minh', 106.6297, 10.8231, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TH-4784', 'Lê Quốc Tuấn-TH-4784', 'Thanh Hóa', 'Thanh Hóa', 105.7875, 19.8067, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TH-4786', 'Lê Sỹ Tình-TH-4786', 'Thanh Hóa', 'Thanh Hóa', 105.7875, 19.8067, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TH-4785', 'Nguyễn Văn Xuân-TH-4785', 'Thanh Hóa', 'Thanh Hóa', 105.7875, 19.8067, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-134', 'Hoàng Văn Lưu-HNI-134', 'Hà Đông - Hà Nội', 'Hà Nội', 105.7719, 20.9711, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-135', 'Hoàng Văn Quang-HNI-135', 'Thanh Xuân - Hà Nội', 'Hà Nội', 105.8073, 20.9913, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-4787', 'Nguyễn Đình Chiểu-HNI-4787', 'Hà Đông - Hà Nội', 'Hà Nội', 105.7719, 20.9711, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-4788', 'Trịnh Đức Nhật-HNI-4788', 'Thanh Xuân - Hà Nội', 'Hà Nội', 105.8073, 20.9913, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('HNI-4789', 'Đặng Minh Tuấn-HNI-4789', 'Hà Đông - Hà Nội', 'Hà Nội', 105.7719, 20.9711, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-114', 'Cty TNHH TM và DV Thành Anh', 'Thôn Nam Tiền,Hòa Bình,Kiến Xương,Thái Bình', 'Thái Bình', 106.376, 20.392, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4760', 'Lê Minh Phương-TB-4760', 'Tiền Hải - Thái Bình', 'Thái Bình', 106.521, 20.358, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4761', 'Lý Văn Viện-TB-4761', 'Thái Thụy - Thái Bình', 'Thái Bình', 106.529, 20.53, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-125', 'Nguyễn Quang Diện-TB-125', 'Hưng Hà - Thái Bình', 'Thái Bình', 106.218, 20.598, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-127', 'Nguyễn Quốc Trình-TB-127', 'Nam Trung-Tiền Hải-Thái Bình', 'Thái Bình', 106.521, 20.358, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4759', 'Nguyễn Thanh Tùng-TB-4759', 'Quỳnh Phụ - Thái Bình', 'Thái Bình', 106.354, 20.631, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-129', 'Nguyễn Trung Nguyện-TB-129', 'Thái Bình', 'Thái Bình', 106.3362, 20.4513, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-128', 'Nguyễn Văn Cường-TB-128', 'Vũ Thư - Thái Bình', 'Thái Bình', 106.272, 20.458, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-130', 'Nguyễn Văn Tuấn-TB-130', 'Kiến Xương - Thái Bình', 'Thái Bình', 106.376, 20.392, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-123', 'Nguyễn Văn Tường-TB-123', 'Hưng Hà - Thái Bình', 'Thái Bình', 106.218, 20.598, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-131', 'Nguyễn Văn Vinh-TB-131', 'Thái Bình', 'Thái Bình', 106.3362, 20.4513, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4758', 'Phạm Minh Huế-TB-4758', 'Quỳnh Phụ - Thái Bình', 'Thái Bình', 106.354, 20.631, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-132', 'Phạm Văn Kỷ-TB-132', 'Kiến Xương - Thái Bình', 'Thái Bình', 106.376, 20.392, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4757', 'Phạm Xuân Yên-TB-4757', 'Đông Hưng - Thái Bình', 'Thái Bình', 106.343, 20.542, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4756', 'Trần Huy Hiệu-TB-4756', 'Thái Bình', 'Thái Bình', 106.3362, 20.4513, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-126', 'Trần Mạnh Cường-TB-126', 'Quỳnh Phụ - Thái Bình', 'Thái Bình', 106.354, 20.631, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4755', 'Trần Văn Hiếu-TB-4755', 'Vũ Thư - Thái Bình', 'Thái Bình', 106.272, 20.458, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-124', 'Trần Đình Long-TB-124', 'Đông Hưng - Thái Bình', 'Thái Bình', 106.343, 20.542, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4754', 'Vũ Ngọc Duyên-TB-4754', 'Đông Hưng - Thái Bình', 'Thái Bình', 106.343, 20.542, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4753', 'Vũ Quốc Tuấn-TB-4753', 'Thái Thụy - Thái Bình', 'Thái Bình', 106.529, 20.53, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4752', 'Vũ Thị Quế-TB-4752', 'Hưng Hà - Thái Bình', 'Thái Bình', 106.218, 20.598, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TB-4751', 'Đặng Đức Bình-TB-4751', 'Tiền Hải - Thái Bình', 'Thái Bình', 106.521, 20.358, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4798', 'Lê Thanh Cảnh-TN-4798', 'Phổ Yên - Thái Nguyên', 'Thái Nguyên', 105.869, 21.407, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4795', 'Nguyễn Mạnh Hùng-TN-4795', 'Sông Công - Thái Nguyên', 'Thái Nguyên', 105.853, 21.473, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4794', 'Nguyễn Thị Thu Hiền-TN-4794', 'Thái Nguyên', 'Thái Nguyên', 105.8441, 21.5928, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4799', 'Nguyễn Thị Thu Trang-TN-4799', 'Đại Từ - Thái Nguyên', 'Thái Nguyên', 105.704, 21.637, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4800', 'Nguyễn Trọng Toàn-TN-4800', 'Phú Bình - Thái Nguyên', 'Thái Nguyên', 106.054, 21.453, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4797', 'Nguyễn Văn Chung-TN-4797', 'Đồng Hỷ - Thái Nguyên', 'Thái Nguyên', 105.908, 21.694, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4793', 'Phạm Ngọc Linh-TN-4793', 'Thái Nguyên', 'Thái Nguyên', 105.8441, 21.5928, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4801', 'Phạm Văn Sơn-TN-4801', 'Định Hóa - Thái Nguyên', 'Thái Nguyên', 105.643, 21.841, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4796', 'Trần Quang Thạch-TN-4796', 'Phổ Yên - Thái Nguyên', 'Thái Nguyên', 105.869, 21.407, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active)
  VALUES ('TN-4802', 'Đỗ Đức Anh-TN-4802', 'Võ Nhai - Thái Nguyên', 'Thái Nguyên', 106.074, 21.763, true);

-- Credit limits for all NPPs
INSERT INTO credit_limits (customer_id, credit_limit, effective_from)
  SELECT id, 500000000, CURRENT_DATE FROM customers;

COMMIT;
-- Total: 217 NPPs imported