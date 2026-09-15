# Design Normalizer

Design Normalizer nhận `figma_collected_artifact` hoặc artifact legacy, chọn đúng `targetFrame`, bỏ node ẩn/design-only/non-UI, tóm tắt vector thành asset manifest và tạo `normalized_design_artifact`.

Nó không đọc Figma REST/MCP, không đọc customer source và không tạo/approve Task Context. Context Builder chỉ điều phối Normalizer và dùng output của nó để xây design index/layout context.

```powershell
node D:\agents\figma-frontend-agent\normalizers\design-normalizer\bin\figma-normalize.js `
  --input D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.normalized.json `
  --target-node-id 57:99
```
