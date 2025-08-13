# Hướng Dẫn Debug Chức Năng Vẽ Polygon

## Vấn Đề Đã Khắc Phục

Chức năng vẽ polygon trong ứng dụng đã được cải thiện để khắc phục các vấn đề:
- Polygon bị nhảy vị trí sau khi hoàn thành
- Kích thước bị sai lệch
- Chiều bị đảo ngược

## Các Phương Pháp Chuyển Đổi Tọa Độ Đã Cải Thiện

### 1. Phương Pháp Screentosphere Trực Tiếp
- Sử dụng `krpano.screentosphere()` với tọa độ stage chính xác
- Tính toán tỷ lệ giữa CSS pixel và stage pixel một cách chính xác
- Clamp tọa độ vào vùng canvas hợp lệ

### 2. Phương Pháp Ray Casting
- Sử dụng ray casting với perspective projection
- Tính toán ath/atv dựa trên FOV và góc nhìn hiện tại
- Xử lý chính xác các loại FOV khác nhau (MFOV, HFOV, VFOV)

### 3. Phương Pháp Fallback
- Tính toán tọa độ tương đối từ center
- Offset nhỏ để tránh sai lệch lớn

## Các Hàm Debug Mới

### `window.debugShapeCoordinates(shapeId)`
Hiển thị thông tin chi tiết về tọa độ của một shape:
```javascript
// Trong console của WebView
window.debugShapeCoordinates('poly_1');
```

### `window.createTestPolygon()`
Tạo một polygon test đơn giản ở center để kiểm tra:
```javascript
window.createTestPolygon();
```

### `window.recreatePolygonFromShape(shapeId)`
Tạo lại polygon từ shape hiện có với tọa độ được tính toán lại:
```javascript
window.recreatePolygonFromShape('poly_1');
```

## Cách Sử Dụng Để Debug

### Bước 1: Vẽ Polygon
1. Bật chế độ vẽ (nút ✏️)
2. Vẽ polygon như bình thường
3. Chạm vào điểm đầu tiên để hoàn thành

### Bước 2: Kiểm Tra Tọa Độ
1. Mở Developer Console của WebView
2. Chạy: `window.debugShapeCoordinates('poly_1')`
3. Kiểm tra thông tin tọa độ được hiển thị

### Bước 3: Tạo Polygon Test
1. Chạy: `window.createTestPolygon()`
2. So sánh với polygon đã vẽ
3. Kiểm tra vị trí và kích thước

### Bước 4: Tạo Lại Polygon Nếu Cần
1. Chạy: `window.recreatePolygonFromShape('poly_1')`
2. Polygon sẽ được tạo lại với tọa độ chính xác

## Thông Tin Debug Được Lưu

Mỗi shape sẽ có thông tin debug bao gồm:
- `screen`: Tọa độ màn hình khi vẽ
- `client`: Tọa độ client
- `viewer`: Tọa độ viewer
- `stage`: Tọa độ stage và tỷ lệ scale
- `sphere`: Tọa độ sphere cuối cùng

## Xử Lý Lỗi

Nếu polygon vẫn bị sai vị trí:
1. Kiểm tra log trong console để xem phương pháp nào được sử dụng
2. So sánh tọa độ sphere với tọa độ screen
3. Sử dụng `recreatePolygonFromShape()` để tạo lại
4. Kiểm tra FOV và góc nhìn hiện tại

## Lưu Ý Quan Trọng

- Tọa độ sphere được lưu lại để có thể tạo lại polygon chính xác
- Overlay sẽ hiển thị polygon theo view 3D hiện tại
- Các polygon đã tạo sẽ được lưu trữ trong Krpano và không bị mất khi quay không gian
