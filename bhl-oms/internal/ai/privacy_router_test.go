package ai

import "testing"

func TestRoutePrivacyPIIHighRoutesLocal(t *testing.T) {
	cases := []string{
		"Gọi NPP số 0901234567 để xác nhận đơn",
		"SĐT tài xế là 0987654321",
		"Khách báo số 0911112222 đổi địa chỉ",
		"Liên hệ +84901234567 trước khi giao",
		"Email kế toán npp@example.com cần gửi đối soát",
		"CCCD tài xế 001203004567",
		"địa chỉ 12 đường Hạ Long phường Bãi Cháy",
		"Dia chi NPP o duong Tran Phu quan Hong Bang",
		"phone 0977000111 và email sales@beerhl.vn",
		"giao tới địa chỉ kho phụ sau 15h",
	}
	for _, input := range cases {
		decision := RoutePrivacy(input)
		if decision.Route != PrivacyRouteLocal {
			t.Fatalf("expected local for %q, got %s", input, decision.Route)
		}
		if decision.Sensitivity != SensitivityHigh {
			t.Fatalf("expected high sensitivity for %q, got %s", input, decision.Sensitivity)
		}
		if !decision.Redacted {
			t.Fatalf("expected redaction for %q", input)
		}
	}
}

func TestRoutePrivacyMediumRoutesCloudRedacted(t *testing.T) {
	cases := []string{
		"NPP HD-53 đặt thấp hơn tuần trước",
		"NPP-123 cần chăm sóc lại",
		"KH1234 có doanh thu giảm",
		"Biển số 14A-123.45 đang lệch tuyến",
		"Tồn kho WH-HL còn 120 thùng",
		"ton kho SKU A còn 80",
		"Giá trị đơn 12.000.000đ",
		"Công nợ 45 triệu",
		"Dự báo QN-888 giảm đặt hàng",
		"available_stock 32 reserved 8",
	}
	for _, input := range cases {
		decision := RoutePrivacy(input)
		if decision.Route != PrivacyRouteCloud {
			t.Fatalf("expected cloud for %q, got %s", input, decision.Route)
		}
		if decision.Sensitivity != SensitivityMedium {
			t.Fatalf("expected medium sensitivity for %q, got %s", input, decision.Sensitivity)
		}
		if !decision.Redacted {
			t.Fatalf("expected redaction for %q", input)
		}
	}
}

func TestRoutePrivacyLowRoutesCloud(t *testing.T) {
	cases := []string{
		"Tóm tắt tình hình điều phối hôm nay",
		"Có bao nhiêu chuyến đang active",
		"Viết briefing ngắn cho dispatcher",
		"Giải thích lý do OTD giảm",
		"Dự báo nhu cầu tháng sau",
		"Tạo checklist kho đầu ngày",
		"Gợi ý thứ tự ưu tiên dashboard",
		"Tóm tắt các cảnh báo đang mở",
		"Nêu 2 hành động nên làm tiếp",
		"Kiểm tra quy trình manual khi AI off",
	}
	for _, input := range cases {
		decision := RoutePrivacy(input)
		if decision.Route != PrivacyRouteCloud {
			t.Fatalf("expected cloud for %q, got %s", input, decision.Route)
		}
		if decision.Sensitivity != SensitivityLow {
			t.Fatalf("expected low sensitivity for %q, got %s", input, decision.Sensitivity)
		}
	}
}

func TestRoutePrivacyEmptyBlocks(t *testing.T) {
	for _, input := range []string{"", "   ", "\n\t"} {
		decision := RoutePrivacy(input)
		if decision.Route != PrivacyRouteBlocked {
			t.Fatalf("expected blocked for empty input, got %s", decision.Route)
		}
	}
}

func TestRoutePrivacyHashStable(t *testing.T) {
	inputs := []string{
		"NPP HD-53 đặt hàng thấp",
		"NPP HD-53 đặt hàng thấp",
		"NPP HD-54 đặt hàng thấp",
		"SĐT 0901234567",
		"SĐT 0901234567",
		"SĐT 0901234568",
		"Tồn kho còn 12",
		"Tồn kho còn 12",
		"Tồn kho còn 13",
		"briefing",
		"briefing",
	}
	seen := map[string]string{}
	for _, input := range inputs {
		decision := RoutePrivacy(input)
		if decision.RequestHash == "" {
			t.Fatalf("expected hash for %q", input)
		}
		if previous, ok := seen[input]; ok && previous != decision.RequestHash {
			t.Fatalf("hash not stable for %q", input)
		}
		seen[input] = decision.RequestHash
	}
	if seen["NPP HD-53 đặt hàng thấp"] == seen["NPP HD-54 đặt hàng thấp"] {
		t.Fatalf("different inputs should not share hash")
	}
}
