-- BHL NPP Real Data Import
-- Source: danh sach NPP.txt (218 NPPs)
-- Date: 2026-03-20

BEGIN;

-- 1. Truncate customers (CASCADE removes all dependent data)
TRUNCATE TABLE customers CASCADE;

-- 2. Insert real BHL NPPs

INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-001', 'NGUYỄN DUY ANH', 'Số nhà 36, Ô số 35 lô A7 khu đô thị cột 5-cột 8, P. Hồng Hà,Tp. Hạ Long, Quảng Ninh', 'Quảng Ninh', 107.13012, 20.94055, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-4745', 'Hoàng Sĩ Hậu-HP-4745', 'Quán Bơ - Du Lễ - Kiến Thụy - Hải Phòng', 'Hải Phòng', 106.63405, 20.73642, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-38', 'Đỗ Văn Nam-HP-38', 'Thuỷ Nguyên - Hải Phòng', 'Hải Phòng', 106.61736, 20.95262, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-004', 'Vũ Ngọc Duyện', 'Thôn Trà Lý- Xã Đông Quý - Huyện Tiền Hải - Tỉnh Thái Bình', 'Thái Bình', 106.52108, 20.44002, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-46', 'Nguyễn Văn Vỹ-HP-46', 'Thôn Hu Trì-X.Vinh Quang-H.Vĩnh Bảo-T.Hải Phòng', 'Hải Phòng', 106.49955, 20.65688, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-127', 'Nguyễn Quốc trình-TB-127', 'Nam Trung - Tiền Hải - Thái Bình', 'Thái Bình', 106.52894, 20.33647, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-124', 'Hoàng Văn Báu-TB-124', 'Tiền Hải - Thái Bình', 'Thái Bình', 106.51122, 20.42868, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-134', 'Trần Văn Dũng-TB-134', 'Thôn 2 - Đồng Hòa - Thụy Phong - Thái Thụy - Thái Bình', 'Thái Bình', 106.47821, 20.55331, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-59', 'Phạm Văn Đức-HD-59', 'Thôn Tân Hưng-X.Tuấn Hưng-H.Kim Thành-Hải Dương', 'Hải Dương', 106.45295, 20.97218, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-54', 'Lê Thị Chính-HD-54', 'Xã Cổ Dũng-H.Kim Thành-T.Hải Dương', 'Hải Dương', 106.44815, 20.96961, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-011', 'Công ty TNHH thương mại và dịch vụ Thành Anh', 'Thôn Nam Tiền,Hòa Bình,Kiến Xương,Thái Bình,VN', 'Thái Bình', 106.41353, 20.39964, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-53', 'Lê Văn Hoan-HD-53', 'Thôn Trung Sơn-X.Thái Sơn-H.Tứ Kỳ-T.Hải Dương', 'Hải Dương', 106.37233, 20.84743, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-60', 'Phạm Đình Luận-HD-60', 'Ba Đình -An Bình-Nam Sách - Hải Dương', 'Hải Dương', 106.37009, 21.01850, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-4844', 'Hộ kinh doanh Vũ Ngọc Anh-HD-4844', 'Số 27 Lê Chân,Phường Phạm Ngũ Lão,Thành Phố Hải Dương,Tỉnh Hải Dương', 'Hải Dương', 106.31936, 20.92264, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-015', 'DNTN TM TOÀN KHANG', 'SN 29 Trần Thái Tông,Tổ 12,Phường Bố Xuyên,Thành phố Thái Bình,Tỉnh Thái Bình,Việt Nam', 'Thái Bình', 106.33508, 20.45307, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-87', 'Vũ Trung Kiên-HY-87', 'Anh Thư - Đỗ Quang - Gia Lộc Hải Dương', 'Hưng Yên', 106.29450, 20.87548, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-4838', 'Đặng Duy Thái-HD-4838', 'Số 141, đường Yết Kiêu, thị trấn Gia Lộc, huyện Gia Lộc, tỉnh Hải Dương', 'Hải Dương', 106.29450, 20.87548, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-101', 'Trần Văn Huân-ND-101', 'Xóm 9/2-Việt Hùng-Trực Ninh-Nam Định', 'Nam Định', 106.31686, 20.26753, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-102', 'Trần Văn Huấn-ND-102', 'Việt Hùng -Trực Ninh -Nam Định', 'Nam Định', 106.31686, 20.26753, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-67', 'Vũ Trung Kiên-HD-67', 'An Thư -Đồng Quang - Gia Lộc - Hải Dương', 'Hải Dương', 106.27750, 20.80729, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-133', 'Nguyễn Văn Khu-TB-133', 'Đông Đô - Hưng hà - Thái Bình', 'Thái Bình', 106.28294, 20.60690, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-145', 'Nguyễn Văn Tài-TB-145', 'Thôn Hữu - Xã Đông Đô - Huyện Hưng Hà - Tỉnh Thái Bình', 'Thái Bình', 106.28259, 20.60712, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-70', 'Bùi Đình Nghiệp-HD-70', 'Thôn Ô Xuyên, xã Cổ Bì, huyện Bình Giang, tỉnh Hải Dương', 'Hải Dương', 106.24777, 20.85918, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-56', 'Nguyễn Thị Tám-HD-56', 'Tứ Cường -Thanh Miện -Hải Dương', 'Hải Dương', 106.24706, 20.76831, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-68', 'Vũ Tư Quyền-HD-68', 'Thị trấn Lai Cách-H.Cẩm Giàng-T.Hải Dương', 'Hải Dương', 106.24318, 20.93767, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-126', 'Lương Thị Dung-TB-126', 'Xã Xuân Hòa- huyện Vũ Thư - Thái Bình', 'Thái Bình', 106.23406, 20.49935, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-103', 'Trần Văn Tạo-ND-103', 'Xã Trực Đại - Trực Ninh - Nam Định', 'Nam Định', 106.23494, 20.20113, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-95', 'Lê Bá Hùng-ND-95', 'Thôn Nam Trực-Nam Tiến-Nam Trực-T.Nam Định', 'Nam Định', 106.19965, 20.29448, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-98', 'Trần Mạnh Hà-ND-98', 'Đường S2 - Xóm 8 - Nghĩa An - Nam Trực - Nam Định', 'Nam Định', 106.17024, 20.38805, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-99', 'Mai Văn Sơn-ND-99', 'Đường S2 - Xóm 8 - Nghĩa An - Nam Trực - Nam Định', 'Nam Định', 106.17024, 20.38805, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-100', 'Phan Văn Toàn-ND-100', 'Phú Thọ-Nam Thái-Nam Trực-T.Nam Định', 'Nam Định', 106.17541, 20.25850, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-96', 'Dương Văn Tĩnh-ND-96', 'Thống Nhất-Nghĩa Trung-Nghĩa Hưng - Nam Định', 'Nam Định', 106.17246, 20.21863, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-033', 'Công ty TNHH Thanh Ngọc Hưng Yên', 'Thôn An Tào - Cương Chính- Tiên Lữ - Hưng Yên - Việt Nam', 'Hưng Yên', 106.09065, 20.69367, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-77', 'Lương Văn Thanh-HY-77', 'Tiên Lữ - Hưng Yên', 'Hưng Yên', 106.09068, 20.69364, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NB-106', 'Trần Văn Chung-NB-106', 'Xóm 10-X.Khánh Nhạc-H.Yên Khánh-T.Ninh Bình', 'Ninh Bình', 106.08305, 20.17051, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NB-108', 'Lâm Trung Hà-NB-108', 'Phố Mỹ Sơn-TT.Me-H.Gia Viễn-T.Ninh Bình', 'Ninh Bình', 105.84625, 20.34143, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-1', 'Hải Hồng ( Tống Khắc Khoan )-BG-1', 'Thôn Đào Lạng - Bắc Lũng -Lục Nam - Bắc Giang', 'Bắc Giang', 106.38216, 21.27727, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-2', 'Hà Trọng Tưởng-BG-2', 'Phố Bằng - An Hà - Lạng Giang - Bắc Giang', 'Bắc Giang', 105.83214, 21.48241, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-3', 'Hoàng Văn Nam-BG-3', 'Số 2 Hoàng Công Phụ - Trần Nguyên Hãn - Bắc Giang', 'Bắc Giang', 106.12339, 21.19469, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-4', 'Nguyễn Thành Oanh-BG-4', 'Phố Thống Nhất- TT Bố Hạ - Yên Thế -Bắc Giang', 'Bắc Giang', 105.84783, 21.67819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-5', 'Hoàng Thị Tiến-BG-5', 'Tân Yên - Bắc Giang', 'Bắc Giang', 106.56414, 21.37060, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-6', 'Ngụy Văn Cao-BG-6', 'Thôn Nguyễn-Tân An-Yên Dũng-Bắc Giang', 'Bắc Giang', 106.37536, 21.26179, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-7', 'Lê Xuân-BG-7', 'Số 33,Đường Nguyễn Văn Tý,Khu 1,TT Bích Động,Việt Yên,Bắc Giang', 'Bắc Giang', 106.09621, 21.27760, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-8', 'Nguyễn Công Nguyệt-BG-8', 'TT.Thắng-H.Hiệp Hòa-T.Bắc Giang', 'Bắc Giang', 106.12360, 21.19479, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-9', 'Nguyễn Quý Hợi-BG-9', 'Giáp Nguột - Dĩnh Kế - Bắc Giang', 'Bắc Giang', 105.83213, 21.48257, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-10', 'Phạm Phú Lương-BG-10', 'Khu Dốc Đồn-TT Chũ-Lục Ngạn-Tỉnh Bắc Giang', 'Bắc Giang', 106.61378, 21.10788, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-11', 'Nguyễn Văn Tùng-BG-11', 'Thôn Ải - Phượng Sơn - Lục Ngạn - Bắc Giang', 'Bắc Giang', 106.32402, 21.11208, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-12', 'Hồ Thành-BG-12', 'Cổng Chợ Trung Tâm,Khu 3,TT.An Châu,Sơn Động,Bắc Giang', 'Bắc Giang', 106.39620, 21.12402, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-13', 'Phan Đình Phùng-BG-13', 'Khu 1 - TT An Châu - Sơn Động - Bắc Giang', 'Bắc Giang', 106.56409, 21.37025, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-14', 'Trần Tuấn Anh-BG-14', 'Thôn Làng Lành - Việt Ngọc -Tân Yên - Bắc Giang', 'Bắc Giang', 106.24767, 21.42394, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-15', 'Phan Văn Tuyển-BG-15', 'Thôn Dâu - Nghĩa Hưng - Lạng Giang - Bắc Giang', 'Bắc Giang', 106.81383, 21.10287, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-16', 'Trịnh Thị Vân-BG-16', 'Hoàng Liên-Hoàng An-Hiệp Hòa-Bắc Giang', 'Bắc Giang', 105.96399, 21.39372, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-17', 'Vũ Chiến Khanh-BG-17', 'Sơn Đông - Bắc Giang', 'Bắc Giang', 106.71220, 21.10683, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-18', 'Vũ Anh Nam-BG-18', 'Nhũ Nam - Tân Yên -Bắc Giang', 'Bắc Giang', 106.08820, 21.44101, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-19', 'Giáp Văn Giang-BN-19', 'Khu 3- Phường Thị Cầu-TP Bắc Ninh', 'Bắc Ninh', 106.12339, 21.19469, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-20', 'Nguyễn Đình Nhật-BN-20', 'Đa Tiện - Xuân Lâm - Thuận Thành - Bắc Ninh', 'Bắc Ninh', 106.12360, 21.19479, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-057', 'Công ty TNHH thương mại và dịch vụ Lâm Phước', 'Thôn Liễu Thượng -Đại Xuân - Quế Võ - Bắc Ninh', 'Bắc Ninh', 105.99588, 21.12505, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-22', 'Nguyễn Thị Quỳnh-BN-22', 'Khu 5-P.Đại Phúc-TP.Bắc Ninh-Bắc Ninh', 'Bắc Ninh', 105.95783, 21.19710, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-23', 'Nguyễn Thị Biên Thùy-BN-23', 'Thôn Liễu Thượng -Đại Xuân - Quế Võ - Bắc Ninh', 'Bắc Ninh', 106.15182, 21.15334, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-24', 'Nguyễn Văn Toản-BN-24', 'Tân Dân-TT Thứa-Huyện Lương Tài-Tỉnh Bắc Ninh', 'Bắc Ninh', 106.10301, 21.16868, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-25', 'Nguyễn Văn Nâu-BN-25', 'Đông Bích - Đông Thọ - Yên Phong - Bắc Ninh', 'Bắc Ninh', 105.98314, 21.10140, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-26', 'Nguyễn Văn Nghiêm-BN-26', 'Ngân Cầu- TT Chờ - Yên Phong-Bắc Ninh', 'Bắc Ninh', 105.95588, 21.19776, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-063', 'Nguyễn Ngọc Lâm-CP1-27', 'Cẩm Phả - Quảng Ninh', 'Quảng Ninh', 106.84005, 21.00918, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-064', 'Công ty TNHH TMTH và DV Hằng Hiền', 'Tổ 5 khu Tân Lập 4 -Cẩm Thủy-Cẩm Phả - Quảng Ninh - Việt Nam', 'Quảng Ninh', 106.84077, 21.00892, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-065', 'Phạm Thị Nhung-CP2-29', 'Cẩm Phả - Quảng Ninh', 'Quảng Ninh', 106.84097, 21.00823, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-066', 'Cty TNHH Lâm Sinh Hoàng Duy', 'Công ty TNHH Lâm Sinh Hoàng Duy', 'Quảng Ninh', 106.83806, 21.00705, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-067', 'Dương Văn Chiến-DT1-31', 'Thôn Trụ Hạ - Đồng Lạc -Chí Linh - Hải Dương', 'Quảng Ninh', 107.42204, 21.32641, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-068', 'Công ty TNHH thương mại và dịch vụ Vĩnh Phát', 'Vĩnh Tuy 1 -Mạo Khê -Đông Triều - Quảng Ninh', 'Quảng Ninh', 107.29560, 20.99518, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-069', 'Đỗ Thị Yến-DT1-33', 'KĐT Tân Việt Bắc - Mạo Khê - Đông Triều- Quảng Ninh', 'Quảng Ninh', 107.00779, 20.97288, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-070', 'Nguyễn Thị Yến-DT1-34', 'Khu 1 - Phường Mạo Khê - TT.Đông Triều', 'Quảng Ninh', 107.08277, 20.96697, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-071', 'Vũ Ngọc Thắng-HH1-35', 'Quảng Thành - Hải Hà - Quảng Ninh', 'Quảng Ninh', 107.10682, 20.94779, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-072', 'Công ty TNHH tư Vấn thiết kế xây dựng Vila 16', 'Thôn Đại Lộ - Tiên Cường - Tiên Lãng - Hải Phòng -VN', 'Hải Phòng', 106.49963, 20.65675, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-37', 'Lê Hồng Hưng -HP-37', 'Trung Hà - Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.45309, 20.97305, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-39', 'Nguyễn Đức Mạnh-HP-39', 'Khu Xuân Áng-TT.Trường Sơn-An Lão-Hải Phòng', 'Hải Phòng', 106.61708, 20.95228, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-40', 'Lưu Thị Hồng Phúc-HP-40', 'Hải Lộc-Cát Hải-Hải Phòng', 'Hải Phòng', 106.53090, 20.77472, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-41', 'Nguyễn Đức Mạnh B-HP-41', 'Thôn Hà Phú- Hòa Bình - Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.56696, 20.96235, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-42', 'Nguyễn Thị Bích Phượng-HP-42', 'Lâm Động - Thủy Nguyên -Hải Phòng', 'Hải Phòng', 106.64999, 20.89279, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-43', 'Nguyễn Thị Ngọc Lan-HP-43', 'Xã Lưu Kiếm - Thuỷ Nguyên - Hải Phòng', 'Hải Phòng', 106.65475, 20.83640, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-44', 'Nguyễn Văn Hải-HP-44', 'Tiến Lập-Mỹ Đức-An Lão-Hải Phòng', 'Hải Phòng', 106.50166, 20.76435, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-45', 'Nguyễn Văn Đạt-HP-45', 'Thôn 5 - Đông Sơn -Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.61297, 20.77696, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-47', 'Trần Tùng-HP-47', 'Số 98 - Đường Tư Thủy-TDP số 11 - Hòa Nghĩa - Dương Kinh-Hải Phòng', 'Hải Phòng', 106.67726, 20.82461, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HNI-48', 'Phạm Văn Thụ-HNI-48', 'Làng Bè- An Khoái - Phúc Tiến - Phú Xuyên - Hà Nội', 'Hà Nội', 105.79367, 20.97400, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-083', 'Bùi Đức Hòa-HD HD-49', 'Ngọc Châu - Hải Dương', 'Hải Dương', 106.40172, 20.73490, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-50', 'Đỗ Thị Huyền-HD-50', 'Số Nhà 26-Vũ Công Đán-Tứ Minh-Hải Dương', 'Hải Dương', 106.37011, 21.01838, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-085', 'DN tư nhân Tuyến Nga', 'Phú An - Cao An - Cẩm Giàng - Hải Dương', 'Hải Dương', 106.45309, 20.97305, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-52', 'Nguyễn Đức Việt-HD-52', 'Gia Lộc -Hải Dương', 'Hải Dương', 106.58755, 21.08294, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-55', 'Nguyễn Thị Hiên-HD-55', 'Thôn Nam Đông-X.Cổ Thành-TX.Chí Linh-T.Hải Dương', 'Hải Dương', 106.37204, 21.04520, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-57', 'Nguyễn Văn Ngọ-HD-57', 'Khu dân cư lôi Động -Cộng Hòa -Chí Linh -Hải Dương', 'Hải Dương', 106.39677, 21.12438, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-58', 'Nguyễn Văn Cường-HD-58', 'Thôn Trung Sơn-X.Thái Sơn-H.Tứ Kỳ-T.Hải Dương', 'Hải Dương', 106.58746, 21.08304, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-61', 'Phạm Thị Nhanh-HD-61', 'Kinh Môn- Hải Dương', 'Hải Dương', 106.49801, 21.08588, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-62', 'Vũ Ngọc Mười-HD-62', 'Tân Quang - Quang Khải - Tứ Kỳ - Hải Dương', 'Hải Dương', 106.55930, 21.02101, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-63', 'Phạm Văn Cao-HD-63', 'Cao Duệ -Nhật Tân - Gia Lộc -Hải Dương', 'Hải Dương', 106.45915, 21.09489, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-64', 'Tăng Văn Vĩnh-HD-64', 'Xã Gia Tân - Huyện Gia Lộc - Tỉnh Hải Dương', 'Hải Dương', 106.40430, 20.73106, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-65', 'Tạ Thị Hè-HD-65', 'Kim Thành - Hải Dương', 'Hải Dương', 106.27746, 20.80729, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-66', 'Phạm Văn Thắng-HD-66', 'Đội 8 -Cập Thượng-Tiền Tiến-Thanh Hà-Hải Dương', 'Hải Dương', 106.37054, 20.81574, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-096', 'Vũ Văn Tuyên-HH2-69', 'Thôn 6 - Quảng Chính - Hải Hà - Quảng Ninh', 'Quảng Ninh', 107.39635, 21.33024, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-097', 'Lê Thị Nga-HH2-70', 'Thôn Hải Sơn - Quảng Thành - Hải Hà - Quảng Ninh', 'Quảng Ninh', 107.25985, 21.00105, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HB-71', 'Nguyễn Văn Điển-HB-71', 'Tổ 1 Khu 7 -TT Trới -Hoành Bồ', 'Quảng Ninh', 107.36633, 21.03133, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HB-72', 'Nguyễn Văn Quý-HB-72', 'Tổ 8, Khu 6, Hoành Bồ', 'Quảng Ninh', 107.35408, 21.28139, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HB-73', 'Lại Thị Quyên-HB-73', 'Tổ 5 khu 1,TT Trới - H.Hoành Bồ - T.Quảng Ninh', 'Quảng Ninh', 106.84013, 21.00827, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-74', 'Đỗ Văn Sơn-HY-74', 'Thôn Kênh Bối-Vân Du-Ân Thi - Hưng Yên', 'Hưng Yên', 106.28403, 20.60804, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-75', 'Đỗ Danh Chi-HY-75', 'Đông Kết - Khoái Châu -Hưng Yên', 'Hưng Yên', 106.27746, 20.80729, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-79', 'Lê Văn Khẩn-HY-79', 'Thôn Tử Dương - Lý Thường Kiệt - Yên Mỹ - Hưng Yên', 'Hưng Yên', 106.37054, 20.81574, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-80', 'Nguyễn Văn Thuấn-HY-80', 'Hưng Yên', 'Hưng Yên', 106.37047, 20.81575, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-81', 'Mai thị Diện-HY-81', 'Trương Xá - Toàn Thắng - Hưng Yên', 'Hưng Yên', 106.08492, 20.94565, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-82', 'Nguyễn Văn Cường-HY-82', 'Thôn Phú Trạch-X.Mễ Sở-H.Văn Giang-T.Hưng Yên', 'Hưng Yên', 106.36421, 20.94963, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-83', 'Vũ Văn Dũng-HY-83', 'Cẩm Xá - Mỹ Hào - Hưng Yên', 'Hưng Yên', 106.07728, 20.84196, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-84', 'Lê Thị Hằng-HY-84', 'Thôn kênh Bối - Vân Du - Ân Thi-Hưng Yên', 'Hưng Yên', 106.37232, 20.84755, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-85', 'Phạm Văn Nam-HY-85', 'Nam Sơn - Hưng Yên', 'Hưng Yên', 106.29440, 20.87539, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-86', 'Nguyến Xuân Khu-HY-86', 'Lực Điền-Minh Châu-Yên Mỹ-Hưng Yên', 'Hưng Yên', 106.18076, 20.67576, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-111', 'Ninh Văn Khỏa-KM4-88', 'Chí Linh - Hải Dương', 'Hải Dương', 106.37047, 20.81575, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('LS-89', 'Đoàn Thị Thủy-LS-89', 'Tổ 3 khối 5 - Hợp Thành - Cao Lãnh - Lạng Sơn', 'Lạng Sơn', 106.75360, 21.83760, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('LS-90', 'Hứa Văn Vụ-LS-90', 'Xuân Dương - Lộc Bình - Lạng Sơn', 'Lạng Sơn', 106.90210, 21.80730, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('LS-91', 'Mai Bích Thủy-LS-91', 'TT Đình Lập - huyện Đình Lập - Lạng Sơn', 'Lạng Sơn', 107.09920, 21.54330, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('LS-92', 'Mai Xuân Bách-LS-92', 'Tổ 3 - Quyết Thắng- Sơn La', 'Lạng Sơn', 103.90230, 21.32270, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-116', 'Ngô Thị Hường-MC4-93', 'Móng Cái - Quảng Ninh', 'Quảng Ninh', 107.07916, 20.96670, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('MK-94', 'Nguyễn Văn Thành-MK-94', 'Khu Nam Sơn phường Nam Khê - Uông Bí - Quảng Ninh', 'Quảng Ninh', 107.00205, 20.97660, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-97', 'Bùi Quốc Chuyển-ND-97', 'Nam Định', 'Nam Định', 106.44536, 20.35421, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-104', 'Trần Xuân Giáp-ND-104', 'Số 57A-Tân Lập-Yên Tiến-Ý Yên-Nam Định', 'Nam Định', 106.31687, 20.26770, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-105', 'Trinh Ngọc Quốc-ND-105', 'Yên Tiến - Ý Yên - Nam Định', 'Nam Định', 106.41336, 20.39959, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TH-107', 'Phùng Quang thông-TH-107', 'SN 02B/38,Hàng Than,lam Sơn,Thanh Hóa', 'Thanh Hóa', 106.08317, 20.17045, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NG-109', 'Phan Đăng Kế-NG-109', 'Ninh Giang -Hải Dương', 'Hải Dương', 106.53090, 20.77472, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-123', 'Nguyễn Duy Hải-NT1-3-110', 'Hạ Long - Quảng Ninh', 'Quảng Ninh', 107.08509, 20.97772, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-124', 'Công ty TNHH MTV thương mại Hồng Hải HL', 'Số 5-Phố Kim Hoàn - Bạch Đằng - Hạ Long - Quảng Ninh-Việt Nam', 'Quảng Ninh', 106.84012, 21.00967, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-125', 'Công Ty CP Du Thuyền Đông Dương', 'Số 1 đường Hạ Long-Bãi Cháy-Hạ Long-Quảng Ninh-VN', 'Quảng Ninh', 107.08081, 20.96190, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-126', 'Công ty TNHH đầu tư thương mại Thanh Dung', 'Tổ 41 khu 3-Bạch Đằng-Hạ Long- Quảng Ninh', 'Quảng Ninh', 106.80318, 21.01064, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-127', 'Chi nhánh Công ty TNHH vòng tròn đỏ tại Hà Nội', 'Số 8 -Phan Văn Trường -Dịch Vọng Hậu -Cầu Giấy - Hà Nội', 'Quảng Ninh', 106.84100, 21.00677, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-128', 'Vũ Minh Chung-NT6BC-115', 'Cao Xanh - Hạ Long - Quảng Ninh', 'Quảng Ninh', 106.99086, 21.01663, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-129', 'Công ty CP Du Lịch Nhà Hàng Sen Á Đông', 'Hạ Long - Quảng Ninh', 'Quảng Ninh', 107.13006, 20.94044, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-130', 'Công ty TNHH Hạ Long Biển Ngọc', 'Tổ 3 khu 6-P.Bãi Cháy-Hạ Long-Quảng Ninh', 'Quảng Ninh', 107.10684, 21.00093, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-131', 'Công ty TNHH Minh Linh Star', 'Tổ 72 khu 7,Phường Hà Khẩu,Thành Phố Hạ long,Tỉnh Quảng Ninh,Việt Nam', 'Quảng Ninh', 107.00203, 20.97641, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-132', 'Công ty TNHH Thắng Diệp Ngọc', 'Số 5,Ngõ 25,Đường Võ Thị Sáu,P.Hồng Hải,Hạ Long,Quảng Ninh,VN', 'Quảng Ninh', 107.10698, 20.94713, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('QY-120', 'Vũ Tuấn Dũng-QY-120', 'Minh Thành - Yên Hưng - Quảng Ninh', 'Quảng Ninh', 107.12821, 20.94326, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('QY-121', 'Tạ Hữu Bản-QY-121', 'Uông Bí - Quảng Ninh', 'Quảng Ninh', 106.85193, 21.00224, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TY-122', 'Ngô Hiếu Công-TY-122', 'Tiên Lãng - Tiên Yên - Quảng Ninh', 'Quảng Ninh', 107.42793, 21.06268, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-123', 'Lại Văn Xuyên-TB-123', 'Thái Thịnh - Thái Thụy - Thái Bình', 'Thái Bình', 106.44536, 20.35421, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-128', 'Nguyễn Phương Tiệp-TB-128', 'Số 07B,Ngõ 555,Đường Lý Thái Tổ,Tổ 18,Phường Quang Trung,Thái Bình', 'Thái Bình', 106.28403, 20.60804, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-129', 'Nguyễn Trung Nguyện-TB-129', 'Thái Bình', 'Thái Bình', 106.31687, 20.26770, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-130', 'Nguyễn Thế Vinh-TB-130', 'Thôn Phông Lôi - Đông Hợp - Đông Hưng - Thái Bình', 'Thái Bình', 106.52889, 20.33660, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-131', 'Nguyễn Thị Ngọc-TB-131', 'Thăng Long -Đông Hưng - Thái Bình', 'Thái Bình', 106.41336, 20.39959, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-132', 'Nguyễn Văn Đặng-TB-132', 'Thái Bình', 'Thái Bình', 106.50225, 20.41741, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-135', 'Trần Văn Đức-TB-135', 'Thôn Hữu Tiệm - Quang Hưng - Kiến Xương - Thái Bình', 'Thái Bình', 106.28298, 20.54743, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-136', 'Vũ Thị Huệ-TB-136', 'Thôn Dinh -Tân Bình -Vũ Thư - Thái Bình', 'Thái Bình', 106.28283, 20.54759, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-137', 'Dương Xuân kỳ-TN-137', 'Số nhà 2,tổ dân phố 2,P.Lương Châu,TP.Sông Công', 'Thái Nguyên', 105.64227, 21.61102, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-145', 'Công ty TNHH nông nghiệp quốc tế Thái Nguyên', 'Xóm Thuận Phong - Bình Thuận - Đại Từ - Thái Nguyên', 'Thái Nguyên', 105.83214, 21.48241, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-139', 'Dương Văn Điệp-TN-139', 'Sông Công - Thái Nguyên', 'Thái Nguyên', 105.84783, 21.67819, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-140', 'Hoàng Diễn Mong-TN-140', 'Hoàng Liên - Hoàng An - Hiệp Hòa - Bắc Giang', 'Thái Nguyên', 105.67103, 21.81940, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-141', 'Nguyễn Thị Hằng-TN-141', 'Tổ dân phố làng Sắn - Bách Quang - Sông Công', 'Thái Nguyên', 105.83213, 21.48257, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-142', 'Phạm Văn Tỉnh-TN-142', 'Xã Phú Tiến - Định Hóa - Thái Nguyên', 'Thái Nguyên', 106.19869, 21.44917, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-150', 'Phạm Văn Cửu-VD2-143', 'Vân Đồn - Quảng Ninh', 'Quảng Ninh', 106.84830, 21.00195, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-151', 'Lê Huy Lượng-VD2-144', 'Cô Tô - Quảng Ninh', 'Quảng Ninh', 106.83941, 21.00898, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-152', 'Công ty TNHH Hai Thành Viên Nguyễn Vũ Việt Nam', 'Đội 2 -Lê Như Hồ - Hồng Nam - Hưng Yên - VN', 'Hưng Yên', 106.37001, 20.91113, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('LS-4740', 'Đinh Thị Đức-LS-4740', 'Số 99- Khu Lao Động - TT Bình Lộc - Lạng Sơn', 'Lạng Sơn', 106.76360, 21.85360, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-4750', 'Lê Thị Thanh Chi-HP-4750', 'SN35-Tổ dân phố 7- Cát Bà - Hải Phòng', 'Hải Phòng', 106.63388, 20.73656, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-4753', 'Ngô Văn Đức-TN-4753', 'Xóm Khuôn 11- Phúc Trìu - TP.Thái Nguyên - Thái Nguyên', 'Thái Nguyên', 105.64318, 21.63227, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-4759', 'Phùng Thị Bích Thủy-HP-4759', 'Thôn Áng Sơn - Thái Sơn - An Lão - Hải Phòng', 'Hải Phòng', 106.67729, 20.82441, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-157', 'Vũ Đình Đạt-KM4-4763', 'Kinh Môn', 'Hải Dương', 106.56696, 20.96235, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-4769', 'Nguyễn Văn Hảo-BN-4769', 'Thôn Tân Dân - TT Thứa - Lương Tài -Bắc Ninh', 'Bắc Ninh', 106.14519, 21.15433, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-4770', 'Nguyễn Văn Bình-ND-4770', 'Hiển Khánh - Vụ bản - Nam Định', 'Nam Định', 106.28298, 20.54743, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-4772', 'Nguyễn Văn Cường-HY-4772', 'Hưng Yên', 'Hưng Yên', 106.04677, 20.79183, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BG-4837', 'Phan Thành Luân-BG-4837', 'Khu 1-TT.An Châu - Sơn Động-Bắc Giang', 'Bắc Giang', 106.19869, 21.44917, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-4841', 'Nguyễn Thanh Nghị-TN-4841', 'La Đành - Hóa Trung - Đồng Hỷ - Thái Nguyên', 'Thái Nguyên', 105.84438, 21.62090, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-4842', 'Nguyễn Thị Liên-HD-4842', 'Thống Kênh - Gia Lộc - Hải Dương', 'Hải Dương', 106.36421, 20.94963, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-4843', 'Nguyễn Đức Nam-HD-4843', 'Khu 1 - Yết Kiêu - Gia Lộc - Hải Dương', 'Hải Dương', 106.37232, 20.84755, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-165', 'Công ty TNHH TM Phong Ngọc', 'Số 189 - Sơn Hải - Hải Sơn - Đồ Sơn - Hải Phòng - Việt Nam', 'Hải Phòng', 106.55414, 20.72103, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-166', 'Trần Xuân Linh-BG - 4845', 'Thôn Tam Tầng - Quang Châu - Việt Yên - Bắc Giang', 'Bắc Giang', 106.83332, 21.33097, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-167', 'Công ty TNHH chân trời mới Việt Nam', 'Xí nghiệp xây dựng số 3, xã Tạ Thanh Oai ,Huyện Thanh Trì,Thành Phố Hà Nội, Việt Nam', 'Hà Nội', 105.86899, 20.97640, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-168', 'Mai Duy Tùng-NT1-3-4847', 'Số 140 - Tổ 41 - Khu 3 - Phường Bạch Đằng - Thành Phố Hạ Long - Quảng Ninh', 'Quảng Ninh', 106.87202, 20.92831, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-4848', 'Phạm Văn Hoành-HP-4848', 'Xóm Mới - Xã Hồng Thái - Huyện An Dương - Thành Phố Hải Phòng', 'Hải Phòng', 106.65981, 20.82461, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-170', 'Dương Thị Sơn - NB - 4851', 'Thôn 3 - Xã Cổ Đạm - Nghi Xuân - Hà Tĩnh', 'Ninh Bình', 106.08317, 20.17045, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-171', 'Công ty TNHH thương mại Ánh Tuyết', 'Khu Đông Tân,Phường Hồng Phong,Thị xã Đông Triều,QN', 'Quảng Ninh', 106.99083, 21.01634, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-48', 'NGUYỄN KHẮC HÒA-HP-48', 'THỬA ĐẤT SỐ 115,TỜ BẢN ĐỒ SỐ 36, TRUNG HÀNH,PHƯỜNG ĐẰNG HẢI, QUẬN HẢI AN, THÀNH PHỐ HẢI PHÒNG', 'Hải Phòng', 106.52980, 20.98298, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TB-137', 'NGUYỄN THỊ MINH TRANG-TB-137', 'SN 29 TRẦN THÁI TÔNG, TỔ 12, PHƯỜNG BỒ XUYÊN, THÀNH PHỐ THÁI BÌNH, TỈNH THÁI BÌNH, VIỆT NAM', 'Thái Bình', 106.42268, 20.64739, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('ND-106', 'Nguyễn Thị Thanh Hương-ND-106', 'SỐ 109 ĐƯỜNG HƯNG YÊN - PHƯỜNG QUANG TRUNG - TP NAM ĐỊNH - TỈNH NAM ĐỊNH', 'Nam Định', 106.28283, 20.54759, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-175', 'Phạm Thanh Hải', 'SỐ 16/51 Hùng Duệ Vương,Phường Thượng Lý,Quận Hồng Bàng,Thành Phố Hải Phòng', 'Hải Phòng', 106.49865, 20.96999, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-176', 'Hà Văn Công', 'Thôn Đông Thịnh, xã Thái Thịnh, Thái Thụy, Thái Bình', 'Thái Bình', 106.52369, 20.47992, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-69', 'Đinh Xuân Bằng-HD-69', 'Đội 5, xóm Lê Lợi, thôn Cập Thượng, xã Tiên Tiến, huyện Thanh Hà, Tỉnh Hải Dương', 'Hải Dương', 106.50166, 20.76435, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-178', 'Nguyễn Mạnh Hùng', 'Nhà Ông Nguyễn Mạnh Hùng, thôn Vĩnh Gia, xã Phú Xuân,thành phố Thái Bình', 'Thái Bình', 106.51439, 20.44736, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-50', 'Nguyễn Thu Hiền-HP-50', 'Cụm Công nghiệp Cành hầu,Phường lãm Hà, Quận Kiến An,Thành Phố Hải Phòng', 'Hải Phòng', 106.60414, 20.75960, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-180', 'Công ty Cổ Phần Đầu Tư Phát Triển Huy Phong', 'TDP Trung Dũng(tại nhà Bà Lưu Thị thắm),Thị trấn An Lão,Huyện An Lão,Thành Phố Hải Phòng,Việt Nam', 'Hải Phòng', 106.66156, 20.93741, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-27', 'Lê Thị Tâm-BN-27', 'Thôn Dương Húc - Xã Đại Đồng - Xã Đại Đồng - Huyện Tiên Du-Tỉnh Bắc Ninh', 'Bắc Ninh', 105.99590, 21.12439, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-182', 'Doanh Nghiệp Tư Nhân Trung Mùi', 'Số nhà 19,Phố Phạm Quang Lịch,Tổ dân số phố 21-22,PhườngTiền Phong,Thành Phố Thái Bình,Tỉnh Thái Bình,Việt Nam', 'Thái Bình', 106.44260, 20.39476, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-183', 'KHÁCH KHÔNG RÕ TÊN', 'Quảng Ninh', 'Quảng Ninh', 106.80317, 20.94438, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-184', 'Công ty TNHH Anh Kiệt', 'Tổ 72 khu 7,Phường Hà Khẩu,Thành Phố Hạ long,Tỉnh Quảng Ninh,Việt Nam', 'Quảng Ninh', 107.14138, 20.95217, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-185', 'Lê Thị Phượng', 'Ngũ Phúc, Kim Thành, Hải Dương', 'Hải Dương', 106.29440, 20.87539, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-143', 'Bùi Thị Thu Trang-TN-143', 'Tổ 10, Phường Chùa Hang, TP Thái Nguyên, tỉnh Thái Nguyên', 'Thái Nguyên', 105.87297, 21.48069, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-187', 'Dương Quang Huy - Hộ Kinh Doanh Dollarmart', 'Sàn thương mại,dịch vụ tầng 3,Tòa nhà CT1-Dự án khu nhà ở Quận Hoàng Mai,Phường Yên Sở,Quận Hoàng Mai,Hà Nôi', 'Hà Nội', 105.86994, 20.96668, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-188', 'Nguyễn Thị Hiền', 'Thụy Trường, Thái Thụy, Thái Bình', 'Thái Bình', 106.39598, 20.62799, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-189', 'Nguyễn Thị Tuyết Nhi', 'Thôn Thượng, Xã Dương Hà, Gia Lâm, Hà Nội', 'Hà Nội', 105.86916, 20.97654, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-190', 'Vũ Đình Dân', 'Khu 1 Phú Thứ, Kinh Môn, Hải Dương', 'Hải Dương', 106.37001, 20.91113, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-191', 'Vũ Thị Hương Lan', 'Cổ Lễ, Trực Ninh, Nam Định', 'Nam Định', 106.44260, 20.39476, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-192', 'Đỗ Huy Đức', 'Quang Hưng, Nghĩa Đạo, Thuận Thành, Bắc Ninh', 'Bắc Ninh', 106.15120, 21.15333, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-193', 'Vũ Quốc Tùng', 'Tổ 3, Nam Tiến, Cẩm Bình, Cẩm Phả, Quảng Ninh', 'Quảng Ninh', 107.21583, 21.00141, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-194', 'Trần Văn Tiến', 'Nam Định', 'Nam Định', 106.08317, 20.17045, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-195', 'Đỗ Huy Đức', 'Số nhà 150, Tổ 4 Khu 7A Phường Quang hanh, Thành phố Cẩm phả Quảng ninh', 'Quảng Ninh', 107.29544, 20.99526, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-196', 'Đỗ Huy Đức', 'Số nhà 150 Tổ 4 Khu 7A Quang hanh Cẩm phả Quảng ninh', 'Quảng Ninh', 107.42191, 21.32655, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-197', 'Nguyễn Thị Hiền - HP 51', 'Số 1 Cầu tây, thị trấn Vĩnh bảo, Huyện Vĩnh bảo Hải phòng', 'Hải Phòng', 106.65982, 20.82441, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-198', 'Hộ Kinh Doanh Nguyễn Mạnh Cường', 'Số 73 Khúc Thừa Dụ 2,Phường Vĩnh Niệm, Quận Lê Chân, Thành Phố Hải Phòng', 'Hải Phòng', 106.70526, 20.82192, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-52', 'Phan Huy Tuấn-HP-52', 'Thôn Đại Độ, Xã Tiên Cương, Huyện Tiên Lãng', 'Hải Phòng', 106.65997, 20.92325, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-200', 'Khách hàng tiêu dùng trên địa bàn thành phố Hà nội', 'Huyện Thanh trì Thành Phố Hà nội', 'Hà Nội', 105.79696, 20.97722, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-53', 'Trịnh Xuân Tình-HP-53', 'Thôn Tân Nam- Xã Mỹ Đức-Huyện An Lão-Thành Phố Hải Phòng', 'Hải Phòng', 106.49554, 20.94132, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HD-72', 'Nguyễn Thị Phượng-HD-72', 'Thôn Trại Kim Độ,Xã hiệp Cát,Huyện Nam Sách,Tỉnh Hải Dương', 'Hải Dương', 106.32778, 21.09776, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-203', 'Hộ Kinh Doanh Duy Nghĩa', 'Thửa đất số 440,tòe bản đồ số 11,thôn Cập Thượng,Xã Tiền Tiến,Thành Phố Hải Dương,Tỉnh Hải Dương', 'Hải Dương', 106.49670, 21.08709, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-204', 'Công ty TNHH dịch vụ thương mại Cường Thịnh', '18,đường Hoàng Hoa Thám,phố Trung Sơn,Phường Thanh Bình,Thành phố Ninh Bình,Tỉnh Ninh Bình,Việt Nam', 'Ninh Bình', 106.18024, 20.38481, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NB-110', 'Bùi Thị Hường-NB-110', 'Xóm Chùa - Xã Khánh Hòa - Huyện Yên Khánh - Tỉnh Ninh Bình', 'Ninh Bình', 106.17540, 20.25859, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-206', 'NGƯỜI TIÊU DÙNG KHU VỰC QUẢNG NINH', 'Quảng Ninh', 'Quảng Ninh', 107.10611, 20.98679, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-207', 'Công Ty Cổ Phần Thương Mại Sim Ba', 'R1-08-03,Tòa nha Everich,Số 968 Ba Tháng Hai,Phường 15,Quận 11,Thành phố Hồ Chí Minh,Việt Nam', 'TP. Hồ Chí Minh', 106.65580, 10.76260, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HP-54', 'Lê Đức Hoàn-HP-54', 'Thôn 7 - Thủy Sơn - Thủy Nguyên - Hải Phòng', 'Hải Phòng', 106.52914, 20.87517, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TN-144', 'Nguyễn Đức Thể-TN-144', 'Xóm Sau, Xã Lương Sơn, Thành Phố Thái Nguyên, Tỉnh Thái Nguyên', 'Thái Nguyên', 105.67103, 21.81961, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-210', 'Hoàng Thị Hằng - PT-108', 'Xã Lương Sơn- Huyện Yên Lập - Tỉnh Phú Thọ', 'Phú Thọ', 105.04413, 21.36238, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TH-108', 'Lê Thị Vân(Cửa hàng Vân Nghĩa)-TH-108', 'Nhà Ông Lê Ích Nghĩa,Thôn Mậu Đông,Xã Quang Lưu,Huyện Quảng Xương,Tỉnh Thanh Hóa', 'Thanh Hóa', 106.18024, 20.38481, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('HY-111', 'Nguyễn Trường Thịnh-HY-111', 'Duyên Yên- Ngọc Thanh- Kim Động -Hưng Yên', 'Hưng Yên', 106.39598, 20.62799, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-213', 'Công ty TNHH Chín Loan', 'Thôn Phúc Long,Xã Tăng Tiến,Huyện Việt Yên,Tỉnh Bắc Giang,Việt Nam', 'Bắc Giang', 105.99588, 21.12505, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('TH-113', 'Văn Đình Lân-TH-113', 'Khu Phố Trung Mới,Phường Trường Sơn,TP Sầm Sơn,Tỉnh Thanh Hóa', 'Thanh Hóa', 106.17540, 20.25859, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('BN-114', 'Nguyễn Thị Bình-BN-114', 'Thôn Thanh Hoài - Xã Thanh Khương - Huyện Thuận Thành - Tỉnh Bắc Ninh', 'Bắc Ninh', 106.10910, 21.16385, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-216', 'Công ty Cổ Phần dịch vụ trực tuyến FPT-Chi Nhánh Hà Nội', 'Tòa nhà FPT,Phố Phạm Văn Bạch,Phường Dịch Vọng,Quận Cầu Giấy,Hà Nội', 'Hà Nội', 105.78600, 20.98341, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-217', 'CÔNG TY TNHH QUANG LINH HUY', 'Số 114, Ngõ 06, Đường Phạm Thận Duật, Phố Bắc Sơn, P. Bích Đào, TP Ninh Bình, Tỉnh Ninh Bình', 'Ninh Bình', 105.91193, 20.33828, true);
INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES ('NPP-218', 'HỘ KINH DOANH BÙI TUẤN HƯNG', 'Thôn Phúc Thành, xã Quý Sơn, Huyện Lục Ngạn, Tỉnh Bắc Giang', 'Bắc Giang', 105.95783, 21.19710, true);

-- 3. Auto-generate credit limits for all customers
-- Random realistic credit limits based on province/region
INSERT INTO credit_limits (customer_id, credit_limit, effective_from)
SELECT id,
  CASE
    WHEN province = 'Quảng Ninh' THEN (300 + (EXTRACT(EPOCH FROM created_at)::int % 500)) * 1000000
    WHEN province = 'Hải Phòng'  THEN (250 + (EXTRACT(EPOCH FROM created_at)::int % 400)) * 1000000
    WHEN province = 'Hải Dương'  THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 350)) * 1000000
    WHEN province = 'Thái Bình'  THEN (150 + (EXTRACT(EPOCH FROM created_at)::int % 300)) * 1000000
    WHEN province = 'Bắc Giang'  THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 400)) * 1000000
    WHEN province = 'Bắc Ninh'   THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 350)) * 1000000
    ELSE (150 + (EXTRACT(EPOCH FROM created_at)::int % 300)) * 1000000
  END,
  '2026-01-01'
FROM customers;

COMMIT;

-- Verify
SELECT province, COUNT(*) FROM customers GROUP BY province ORDER BY province;
SELECT 'Total customers: ' || count(*) FROM customers;
SELECT 'Total credit_limits: ' || count(*) FROM credit_limits;
