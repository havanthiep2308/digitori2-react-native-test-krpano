# Hướng Dẫn Logic Đơn Giản Hóa cho Polygon Drawing

## Tổng Quan

Sau khi phân tích vấn đề polygon nhảy vị trí, tôi đã đơn giản hóa logic chuyển đổi tọa độ để loại bỏ các bước tính toán phức tạp có thể gây tích lũy sai số.

## Vấn Đề Trước Đây

Logic cũ sử dụng nhiều bước chuyển đổi tọa độ phức tạp:
1. **Overlay coordinates** → **Client coordinates** → **Viewer coordinates** → **Stage coordinates** → **Sphere coordinates**
2. **Ray casting** với các phép tính lượng giác phức tạp
3. **Tỷ lệ scale** giữa CSS pixel và stage pixel
4. **Multiple fallback methods** có thể gây nhầm lẫn

## Logic Mới (Đơn Giản Hóa)

### 1. Screen to Sphere Conversion

```javascript
function sphereFromScreen(x, y) {
  // Lấy thông tin view hiện tại
  const view = krpano.get('view');
  const hlookat = parseFloat(view.hlookat) || 0;
  const vlookat = parseFloat(view.vlookat) || 0;
  const fov = parseFloat(view.fov) || 90;
  
  // Tính toán tọa độ tương đối từ center (-1 đến +1)
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const offsetX = (screenX - centerX) / centerX;
  const offsetY = (screenY - centerY) / centerY;
  
  // Chuyển đổi sang ath/atv dựa trên FOV
  const ath = hlookat + (offsetX * fov * 0.5);
  const atv = vlookat + (offsetY * fov * 0.5);
  
  // Normalize và clamp
  const normalizedAth = ((ath + 180) % 360) - 180;
  const clampedAtv = Math.max(-90, Math.min(90, atv));
  
  return { ath: normalizedAth, atv: clampedAtv };
}
```

**Ưu điểm:**
- Chỉ 1 bước chuyển đổi tọa độ
- Sử dụng FOV trực tiếp từ Krpano
- Không cần tính toán ray casting phức tạp
- Ít khả năng tích lũy sai số

### 2. Sphere to Screen Conversion

```javascript
function drawShapesAs3D(ctx, shapes, selectedId) {
  shapes.forEach(shape => {
    if (shape.spherePoints && typeof krpano !== 'undefined') {
      const view = krpano.get('view');
      const hlookat = parseFloat(view.hlookat) || 0;
      const vlookat = parseFloat(view.vlookat) || 0;
      const fov = parseFloat(view.fov) || 90;
      
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      screenPoints = shape.spherePoints.map(spherePoint => {
        // Tính toán offset tương đối từ center
        const athOffset = spherePoint.ath - hlookat;
        const atvOffset = spherePoint.atv - vlookat;
        
        // Chuyển đổi sang tọa độ màn hình
        const screenX = centerX + (athOffset / (fov * 0.5)) * centerX;
        const screenY = centerY + (atvOffset / (fov * 0.5)) * centerY;
        
        return { x: screenX, y: screenY };
      });
    }
  });
}
```

**Ưu điểm:**
- Logic đối xứng với screen-to-sphere
- Sử dụng cùng FOV và góc nhìn
- Không cần `krpano.spheretoscreen()`

## Cách Sử Dụng

### 1. Test Logic Mới

Sử dụng file `test_polygon_simple.html` để kiểm tra:

```bash
# Mở file trong WebView của ứng dụng
# Hoặc mở trực tiếp trong browser để test
```

### 2. Các Hàm Debug Có Sẵn

```javascript
// Kiểm tra trạng thái hệ thống
window.checkSystemStatus()

// Tạo polygon test đơn giản
window.createTestPolygon()

// Debug tọa độ của shape
window.debugShapeCoordinates('poly_1')

// Tạo lại polygon từ shape
window.recreatePolygonFromShape('poly_1')
```

### 3. Kiểm Tra Console Log

Tất cả các bước chuyển đổi tọa độ đều được log chi tiết:

```
sphereFromScreen: trying x=100, y=200
sphereFromScreen: current view - hlookat=45, vlookat=0, fov=90
sphereFromScreen: screen coords - x=500, y=400, center=400,300
sphereFromScreen: relative offsets - x=0.25, y=0.33
sphereFromScreen: calculated - ath=67.5, atv=15
sphereFromScreen: normalized - ath=67.5, atv=15
```

## So Sánh Logic

| Aspect | Logic Cũ | Logic Mới |
|--------|----------|-----------|
| **Số bước chuyển đổi** | 5+ bước | 1 bước |
| **Ray casting** | Có (phức tạp) | Không |
| **Stage coordinates** | Có | Không |
| **Scale calculations** | Có | Không |
| **Fallback methods** | 3 methods | 1 method |
| **Độ phức tạp** | Cao | Thấp |
| **Khả năng debug** | Khó | Dễ |

## Kỳ Vọng

Với logic đơn giản hóa này:

1. **Ít sai số tích lũy** - Chỉ 1 bước chuyển đổi
2. **Dễ debug** - Logic rõ ràng, ít biến số
3. **Ổn định hơn** - Không phụ thuộc vào nhiều API phức tạp
4. **Hiệu suất tốt hơn** - Ít tính toán phức tạp

## Bước Tiếp Theo

1. **Test logic mới** với file `test_polygon_simple.html`
2. **Vẽ polygon thực tế** và so sánh vị trí
3. **Kiểm tra console log** để xác nhận tọa độ
4. **So sánh với logic cũ** nếu cần

## Lưu Ý

- Logic mới giả định FOV là **uniform** (đều theo cả 2 chiều)
- Nếu Krpano sử dụng **different FOV types** (HFOV, VFOV), có thể cần điều chỉnh
- **Test thoroughly** trước khi deploy production
