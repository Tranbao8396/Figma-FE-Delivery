# Collectors / Adapters

Collectors đọc dữ liệu đầu vào theo đúng loại nguồn và trả về fact có cấu trúc. Chúng không suy luận layout, bỏ node theo ý nghĩa thiết kế, tạo token code hoặc approve context.

- `source-adapter`: đọc metadata filesystem/repository và bỏ thư mục build/cache rõ ràng.
- `rules-adapter`: ghép rule khai báo từ Profile thành input có cấu trúc cho Rules Context Compiler.
- `../design-collector`: adapter cho Figma REST, Figma MCP/export JSON; chỉ thực hiện transport-safe projection và cache request.

Normalizer/Filter nhận output Collector để chọn scope và lọc theo ý nghĩa UI. Context Builder chỉ điều phối các bước này và ghép reference/hash/phase gate.
