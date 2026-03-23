# /techdebt — Tìm và ghi nhận nợ kỹ thuật

Quét code vừa viết để tìm tech debt, sau đó cập nhật TECH_DEBT.md.

## Hướng dẫn

Rà soát code trong session này và tìm những thứ:
- Đang hoạt động nhưng chưa đúng chuẩn
- Cần cải thiện sau nhưng không block hiện tại
- Là shortcuts cho demo/phase hiện tại

## Checklist tìm tech debt

- [ ] Có `// TODO` hoặc `// FIXME` mới không?
- [ ] Có hardcode value nào nên config được không?
- [ ] Có query chưa optimize (SELECT *, missing index, N+1)?
- [ ] Có error handling placeholder (`fmt.Println(err)`) không?
- [ ] Có test nào bị skip/placeholder không?
- [ ] Frontend có `any` type, `console.error` thay vì proper error UI?
- [ ] Integration endpoint nào đang mock cần real implementation?

## Format thêm vào TECH_DEBT.md

```
| TD-NNN | [Mô tả ngắn] | [Đang dùng] | [Nên dùng] | Phase X | [Rủi ro] |
```

## Quy tắc

- KHÔNG tự sửa tech debt — chỉ ghi nhận
- Assign phase xử lý thực tế (không phải "sau này")
- Nếu item đã có trong TECH_DEBT.md → skip, đừng duplicate
