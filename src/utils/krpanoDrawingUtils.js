/**
 * Krpano Drawing Utilities
 * 
 * Cung cấp các chức năng vẽ hình trên không gian 3D Krpano
 * - Vẽ polygon
 * - Vẽ tự do (freehand)
 * - Di chuyển hình vẽ
 * - Undo khi đang vẽ
 */

// Hàm inject script vào WebView
export const injectDrawingScript = (webViewRef) => {
  if (!webViewRef.current) return;

  const script = `
    // Khởi tạo biến toàn cục để lưu trữ trạng thái vẽ
    if (!window.rnDraw) {
      window.rnDraw = {
        mode: 'idle', // 'idle', 'draw', 'freehand', 'edit', 'move'
        points: [], // Điểm cho polygon
        shapes: [], // Các hình đã vẽ
        selectedId: null, // ID của hình đang được chọn
        freehandPoints: [], // Điểm cho vẽ tự do
        isDrawingFreehand: false, // Đang vẽ tự do hay không
        dragging: false, // Đang kéo hình hay không
        dragLast: null, // Vị trí kéo cuối cùng
        canvas: null, // Canvas để vẽ
        ctx: null, // Context của canvas
        overlay: null, // Overlay để bắt sự kiện
        viewerRect: null, // Kích thước của viewer
        stageScaleX: 1, // Tỷ lệ scale X
        stageScaleY: 1, // Tỷ lệ scale Y
      };

      // Tạo overlay để vẽ
      setupDrawingOverlay();
    }

    // Thiết lập overlay để vẽ
    function setupDrawingOverlay() {
      // Tạo overlay div
      const overlay = document.createElement('div');
      overlay.id = 'drawing-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '999';
      overlay.style.pointerEvents = 'none'; // Mặc định không bắt sự kiện
      overlay.style.display = 'none';

      // Tạo canvas để vẽ
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      overlay.appendChild(canvas);

      // Thêm overlay vào body
      document.body.appendChild(overlay);

      // Lưu trữ tham chiếu
      window.rnDraw.overlay = overlay;
      window.rnDraw.canvas = canvas;
      window.rnDraw.ctx = canvas.getContext('2d');

      // Thiết lập kích thước canvas
      resizeCanvas();

      // Thêm sự kiện resize
      window.addEventListener('resize', resizeCanvas);

      // Thêm sự kiện chuột/touch
      overlay.addEventListener('mousedown', handlePointerDown);
      overlay.addEventListener('mousemove', handlePointerMove);
      overlay.addEventListener('mouseup', handlePointerUp);
      overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      overlay.addEventListener('touchend', handleTouchEnd);

      // Lấy thông tin về viewer
      updateViewerInfo();

      // Log thông báo
      console.log('Drawing overlay setup complete');
    }

    // Cập nhật thông tin về viewer
    function updateViewerInfo() {
      if (typeof krpano !== 'undefined') {
        try {
          // Lấy kích thước của viewer
          const viewer = document.getElementById('krpanoSWFObject');
          if (viewer) {
            window.rnDraw.viewerRect = viewer.getBoundingClientRect();
          } else {
            window.rnDraw.viewerRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
          }

          // Lấy tỷ lệ scale
          window.rnDraw.stageScaleX = 1;
          window.rnDraw.stageScaleY = 1;

          console.log('Viewer info updated');
        } catch (e) {
          console.error('Error updating viewer info:', e);
        }
      }
    }

    // Thay đổi kích thước canvas khi cửa sổ thay đổi
    function resizeCanvas() {
      if (!window.rnDraw || !window.rnDraw.canvas) return;

      const canvas = window.rnDraw.canvas;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Cập nhật thông tin về viewer
      updateViewerInfo();

      // Vẽ lại
      redraw();
    }

    // Cập nhật trạng thái pointer-events của overlay
    function updatePointerEvents() {
      if (!window.rnDraw || !window.rnDraw.overlay) return;

      const overlay = window.rnDraw.overlay;
      const mode = window.rnDraw.mode;

      // Chỉ bắt sự kiện khi đang ở chế độ vẽ, vẽ tự do, chỉnh sửa hoặc di chuyển
      if (mode === 'draw' || mode === 'freehand' || mode === 'edit' || mode === 'move') {
        overlay.style.pointerEvents = 'auto';
        overlay.style.display = 'block';
      } else {
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'none';
      }
    }

    // Xử lý sự kiện chuột/touch bắt đầu
    function handlePointerDown(e) {
      if (!window.rnDraw) return;

      const { mode } = window.rnDraw;
      const { clientX, clientY } = e;

      // Ngăn chặn sự kiện mặc định
      e.preventDefault();

      // Xử lý theo chế độ
      if (mode === 'draw') {
        handleDrawStart(clientX, clientY);
      } else if (mode === 'freehand') {
        handleFreehandStart(clientX, clientY);
      } else if (mode === 'edit') {
        handleEditStart(clientX, clientY);
      } else if (mode === 'move') {
        handleMoveStart(clientX, clientY);
      }
    }

    // Xử lý sự kiện chuột/touch di chuyển
    function handlePointerMove(e) {
      if (!window.rnDraw) return;

      const { mode, isDrawingFreehand, dragging } = window.rnDraw;
      const { clientX, clientY } = e;

      // Ngăn chặn sự kiện mặc định
      e.preventDefault();

      // Xử lý theo chế độ
      if (mode === 'freehand' && isDrawingFreehand) {
        handleFreehandMove(clientX, clientY);
      } else if ((mode === 'edit' || mode === 'move') && dragging) {
        if (mode === 'edit') {
          handleEditMove(clientX, clientY);
        } else {
          handleMoveMove(clientX, clientY);
        }
      }
    }

    // Xử lý sự kiện chuột/touch kết thúc
    function handlePointerUp(e) {
      if (!window.rnDraw) return;

      const { mode, isDrawingFreehand, dragging } = window.rnDraw;

      // Ngăn chặn sự kiện mặc định
      e.preventDefault();

      // Xử lý theo chế độ
      if (mode === 'freehand' && isDrawingFreehand) {
        handleFreehandEnd();
      } else if ((mode === 'edit' || mode === 'move') && dragging) {
        if (mode === 'edit') {
          handleEditEnd();
        } else {
          handleMoveEnd();
        }
      }
    }

    // Xử lý sự kiện touch bắt đầu
    function handleTouchStart(e) {
      if (!window.rnDraw || e.touches.length === 0) return;

      const touch = e.touches[0];
      handlePointerDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
    }

    // Xử lý sự kiện touch di chuyển
    function handleTouchMove(e) {
      if (!window.rnDraw || e.touches.length === 0) return;

      const touch = e.touches[0];
      handlePointerMove({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
    }

    // Xử lý sự kiện touch kết thúc
    function handleTouchEnd(e) {
      handlePointerUp({ preventDefault: () => e.preventDefault() });
    }

    // Xử lý bắt đầu vẽ polygon
    function handleDrawStart(x, y) {
      // Kiểm tra nếu click vào điểm đầu tiên để hoàn thành polygon
      if (window.rnDraw.points.length > 2) {
        const firstPoint = window.rnDraw.points[0];
        if (Math.hypot(x - firstPoint.x, y - firstPoint.y) < 30) {
          console.log('Completing polygon: clicked on first point');
          completePolygon();
          return;
        }
      }

      // Thêm điểm mới vào polygon
      console.log('Adding point to polygon');
      addPoint(x, y);
    }

    // Thêm điểm vào polygon
    function addPoint(x, y) {
      window.rnDraw.points.push({ x, y });
      redraw();
    }

    // Xử lý bắt đầu vẽ tự do
    function handleFreehandStart(x, y) {
      console.log('Starting freehand drawing');
      window.rnDraw.isDrawingFreehand = true;
      window.rnDraw.freehandPoints = [{ x, y }]; // Bắt đầu với điểm đầu tiên
      redrawFreehand();
    }

    // Xử lý di chuyển khi vẽ tự do
    function handleFreehandMove(x, y) {
      if (!window.rnDraw.isDrawingFreehand) return;

      // Thêm điểm mới vào đường vẽ tự do
      window.rnDraw.freehandPoints.push({ x, y });
      redrawFreehand();
    }

    // Xử lý kết thúc vẽ tự do
    function handleFreehandEnd() {
      if (!window.rnDraw.isDrawingFreehand) return;

      // Hoàn thành vẽ tự do
      completeFreehandDrawing();
    }

    // Xử lý bắt đầu chỉnh sửa
    function handleEditStart(x, y) {
      // Kiểm tra xem có click vào shape nào không
      const hitId = hitTestShapes(x, y);
      if (hitId) {
        window.rnDraw.selectedId = hitId;
        window.rnDraw.dragging = true;
        window.rnDraw.dragLast = { x, y };
        redraw();
      }
    }

    // Xử lý di chuyển khi chỉnh sửa
    function handleEditMove(x, y) {
      if (!window.rnDraw.dragging || !window.rnDraw.selectedId) return;

      // Tính toán khoảng cách di chuyển
      const dx = x - window.rnDraw.dragLast.x;
      const dy = y - window.rnDraw.dragLast.y;

      // Cập nhật vị trí kéo cuối cùng
      window.rnDraw.dragLast = { x, y };

      // Tìm shape đang được chọn
      const shape = window.rnDraw.shapes.find(s => s.id === window.rnDraw.selectedId);
      if (shape) {
        // Di chuyển tất cả các điểm của shape
        shape.points.forEach(p => {
          p.x += dx;
          p.y += dy;
        });

        // Vẽ lại
        redraw();
      }
    }

    // Xử lý kết thúc chỉnh sửa
    function handleEditEnd() {
      if (!window.rnDraw.dragging || !window.rnDraw.selectedId) return;

      // Tìm shape đang được chọn
      const shape = window.rnDraw.shapes.find(s => s.id === window.rnDraw.selectedId);
      if (shape) {
        // Cập nhật tọa độ 3D
        shape.spherePoints = [];
        shape.points.forEach(point => {
          const spherePoint = sphereFromScreen(point.x, point.y);
          if (spherePoint) {
            shape.spherePoints.push(spherePoint);
          }
        });

        // Cập nhật hotspot trong Krpano
        updateKrpanoPolygon(shape.id, shape.points);
      }

      // Kết thúc kéo
      window.rnDraw.dragging = false;
      redraw();
    }

    // Xử lý bắt đầu di chuyển trong không gian 3D
    function handleMoveStart(x, y) {
      // Kiểm tra xem có click vào shape nào không
      const hitId = hitTestShapes(x, y);
      if (hitId) {
        window.rnDraw.selectedId = hitId;
        window.rnDraw.dragging = true;
        window.rnDraw.dragLast = { x, y };
        redraw();
      }
    }

    // Xử lý di chuyển trong không gian 3D
    function handleMoveMove(x, y) {
      if (!window.rnDraw.dragging || !window.rnDraw.selectedId) return;

      // Tìm shape đang được chọn
      const shape = window.rnDraw.shapes.find(s => s.id === window.rnDraw.selectedId);
      if (!shape || !shape.spherePoints || shape.spherePoints.length === 0) return;

      // Tính toán khoảng cách di chuyển trên màn hình
      const dx = x - window.rnDraw.dragLast.x;
      const dy = y - window.rnDraw.dragLast.y;

      // Cập nhật vị trí kéo cuối cùng
      window.rnDraw.dragLast = { x, y };

      // Lấy thông tin về góc nhìn hiện tại
      if (typeof krpano !== 'undefined') {
        const view = krpano.get('view');
        const hlookat = parseFloat(view.hlookat) || 0;
        const vlookat = parseFloat(view.vlookat) || 0;
        const fov = parseFloat(view.fov) || 90;

        // Tính toán góc di chuyển dựa trên khoảng cách di chuyển trên màn hình
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const athOffset = (dx / centerX) * (fov * 0.5);
        const atvOffset = (dy / centerY) * (fov * 0.5);

        // Di chuyển tất cả các điểm 3D của shape
        shape.spherePoints.forEach(p => {
          p.ath += athOffset;
          p.atv += atvOffset;
        });

        // Cập nhật tọa độ 2D từ tọa độ 3D mới
        shape.points = shape.spherePoints.map(spherePoint => {
          return screenFromSphere(spherePoint.ath, spherePoint.atv);
        }).filter(p => p !== null);

        // Cập nhật hotspot trong Krpano
        updateKrpanoPolygon(shape.id, shape.points);

        // Vẽ lại
        redraw();
      }
    }

    // Xử lý kết thúc di chuyển trong không gian 3D
    function handleMoveEnd() {
      if (!window.rnDraw.dragging || !window.rnDraw.selectedId) return;

      // Kết thúc kéo
      window.rnDraw.dragging = false;
      redraw();
    }

    // Kiểm tra xem có click vào shape nào không
    function hitTestShapes(x, y) {
      if (!window.rnDraw || !window.rnDraw.shapes) return null;

      // Duyệt qua tất cả các shape
      for (let i = window.rnDraw.shapes.length - 1; i >= 0; i--) {
        const shape = window.rnDraw.shapes[i];
        const points = shape.points;

        // Kiểm tra xem điểm có nằm trong polygon không
        if (isPointInPolygon(x, y, points)) {
          return shape.id;
        }
      }

      return null;
    }

    // Kiểm tra xem điểm có nằm trong polygon không
    function isPointInPolygon(x, y, polygon) {
      if (!polygon || polygon.length < 3) return false;

      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }

      return inside;
    }

    // Xóa tất cả các hình vẽ
    function clearAllDrawings() {
      // Xóa tất cả các hotspot trong Krpano
      if (typeof krpano !== 'undefined') {
        window.rnDraw.shapes.forEach(shape => {
          try {
            krpano.call('removehotspot(' + shape.id + ')');
          } catch (e) {
            console.error('Error removing hotspot:', e);
          }
        });
      }

      // Xóa tất cả các hình vẽ
      window.rnDraw.points = [];
      window.rnDraw.shapes = [];
      window.rnDraw.selectedId = null;
      window.rnDraw.freehandPoints = [];
      window.rnDraw.isDrawingFreehand = false;

      redraw();
    }

    // Hoàn thành polygon và chuyển đổi thành hotspot 3D
    function completePolygon() {
      const pts = window.rnDraw.points;
      if (pts.length < 3) return;

      // Tạo ID cho polygon mới
      const id = 'poly_' + ((window.rnPolygonCounter || 0) + 1);
      window.rnPolygonCounter = (window.rnPolygonCounter || 0) + 1;

      // Tạo shape mới
      const shape = {
        id,
        color: '#00FF00',
        points: pts.slice(),
        spherePoints: [] // Sẽ được điền sau khi chuyển đổi sang tọa độ 3D
      };

      // Thêm shape vào danh sách và chọn nó
      window.rnDraw.shapes.push(shape);
      window.rnDraw.selectedId = id;

      console.log('=== COMPLETE POLYGON ===');
      console.log('id=' + id + ', points=' + pts.length);

      // Chuyển đổi các điểm sang tọa độ 3D trước khi tạo hotspot
      shape.spherePoints = [];
      console.log('DEBUG - Converting polygon points to 3D coordinates');
      
      // Đảm bảo krpano đã được khởi tạo
      if (typeof krpano === 'undefined') {
        console.error('Krpano not available for 3D conversion');
        return;
      }
      
      // Lấy thông tin view hiện tại để debug
      const view = krpano.get('view');
      console.log("DEBUG - Current view: hlookat=" + view.hlookat + ", vlookat=" + view.vlookat + ", fov=" + view.fov);
      
      // Chuyển đổi từng điểm sang tọa độ 3D
      shape.points.forEach((point, index) => {
        console.log("DEBUG - Converting point " + index + ": (" + point.x + ", " + point.y + ")");
        const spherePoint = sphereFromScreen(point.x, point.y);
        if (spherePoint) {
          shape.spherePoints.push(spherePoint);
          console.log("DEBUG - Converted to 3D: ath=" + spherePoint.ath + ", atv=" + spherePoint.atv);
        } else {
          console.error("DEBUG - Failed to convert point " + index);
        }
      });

      console.log("DEBUG - Converted " + shape.spherePoints.length + "/" + shape.points.length + " points to 3D");

      // Tạo hotspot trong Krpano sử dụng tọa độ 3D
      if (shape.spherePoints.length > 0) {
        // Kiểm tra lại tọa độ 3D trước khi tạo hotspot
        console.log('DEBUG - Sphere points before creating hotspot:');
        shape.spherePoints.forEach((point, index) => {
          console.log('DEBUG - Point ' + index + ': ath=' + point.ath + ', atv=' + point.atv);
        });
        
        createKrpanoPolygon(id, shape.points, false); // Truyền false để đánh dấu là polygon thông thường
      } else {
        console.error('Không thể tạo hotspot: không có tọa độ 3D hợp lệ');
      }

      // Reset trạng thái vẽ
      window.rnDraw.points = [];

      redraw();
    }

    // Hoàn thành vẽ tự do và chuyển đổi thành hotspot 3D
    function completeFreehandDrawing() {
      const pts = window.rnDraw.freehandPoints;
      if (pts.length < 5) return; // Cần ít nhất 5 điểm để tạo hình có ý nghĩa

      // Tạo ID cho hình vẽ tự do
      const id = 'freehand_' + ((window.rnFreehandCounter || 0) + 1);
      window.rnFreehandCounter = (window.rnFreehandCounter || 0) + 1;

      // Đơn giản hóa đường vẽ bằng cách lấy mẫu các điểm
      const simplifiedPoints = simplifyPoints(pts, 5); // Khoảng cách tối thiểu giữa các điểm

      // Tạo shape mới - KHÔNG nối điểm đầu với điểm cuối
      const shape = {
        id,
        color: '#FF0000',
        points: simplifiedPoints,
        spherePoints: [], // Sẽ được điền sau khi chuyển đổi sang tọa độ 3D
        isFreehand: true, // Đánh dấu là vẽ tự do để không nối điểm đầu-cuối
        hidePoints: true  // Đánh dấu để ẩn các điểm khi vẽ hoàn thành
      };

      // Thêm shape vào danh sách và chọn nó
      window.rnDraw.shapes.push(shape);
      window.rnDraw.selectedId = id;

      console.log('=== COMPLETE FREEHAND ===');
      console.log('id=' + id + ', points=' + simplifiedPoints.length + ' (từ ' + pts.length + ' điểm gốc)');

      // Chuyển đổi các điểm sang tọa độ 3D trước khi tạo hotspot
      shape.spherePoints = [];
      console.log('DEBUG - Converting freehand points to 3D coordinates');
      
      // Đảm bảo krpano đã được khởi tạo
      if (typeof krpano === 'undefined') {
        console.error('Krpano not available for 3D conversion');
        return;
      }
      
      // Lấy thông tin view hiện tại để debug
      const view = krpano.get('view');
      console.log("DEBUG - Current view: hlookat=" + view.hlookat + ", vlookat=" + view.vlookat + ", fov=" + view.fov);
      
      // Chuyển đổi từng điểm sang tọa độ 3D
      shape.points.forEach((point, index) => {
        console.log("DEBUG - Converting freehand point " + index + ": (" + point.x + ", " + point.y + ")");
        const spherePoint = sphereFromScreen(point.x, point.y);
        if (spherePoint) {
          shape.spherePoints.push(spherePoint);
          console.log("DEBUG - Converted to 3D: ath=" + spherePoint.ath + ", atv=" + spherePoint.atv);
        } else {
          console.error("DEBUG - Failed to convert freehand point " + index);
        }
      });

      console.log("DEBUG - Converted " + shape.spherePoints.length + "/" + shape.points.length + " freehand points to 3D");

      // Tạo hotspot trong Krpano sử dụng tọa độ 3D
      if (shape.spherePoints.length > 0) {
        // Kiểm tra lại tọa độ 3D trước khi tạo hotspot
        console.log('DEBUG - Freehand sphere points before creating hotspot:');
        shape.spherePoints.forEach((point, index) => {
          console.log('DEBUG - Point ' + index + ': ath=' + point.ath + ', atv=' + point.atv);
        });
        
        createKrpanoPolygon(id, shape.points, true); // Truyền true để đánh dấu là vẽ tự do
      } else {
        console.error('Không thể tạo hotspot: không có tọa độ 3D hợp lệ');
      }

      // Reset trạng thái vẽ
      window.rnDraw.freehandPoints = [];
      window.rnDraw.isDrawingFreehand = false;

      redraw();
    }

    // Đơn giản hóa đường vẽ bằng cách lấy mẫu các điểm
    function simplifyPoints(points, minDistance) {
      if (!points || points.length < 2) return points;

      const result = [points[0]];
      let lastPoint = points[0];

      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);

        if (distance >= minDistance) {
          result.push(point);
          lastPoint = point;
        }
      }

      // Luôn thêm điểm cuối cùng
      if (points.length > 1 && result[result.length - 1] !== points[points.length - 1]) {
        result.push(points[points.length - 1]);
      }

      return result;
    }

    // Xóa điểm cuối cùng của polygon đang vẽ
    function undoLastPoint() {
      if (window.rnDraw.mode === 'draw' && window.rnDraw.points.length > 0) {
        window.rnDraw.points.pop();
        redraw();
        console.log('Undo last point: point removed, remaining points: ' + window.rnDraw.points.length);
        return true;
      }
      console.log('Undo last point: no point to undo or not in drawing mode');
      return false;
    }

    // Vẽ lại canvas
    function redraw() {
      if (!window.rnDraw || !window.rnDraw.ctx || !window.rnDraw.canvas) return;

      const { ctx, canvas, points, shapes, selectedId, mode } = window.rnDraw;

      // Xóa canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Vẽ các shape đã hoàn thành
      if (shapes.length > 0) {
        // Đảm bảo overlay luôn hiển thị khi có shapes
        window.rnDraw.overlay.style.display = 'block';
        window.rnDraw.overlay.style.opacity = '1';

        drawShapesAs3D(ctx, shapes, selectedId);
      }

      // Vẽ polygon đang vẽ dở
      if (mode === 'draw' && points.length > 0) {
        // Vẽ đường nối các điểm
        drawPolyline(ctx, points, '#FF0000');

        // Vẽ các điểm
        points.forEach((p, index) => {
          drawPoint(ctx, p.x, p.y, index === 0 ? '#00FF00' : '#FF0000');
        });
      }
    }

    // Vẽ lại đường vẽ tự do
    function redrawFreehand() {
      if (!window.rnDraw || !window.rnDraw.ctx || !window.rnDraw.canvas) return;

      const { ctx, canvas, freehandPoints } = window.rnDraw;

      // Xóa canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Vẽ các shape đã hoàn thành
      if (window.rnDraw.shapes.length > 0) {
        drawShapesAs3D(ctx, window.rnDraw.shapes, window.rnDraw.selectedId);
      }

      // Vẽ đường vẽ tự do đang vẽ dở
      if (freehandPoints.length > 0) {
        drawPolyline(ctx, freehandPoints, '#FF0000');
      }
    }

    // Vẽ các shape với hiệu ứng 3D
    function drawShapesAs3D(ctx, shapes, selectedId) {
      shapes.forEach(shape => {
        const isSelected = shape.id === selectedId;

        // Luôn ưu tiên sử dụng tọa độ 3D đã lưu
        let screenPoints = [];

        // Nếu có tọa độ 3D đã lưu, chuyển đổi về tọa độ màn hình
        if (shape.spherePoints && shape.spherePoints.length > 0 && typeof krpano !== 'undefined') {
          try {
            // Sử dụng API của Krpano để chuyển đổi tọa độ 3D sang tọa độ màn hình
            screenPoints = shape.spherePoints.map(spherePoint => {
              // Sử dụng hàm spheretoscreen của Krpano
              const screenPos = krpano.spheretoscreen(spherePoint.ath, spherePoint.atv);
              
              // Kiểm tra giá trị hợp lệ
              if (isNaN(screenPos.x) || isNaN(screenPos.y)) {
                // Fallback sang phương pháp cũ nếu API không hoạt động
                const view = krpano.get('view');
                const hlookat = parseFloat(view.hlookat) || 0;
                const vlookat = parseFloat(view.vlookat) || 0;
                const fov = parseFloat(view.fov) || 90;

                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;

                // Tính toán offset tương đối từ center
                const athOffset = spherePoint.ath - hlookat;
                const atvOffset = spherePoint.atv - vlookat;

                // Chuyển đổi sang tọa độ màn hình
                const screenX = centerX + (athOffset / (fov * 0.5)) * centerX;
                const screenY = centerY + (atvOffset / (fov * 0.5)) * centerY;

                return { x: screenX, y: screenY };
              }
              
              return { x: screenPos.x, y: screenPos.y };
            });
          } catch (e) {
            console.error('Error converting 3D to 2D:', e);
            screenPoints = [];
          }

          // Nếu không thể chuyển đổi, sử dụng tọa độ 2D hiện có
          if (screenPoints.length === 0) {
            screenPoints = shape.points;
          }
        } else {
          // Fallback sử dụng tọa độ 2D nếu không có tọa độ 3D
          screenPoints = shape.points;

          // Chuyển đổi tọa độ 2D sang 3D và cập nhật hotspot
          if (screenPoints.length > 0) {
            shape.spherePoints = [];
            screenPoints.forEach(point => {
              const spherePoint = sphereFromScreen(point.x, point.y);
              if (spherePoint) {
                shape.spherePoints.push(spherePoint);
              }
            });

            // Cập nhật hotspot Krpano nếu shape đã có ID
            if (shape.id) {
              updateKrpanoPolygon(shape.id, screenPoints);
            }
          }
        }

        // Vẽ polygon với perspective 3D
        drawPolygon3D(ctx, screenPoints, shape.color, isSelected, shape.isFreehand);
      });
    }

    // Vẽ polygon với hiệu ứng 3D
    function drawPolygon3D(ctx, pts, color, highlighted, isFreehand) {
      if (pts.length < 2) return; // Cho phép vẽ đường thẳng với 2 điểm

      // Vẽ với hiệu ứng 3D
      ctx.strokeStyle = highlighted ? '#FFFF00' : color;
      ctx.lineWidth = highlighted ? 4 : 3;
      ctx.lineCap = 'round';

      // Vẽ outline
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }

      // Chỉ nối điểm đầu-cuối nếu là polygon (không phải vẽ tự do)
      if (!isFreehand) {
        ctx.closePath();
      }

      ctx.stroke();

      // Vẽ các điểm nếu đang được chọn và không phải là vẽ tự do hoặc không có yêu cầu ẩn điểm
      const shape = window.rnDraw.shapes.find(s => s.id === window.rnDraw.selectedId);
      const hidePoints = shape && shape.hidePoints;
      
      if (highlighted && (!isFreehand || !hidePoints)) {
        pts.forEach(p => {
          drawPoint(ctx, p.x, p.y, '#FFFF00');
        });
      }
    }

    // Vẽ đường nối các điểm
    function drawPolyline(ctx, pts, color) {
      if (pts.length < 2) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }

    // Vẽ điểm
    function drawPoint(ctx, x, y, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chuyển đổi tọa độ màn hình sang tọa độ 3D
    function sphereFromScreen(x, y) {
      if (typeof krpano === 'undefined') return null;

      try {
        console.log('DEBUG - Converting screen (' + x + ', ' + y + ') to sphere coordinates');
        
        // Sử dụng API của Krpano để chuyển đổi tọa độ màn hình sang tọa độ 3D
        // Phương pháp này chính xác hơn vì sử dụng các phép tính nội bộ của Krpano
        let sphereCoords;
        try {
          sphereCoords = krpano.screentosphere(x, y);
          console.log('DEBUG - Raw krpano.screentosphere result:', sphereCoords);
        } catch (err) {
          console.error('Error calling krpano.screentosphere:', err);
          sphereCoords = null;
        }
        
        // Kiểm tra kết quả từ API
        if (sphereCoords && !isNaN(sphereCoords.x) && !isNaN(sphereCoords.y)) {
          const ath = sphereCoords.x;
          const atv = sphereCoords.y;
          console.log('DEBUG - Converted to sphere: ath=' + ath + ', atv=' + atv);
          return { ath, atv };
        } else {
          console.warn('Invalid spherical coordinates from API, using fallback method');
          
          // Fallback sang phương pháp cũ nếu API không hoạt động
          const view = krpano.get('view');
          const hlookat = parseFloat(view.hlookat) || 0;
          const vlookat = parseFloat(view.vlookat) || 0;
          const fov = parseFloat(view.fov) || 90;

          console.log('DEBUG - Current view: hlookat=' + hlookat + ', vlookat=' + vlookat + ', fov=' + fov);

          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;

          // Tính toán offset tương đối từ center (-1 đến +1)
          const xOffset = (x - centerX) / centerX;
          const yOffset = (y - centerY) / centerY;

          // Chuyển đổi offset thành góc
          const athOffset = xOffset * (fov * 0.5);
          const atvOffset = yOffset * (fov * 0.5);

          // Tính toán tọa độ 3D
          const result = { 
            ath: hlookat + athOffset, 
            atv: vlookat + atvOffset 
          };
          
          console.log('DEBUG - Fallback sphere coords: ath=' + result.ath + ', atv=' + result.atv);
          return result;
        }
      } catch (e) {
        console.error('sphereFromScreen error:', e);
        return null;
      }
    }

    // Chuyển đổi tọa độ 3D sang tọa độ màn hình
    function screenFromSphere(ath, atv) {
      if (typeof krpano === 'undefined') return null;

      try {
        // Sử dụng API của Krpano để chuyển đổi tọa độ 3D sang tọa độ màn hình
        // Phương pháp này chính xác hơn vì sử dụng các phép tính nội bộ của Krpano
        const screenPos = krpano.spheretoscreen(ath, atv);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        
        // Kiểm tra giá trị hợp lệ
        if (isNaN(screenX) || isNaN(screenY)) {
          console.warn('Invalid screen coordinates:', screenX, screenY);
          
          // Fallback sang phương pháp cũ nếu API không hoạt động
          const view = krpano.get('view');
          const hlookat = parseFloat(view.hlookat) || 0;
          const vlookat = parseFloat(view.vlookat) || 0;
          const fov = parseFloat(view.fov) || 90;

          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;

          // Tính toán offset tương đối từ center
          const athOffset = ath - hlookat;
          const atvOffset = atv - vlookat;

          // Chuyển đổi sang tọa độ màn hình
          return { 
            x: centerX + (athOffset / (fov * 0.5)) * centerX, 
            y: centerY + (atvOffset / (fov * 0.5)) * centerY 
          };
        }
        
        return { x: screenX, y: screenY };
      } catch (e) {
        console.error('screenFromSphere error:', e);
        return null;
      }
    }

    // Tạo polygon hotspot trong Krpano
    function createKrpanoPolygon(id, points, isFreehand) {
      console.log('Creating Krpano polygon:', id, isFreehand ? '(freehand)' : '');

      if (typeof krpano === 'undefined') {
        console.error('Krpano not available for creation');
        return;
      }

      try {
        // Tạo hotspot polygon
        krpano.call('addhotspot(' + id + ')');
        krpano.set('hotspot[' + id + '].type', 'polygon');
        krpano.set('hotspot[' + id + '].renderer', 'webgl');
        
        // Thiết lập màu sắc dựa vào loại vẽ
        const color = isFreehand ? '0xFF0000' : '0x00FF00';
        krpano.set('hotspot[' + id + '].fillcolor', color);
        krpano.set('hotspot[' + id + '].fillalpha', '0.3'); // Đổ màu nhẹ cho hình vẽ
        krpano.set('hotspot[' + id + '].bordercolor', color);
        krpano.set('hotspot[' + id + '].borderalpha', '1.0');
        krpano.set('hotspot[' + id + '].borderwidth', '2.0');
        krpano.set('hotspot[' + id + '].fill', 'true'); // Đổ màu cho hình vẽ
        krpano.set('hotspot[' + id + '].zorder', '1000');
        krpano.set('hotspot[' + id + '].visible', 'true');
        
        // Thiết lập thuộc tính đặc biệt cho vẽ tự do
        if (isFreehand) {
          // Đánh dấu là vẽ tự do để không nối điểm đầu-cuối
          krpano.set('hotspot[' + id + '].polyline', 'true');
        }

        // Sử dụng tọa độ 3D đã được tính toán trước đó
        const shape = window.rnDraw.shapes.find(s => s.id === id);
        if (shape && shape.spherePoints && shape.spherePoints.length > 0) {
          // Tạo chuỗi điểm cho Krpano từ tọa độ 3D đã có
          let pointsStr = '';

          // Debug log để kiểm tra tọa độ 3D
          console.log('DEBUG - 3D points for ' + id + ':');
          for (let i = 0; i < shape.spherePoints.length; i++) {
            const sp = shape.spherePoints[i];
            console.log('Point ' + i + ': ath=' + sp.ath + ', atv=' + sp.atv);
            pointsStr += sp.ath + ',' + sp.atv + ',';
          }

          // Xóa dấu phẩy cuối cùng
          if (pointsStr.endsWith(',')) {
            pointsStr = pointsStr.slice(0, -1);
          }

          // Debug log chuỗi điểm cuối cùng
          console.log('DEBUG - Final points string:', pointsStr);

          // Thiết lập điểm cho hotspot
          krpano.set('hotspot[' + id + '].point', pointsStr);
          
          // Thêm sự kiện click cho hotspot
          krpano.set('hotspot[' + id + '].onclick', 'js(selectShape("' + id + '"))');

          console.log('Polygon created with ' + shape.spherePoints.length + ' 3D points');
          
          // Kiểm tra hotspot đã được tạo thành công
          setTimeout(() => {
            try {
              const pointValue = krpano.get('hotspot[' + id + '].point');
              if (pointValue) {
                console.log('Hotspot points verified:', pointValue);
                
                // Thử gọi API để kiểm tra hotspot
                const hotspotExists = krpano.get('hotspot[' + id + '].name');
                console.log('Hotspot exists:', hotspotExists);
                
                // Thử lấy thông tin về hotspot
                console.log('Hotspot type:', krpano.get('hotspot[' + id + '].type'));
                console.log('Hotspot visible:', krpano.get('hotspot[' + id + '].visible'));
              } else {
                console.error('Hotspot points not set correctly!');
                
                // Thử tạo lại hotspot với cách khác
                console.log('Trying alternative method to create hotspot...');
                krpano.call('addhotspot(' + id + '); set(hotspot[' + id + '].point,' + pointsStr + ');');
              }
            } catch (err) {
              console.error('Error verifying hotspot:', err);
            }
          }, 100);
        } else {
          console.error('No valid spherePoints found for shape:', id);
          
          // Thử chuyển đổi lại các điểm sang tọa độ 3D
          console.log('Attempting to reconvert points to 3D...');
          if (points && points.length > 0) {
            const newSpherePoints = [];
            points.forEach((point, index) => {
              const spherePoint = sphereFromScreen(point.x, point.y);
              if (spherePoint) {
                newSpherePoints.push(spherePoint);
                console.log('Reconverted point ' + index + ': ath=' + spherePoint.ath + ', atv=' + spherePoint.atv);
              }
            });
            
            if (newSpherePoints.length > 0) {
              // Tạo chuỗi điểm mới
              let newPointsStr = '';
              for (let i = 0; i < newSpherePoints.length; i++) {
                const sp = newSpherePoints[i];
                newPointsStr += sp.ath + ',' + sp.atv + ',';
              }
              
              if (newPointsStr.endsWith(',')) {
                newPointsStr = newPointsStr.slice(0, -1);
              }
              
              console.log('Setting hotspot with reconverted points:', newPointsStr);
              krpano.set('hotspot[' + id + '].point', newPointsStr);
            }
          }
        }
      } catch (e) {
        console.error('Error creating Krpano polygon:', e);
      }
    }
    
    // Hàm chọn shape khi click vào hotspot
    function selectShape(id) {
      if (!window.rnDraw) return;
      
      window.rnDraw.selectedId = id;
      redraw();
      console.log('Shape selected:', id);
    }

    // Cập nhật polygon hotspot trong Krpano
    function updateKrpanoPolygon(id, points) {
      console.log('Updating Krpano polygon:', id);

      if (typeof krpano === 'undefined') {
        console.error('Krpano not available for update');
        return;
      }

      try {
        // Kiểm tra xem hotspot có tồn tại không
        if (!krpano.get('hotspot[' + id + ']')) {
          console.error('Hotspot does not exist:', id);
          // Thử tạo lại hotspot
          const shape = window.rnDraw.shapes.find(s => s.id === id);
          if (shape) {
            console.log('Recreating hotspot:', id);
            const isFreehand = shape.isFreehand || false;
            createKrpanoPolygon(id, shape.points, isFreehand);
            return;
          }
          return;
        }

        // Tìm shape đang được cập nhật
        const shape = window.rnDraw.shapes.find(s => s.id === id);
        if (shape && shape.spherePoints && shape.spherePoints.length > 0) {
          // Tạo chuỗi điểm cho Krpano từ tọa độ 3D đã có
          let pointsStr = '';

          // Debug log để kiểm tra tọa độ 3D
          console.log('DEBUG - Updating 3D points for ' + id + ':');
          for (let i = 0; i < shape.spherePoints.length; i++) {
            const sp = shape.spherePoints[i];
            console.log('Point ' + i + ': ath=' + sp.ath + ', atv=' + sp.atv);
            pointsStr += sp.ath + ',' + sp.atv + ',';
          }

          // Xóa dấu phẩy cuối cùng
          if (pointsStr.endsWith(',')) {
            pointsStr = pointsStr.slice(0, -1);
          }

          // Debug log chuỗi điểm cuối cùng
          console.log('DEBUG - Final update points string:', pointsStr);

          // Thiết lập điểm cho hotspot
          krpano.set('hotspot[' + id + '].point', pointsStr);

          console.log('Polygon updated with ' + shape.spherePoints.length + ' 3D points');
          
          // Kiểm tra hotspot đã được cập nhật thành công
          setTimeout(() => {
            try {
              const pointValue = krpano.get('hotspot[' + id + '].point');
              if (pointValue) {
                console.log('Hotspot points update verified:', pointValue);
              } else {
                console.error('Hotspot points not updated correctly!');
                
                // Thử cập nhật lại hotspot với cách khác
                console.log('Trying alternative method to update hotspot...');
                krpano.call('set(hotspot[' + id + '].point,' + pointsStr + ');');
              }
            } catch (err) {
              console.error('Error verifying hotspot update:', err);
            }
          }, 100);
        } else if (points && points.length > 0) {
          // Nếu không có tọa độ 3D, thử chuyển đổi từ tọa độ 2D
          console.log('No spherePoints found, converting from 2D points...');
          
          // Chuyển đổi các điểm 2D sang 3D
          const newSpherePoints = [];
          points.forEach((point, index) => {
            const spherePoint = sphereFromScreen(point.x, point.y);
            if (spherePoint) {
              newSpherePoints.push(spherePoint);
              console.log('Converted point ' + index + ': ath=' + spherePoint.ath + ', atv=' + spherePoint.atv);
            }
          });
          
          if (newSpherePoints.length > 0) {
            // Cập nhật spherePoints cho shape
            if (shape) {
              shape.spherePoints = newSpherePoints;
            }
            
            // Tạo chuỗi điểm mới
            let newPointsStr = '';
            for (let i = 0; i < newSpherePoints.length; i++) {
              const sp = newSpherePoints[i];
              newPointsStr += sp.ath + ',' + sp.atv + ',';
            }
            
            if (newPointsStr.endsWith(',')) {
              newPointsStr = newPointsStr.slice(0, -1);
            }
            
            console.log('Setting hotspot with newly converted points:', newPointsStr);
            krpano.set('hotspot[' + id + '].point', newPointsStr);
          } else {
            console.error('Failed to convert any points to 3D');
          }
        } else {
          console.error('No valid points found for update');
        }
      } catch (e) {
        console.error('Error updating Krpano polygon:', e);
      }
    }

    // Đặt chế độ vẽ
    window.setDrawingMode = function(mode) {
      if (!window.rnDraw) return;

      window.rnDraw.mode = mode;
      updatePointerEvents();

      // Reset trạng thái vẽ
      if (mode === 'draw') {
        window.rnDraw.points = [];
      } else if (mode === 'freehand') {
        window.rnDraw.freehandPoints = [];
        window.rnDraw.isDrawingFreehand = false;
      } else if (mode === 'edit' || mode === 'move') {
        window.rnDraw.dragging = false;
      }

      redraw();
      return true;
    };

    // Xóa điểm cuối cùng
    window.undoLastPoint = function() {
      return undoLastPoint();
    };

    // Xóa tất cả các hình vẽ
    window.clearAllDrawings = function() {
      clearAllDrawings();
      return true;
    };

    // Kiểm tra trạng thái hệ thống
    window.checkSystemStatus = function() {
      const status = {
        mode: window.rnDraw ? window.rnDraw.mode : 'not initialized',
        points: window.rnDraw ? window.rnDraw.points.length : 0,
        shapes: window.rnDraw ? window.rnDraw.shapes.length : 0,
        selectedId: window.rnDraw ? window.rnDraw.selectedId : null,
        krpanoAvailable: typeof krpano !== 'undefined'
      };

      console.log('System status:', status);
      return status;
    };

    console.log('Drawing script injected successfully');
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Chuyển sang chế độ vẽ polygon
export const toggleDrawingMode = (webViewRef) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw) {
      const currentMode = window.rnDraw.mode;
      const newMode = currentMode === 'draw' ? 'idle' : 'draw';
      window.setDrawingMode(newMode);
      console.log('Drawing mode toggled to: ' + newMode);
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Chuyển sang chế độ vẽ tự do
export const toggleFreehandMode = (webViewRef) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw) {
      const currentMode = window.rnDraw.mode;
      const newMode = currentMode === 'freehand' ? 'idle' : 'freehand';
      window.setDrawingMode(newMode);
      console.log('Freehand mode toggled to: ' + newMode);
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Chuyển sang chế độ chỉnh sửa
export const toggleEditMode = (webViewRef, enable) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw) {
      const newMode = ` + (enable ? "'edit'" : "'idle'") + `;
      window.setDrawingMode(newMode);
      console.log('Edit mode set to: ' + newMode);
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Chuyển sang chế độ di chuyển trong không gian 3D
export const toggleMoveMode = (webViewRef, enable) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw) {
      const newMode = ` + (enable ? "'move'" : "'idle'") + `;
      window.setDrawingMode(newMode);
      console.log('Move mode set to: ' + newMode);
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Xóa điểm cuối cùng khi đang vẽ
export const undoLastPoint = (webViewRef) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw) {
      // Gọi trực tiếp hàm undoLastPoint đã định nghĩa trong WebView
      const result = undoLastPoint();
      console.log('Undo last point: ' + (result ? 'success' : 'no point to undo'));
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};

// Xóa tất cả các hình vẽ
export const clearDrawing = (webViewRef) => {
  if (!webViewRef.current) return;

  const script = `
    if (window.rnDraw && window.clearAllDrawings) {
      window.clearAllDrawings();
      console.log('All drawings cleared');
    } else {
      console.log('Drawing system not initialized');
    }
    true;
  `;

  webViewRef.current.injectJavaScript(script);
};