package wms

// ZPL (Zebra Programming Language) label generators for WMS Phase 9 (DEC-WMS-01).
// Generated string can be POSTed to a Zebra/TSC printer over network/USB.
// Format choices follow industry FMCG standard:
//   - Pallet label: 100x150 mm @ 203 dpi (~800x1200 dots)
//   - Bin label: 50x30 mm @ 203 dpi (~400x240 dots)
// QR uses error-correction H (chịu 30% hỏng) — phù hợp môi trường kho ẩm/bụi.

import (
	"fmt"
	"strings"
	"time"
)

// BuildGS1PalletPayload builds a GS1-compliant payload string for a pallet QR.
//
//	(00) SSCC = LPN code (right-padded to 18 digits not enforced; we keep BHL human-readable)
//	(01) GTIN = product SKU  (we use BHL SKU as GTIN substitute — true GTIN cần đăng ký GS1)
//	(10) LOT  = batch number
//	(17) EXP  = expiry YYMMDD
func BuildGS1PalletPayload(lpnCode, sku, batchNumber, expiryYYYYMMDD string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "(00)%s", lpnCode)
	if sku != "" {
		fmt.Fprintf(&b, "(01)%s", sku)
	}
	if batchNumber != "" {
		fmt.Fprintf(&b, "(10)%s", batchNumber)
	}
	if expiryYYYYMMDD != "" && len(expiryYYYYMMDD) >= 10 {
		// YYYY-MM-DD → YYMMDD
		yy := expiryYYYYMMDD[2:4]
		mm := expiryYYYYMMDD[5:7]
		dd := expiryYYYYMMDD[8:10]
		fmt.Fprintf(&b, "(17)%s%s%s", yy, mm, dd)
	}
	return b.String()
}

// BuildBinPayload returns a simple deterministic payload for a bin QR.
func BuildBinPayload(binCode string) string {
	return "(BIN)" + binCode
}

// GeneratePalletLPN: BHL-LP-YYYYMMDD-NNNNNN  (NNNNNN sinh từ DB sequence ở caller)
func GeneratePalletLPN(seq int64, t time.Time) string {
	return fmt.Sprintf("BHL-LP-%s-%06d", t.Format("20060102"), seq)
}

// PalletLabelZPL — label 100x150 mm @ 203 dpi (~800x1200 dots).
// Includes: Brand header, LPN (large), SKU + name, Lot + EXP, qty, big QR.
func PalletLabelZPL(lpnCode, sku, productName, batchNumber, expiryYYYYMMDD string, qty int, qrPayload string) string {
	// Truncate long product name for label width
	name := productName
	if len(name) > 30 {
		name = name[:30]
	}
	exp := expiryYYYYMMDD
	if len(exp) > 10 {
		exp = exp[:10]
	}
	return fmt.Sprintf(`^XA
^PW800
^LL1200
^FO40,40^A0N,60,60^FDBHL Beer^FS
^FO40,110^A0N,30,30^FDPallet Label (LPN)^FS
^FO40,160^GB720,3,3^FS
^FO40,180^A0N,80,80^FD%s^FS
^FO40,290^A0N,40,40^FDSKU: %s^FS
^FO40,340^A0N,30,30^FD%s^FS
^FO40,400^A0N,35,35^FDLot: %s^FS
^FO40,450^A0N,35,35^FDEXP: %s^FS
^FO40,500^A0N,40,40^FDQty: %d^FS
^FO40,580^BQN,2,10^FDQAH,%s^FS
^FO40,1100^A0N,25,25^FD%s^FS
^XZ`,
		lpnCode, sku, name, batchNumber, exp, qty, qrPayload, lpnCode)
}

// BinLabelZPL — small label 50x30 mm @ 203 dpi (~400x240 dots).
func BinLabelZPL(binCode, qrPayload string) string {
	return fmt.Sprintf(`^XA
^PW400
^LL240
^FO20,20^A0N,30,30^FDBHL BIN^FS
^FO20,55^A0N,40,40^FD%s^FS
^FO230,20^BQN,2,5^FDQAH,%s^FS
^XZ`, binCode, qrPayload)
}
