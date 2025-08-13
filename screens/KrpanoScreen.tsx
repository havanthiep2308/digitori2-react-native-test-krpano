import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';

const KrpanoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { url } = route.params as { url: string };
  
  const webViewRef = useRef<WebView>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{x: number, y: number}>>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const toggleDrawingMode = () => {
    if (isEditMode) {
      // tắt edit trước khi vẽ
      toggleEditMode(false);
    }
    setIsDrawingMode(!isDrawingMode);
    if (!isDrawingMode) {
      // Bắt đầu chế độ vẽ
      setDrawingPoints([]);
      setShowInstructions(true);
      injectDrawingScript();
      
      setTimeout(() => {
        setShowInstructions(false);
      }, 5000);
    } else {
      // Thoát chế độ vẽ / chỉnh sửa: chỉ tắt tương tác, KHÔNG xoá hình
      const script = `if (window.exitShapeEdit) { window.exitShapeEdit(); }`;
      webViewRef.current?.injectJavaScript(script);
      setShowInstructions(false);
    }
  };

  const toggleEditMode = (forceValue?: boolean) => {
    const next = forceValue !== undefined ? forceValue : !isEditMode;
    setIsEditMode(next);
    const script = next
      ? `if (window.enableShapeEdit) { window.enableShapeEdit(); }`
      : `if (window.exitShapeEdit) { window.exitShapeEdit(); }`;
    webViewRef.current?.injectJavaScript(script);
  };

  const undoLastPoint = () => {
    const script = `
      if (window.undoLastPoint) {
        window.undoLastPoint();
      }
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  const injectDrawingScript = () => {
    const script = `
      (function() {
        const RN = window.ReactNativeWebView;
        function log(msg){ try{ RN && RN.postMessage('[draw] ' + msg); }catch(e){} }
        log('inject start');

        // State tổng
        window.rnDraw = {
          overlay: null,
          canvas: null,
          ctx: null,
          points: [], // điểm đang vẽ (preview)
          active: true,
          completed: false,
          shapes: [], // các hình đã tạo { id, color, points: [{x,y}] }
          selectedId: null,
          dragging: false,
          dragLast: { x: 0, y: 0 },
          mode: 'draw', // 'draw' | 'edit' | 'idle'
          viewerEl: null,
          viewerCanvas: null,
          viewerRect: { left: 0, top: 0, width: 0, height: 0 },
          stageScaleX: 1,
          stageScaleY: 1,
          onViewChange: null
        };

        // Helpers hiển/ẩn overlay
        function updatePointerEvents(){
          if(!window.rnDraw || !window.rnDraw.overlay || !window.rnDraw.canvas) return;
          const interact = (window.rnDraw.mode==='edit' || window.rnDraw.mode==='draw');
          const pe = interact ? 'auto' : 'none';
          window.rnDraw.overlay.style.pointerEvents = pe;
          window.rnDraw.canvas.style.pointerEvents = pe;
        }
        function showOverlay(){ if(window.rnDraw && window.rnDraw.overlay){ window.rnDraw.overlay.style.display='block'; updatePointerEvents(); } }
        function hideOverlay(){ if(window.rnDraw && window.rnDraw.overlay){ window.rnDraw.overlay.style.display='none'; } }
        
        // Tạo overlay và canvas
        createOverlay();
        bindEvents();
        resizeCanvas();
        redraw();

        function createOverlay(){
          const old = document.getElementById('rn-draw-overlay');
          if (old && old.parentNode) old.parentNode.removeChild(old);

          const overlay = document.createElement('div');
          overlay.id = 'rn-draw-overlay';
          overlay.style.position = 'fixed';
          overlay.style.inset = '0';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.zIndex = '2147483647';
          // Cho phép overlay nhận sự kiện khi vẽ/chỉnh sửa
          overlay.style.pointerEvents = 'auto';
          overlay.style.background = 'transparent';

          const canvas = document.createElement('canvas');
          canvas.id = 'rn-draw-canvas';
          canvas.style.position = 'absolute';
          canvas.style.top = '0';
          canvas.style.left = '0';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.pointerEvents = 'auto';
          overlay.appendChild(canvas);

          document.body.appendChild(overlay);

          window.rnDraw.overlay = overlay;
          window.rnDraw.canvas = canvas;
          window.rnDraw.ctx = canvas.getContext('2d');

          // dấu test
          window.rnDraw.ctx.fillStyle = 'rgba(255,0,0,0.5)';
          window.rnDraw.ctx.fillRect(10,10,20,20);

          showOverlay();
        }
        
        function resizeCanvas(){
          const { canvas, ctx } = window.rnDraw;
          const ratio = window.devicePixelRatio || 1;
          canvas.width = Math.floor(window.innerWidth * ratio);
          canvas.height = Math.floor(window.innerHeight * ratio);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          updateViewerRect();
        }

        function bindEvents(){
          const { canvas } = window.rnDraw;

          const onPointerDown = (clientX, clientY) => {
            const { mode } = window.rnDraw;
            const { x, y } = toCanvasXY(clientX, clientY);
            log('onPointerDown: mode=' + mode + ', x=' + x + ', y=' + y);

            if (mode === 'draw'){
              if (window.rnDraw.points.length > 2){
                const f = window.rnDraw.points[0];
                if (Math.hypot(x-f.x, y-f.y) < 30){ 
                  log('onPointerDown: completing polygon');
                  completePolygon(); 
                  return true; 
                }
              }
              log('onPointerDown: adding point');
              addPreviewPoint(x,y);
              return true;
            }

            if (mode === 'edit'){
              const hitId = hitTestShapes(x, y);
              if (hitId){
                window.rnDraw.selectedId = hitId;
                window.rnDraw.dragging = true;
                window.rnDraw.dragLast = { x, y };
                redraw();
                return true;
              }
              return false; // không trúng shape -> cho phép quay pano
            }
            return false; // idle
          };

          const onPointerMove = (clientX, clientY) => {
            if (!window.rnDraw.dragging) return false;
            const { x, y } = toCanvasXY(clientX, clientY);
            const dx = x - window.rnDraw.dragLast.x;
            const dy = y - window.rnDraw.dragLast.y;
            window.rnDraw.dragLast = { x, y };

            const shape = getSelectedShape();
            if (!shape) return false;
            for (let i=0;i<shape.points.length;i++){
              shape.points[i].x += dx;
              shape.points[i].y += dy;
            }
            updateKrpanoPolygon(shape.id, shape.points);
            redraw();
            return true;
          };

          const onPointerUp = () => {
            const wasDragging = window.rnDraw.dragging;
            window.rnDraw.dragging = false;
            return wasDragging;
          };

          // Chỉ bắt sự kiện khi cần thiết
          canvas.addEventListener('pointerdown', e => { 
            const handled = onPointerDown(e.clientX, e.clientY);
            if (handled) e.preventDefault();
          }, { passive:false });
          
          canvas.addEventListener('pointermove', e => { 
            const handled = onPointerMove(e.clientX, e.clientY);
            if (handled) e.preventDefault();
          }, { passive:false });
          
          canvas.addEventListener('pointerup', e => { 
            const handled = onPointerUp();
            if (handled) e.preventDefault();
          }, { passive:false });
          
          canvas.addEventListener('touchstart', e => { 
            const t = e.changedTouches[0];
            if (t) {
              const handled = onPointerDown(t.clientX, t.clientY);
              if (handled) e.preventDefault();
            }
          }, { passive:false });
          
          canvas.addEventListener('touchmove', e => { 
            const t = e.changedTouches[0];
            if (t) {
              const handled = onPointerMove(t.clientX, t.clientY);
              if (handled) e.preventDefault();
            }
          }, { passive:false });
          
          canvas.addEventListener('touchend', e => { 
            const handled = onPointerUp();
            if (handled) e.preventDefault();
          }, { passive:false });

          window.addEventListener('resize', resizeCanvas);

          window.clearDrawing = clearAll;
          window.undoLastPoint = undoLastPoint;
          window.completePolygon = completePolygon;
          window.enableShapeEdit = function(){ 
            window.rnDraw.mode='edit'; 
            updatePointerEvents();
          };
          window.exitShapeEdit = function(){ 
            window.rnDraw.mode='idle'; 
            window.rnDraw.dragging=false; 
            window.rnDraw.selectedId=null; 
            updatePointerEvents();
            redraw(); 
          };
        }

        // removed krpano direct stage capture handlers to revert to overlay-driven input

        function resolveViewerElement(){
          if (window.rnDraw.viewerEl && document.body.contains(window.rnDraw.viewerEl)) return window.rnDraw.viewerEl;
          const selectors = ['#krpanoSWFObject', '#krpano', '#pano', '.krpano', 'object', 'embed'];
          for (const sel of selectors){
            const el = document.querySelector(sel);
            if (el){ window.rnDraw.viewerEl = el; return el; }
          }
          return null;
        }

        function resolveViewerCanvas(){
          if (window.rnDraw.viewerCanvas && document.body.contains(window.rnDraw.viewerCanvas)) return window.rnDraw.viewerCanvas;
          // Ưu tiên canvas bên trong viewerEl
          const root = resolveViewerElement();
          if (root){
            const c1 = root.querySelector && root.querySelector('canvas');
            if (c1){ window.rnDraw.viewerCanvas = c1; return c1; }
          }
          // Fallback: canvas toàn trang (krpano thường có 1 canvas lớn)
          const c2 = document.querySelector('canvas');
          if (c2){ window.rnDraw.viewerCanvas = c2; return c2; }
          return null;
        }

        function updateViewerRect(){
          const cvs = resolveViewerCanvas();
          if (!cvs) return;
          const r = cvs.getBoundingClientRect();
          window.rnDraw.viewerRect = { left: r.left, top: r.top, width: r.width, height: r.height };
          // Tỷ lệ stage pixel so với CSS pixel
          const sx = (cvs.width && r.width) ? (cvs.width / r.width) : 1;
          const sy = (cvs.height && r.height) ? (cvs.height / r.height) : 1;
          window.rnDraw.stageScaleX = sx;
          window.rnDraw.stageScaleY = sy;
        }

        function toCanvasXY(clientX, clientY){
          const rect = window.rnDraw.canvas.getBoundingClientRect();
          return { x: clientX - rect.left, y: clientY - rect.top };
        }

        function toViewerXY(clientX, clientY){
          updateViewerRect();
          const r = window.rnDraw.viewerRect;
          return { x: clientX - r.left, y: clientY - r.top };
        }

        function addPreviewPoint(x,y){
          window.rnDraw.points.push({x,y});
          redraw();
        }

        function undoLastPoint(){
          if (window.rnDraw.completed) return;
          window.rnDraw.points.pop();
          redraw();
        }

        function completePolygon(){
          const pts = window.rnDraw.points;
          if (pts.length < 3) return;
          window.rnDraw.completed = true;

          const id = 'poly_' + ((window.rnPolygonCounter||0)+1);
          window.rnPolygonCounter = (window.rnPolygonCounter||0)+1;
          const shape = { id, color: '#00FF00', points: pts.slice() };
          window.rnDraw.shapes.push(shape);
          window.rnDraw.selectedId = id;

          log('=== COMPLETE POLYGON START ===');
          log('id=' + id + ', points=' + pts.length);
          createKrpanoPolygon(id, shape.points);

          // chuyển sang idle để pano quay tự do ngay
          window.rnDraw.mode = 'idle';
          window.rnDraw.active = false;
          window.rnDraw.points = [];
          
          // Tắt pointerEvents để cho phép quay pano nhưng vẫn hiển thị overlay
          window.rnDraw.overlay.style.pointerEvents = 'none';
          window.rnDraw.canvas.style.pointerEvents = 'none';
          try { if (window.krpano) { window.krpano.call('set(layer[rn_draw_capture].enabled, false);'); } } catch(e){}

          redraw();
          log('=== COMPLETE POLYGON END ===');
        }

        function redraw(){
          const { ctx, canvas, points, completed, shapes, selectedId, mode } = window.rnDraw;
          ctx.clearRect(0,0,canvas.width,canvas.height);

          // Luôn hiển thị các shape đã vẽ như overlay (preview theo 3D) kể cả khi idle
          if (shapes.length > 0) {
            drawShapesAs3D(ctx, shapes, selectedId);
          }

          // Vẽ preview nếu đang vẽ
          if (!completed && points.length){
            drawPolyline(ctx, points, '#FF0000');
            points.forEach(p => drawPoint(ctx, p.x, p.y, '#FF0000'));
          }
        }

        function drawShapesAs3D(ctx, shapes, selectedId) {
          shapes.forEach(shape => {
            const isSelected = shape.id === selectedId;
            
            // Sử dụng tọa độ 3D đã lưu nếu có
            let screenPoints = shape.points; // fallback
            
            if (shape.spherePoints && typeof krpano !== 'undefined') {
              try {
                // Chuyển đổi tọa độ 3D sang 2D hiện tại với độ chính xác cao
                const cvs = resolveViewerCanvas();
                if (cvs) {
                  const rect = cvs.getBoundingClientRect();
                  const scaleX = cvs.width / rect.width;
                  const scaleY = cvs.height / rect.height;
                  
                  screenPoints = shape.spherePoints.map(spherePoint => {
                    if (typeof krpano.spheretoscreen === 'function') {
                      try {
                        const screen = krpano.spheretoscreen(spherePoint.ath, spherePoint.atv);
                        if (screen && isFinite(screen.x) && isFinite(screen.y)) {
                          // Chuyển từ stage coords sang CSS pixel
                          const cssX = (screen.x / scaleX) + rect.left;
                          const cssY = (screen.y / scaleY) + rect.top;
                          return { x: cssX, y: cssY };
                        }
                      } catch(e) {
                        log('spheretoscreen error for point: ' + e.message);
                      }
                    }
                    // Fallback: sử dụng tọa độ gốc
                    return shape.points[0];
                  });
                  
                  // Kiểm tra xem có điểm hợp lệ không
                  const validPoints = screenPoints.filter(p => p && isFinite(p.x) && isFinite(p.y));
                  if (validPoints.length >= 3) {
                    screenPoints = validPoints;
                  } else {
                    screenPoints = shape.points; // fallback về tọa độ gốc
                  }
                }
              } catch(e) {
                log('drawShapesAs3D error: ' + e.message);
                screenPoints = shape.points; // fallback
              }
            }

            // Vẽ polygon với perspective 3D
            drawPolygon3D(ctx, screenPoints, shape.color, isSelected);
          });
        }

        function drawPolygon3D(ctx, pts, color, highlighted) {
          if (pts.length < 3) return;
          
          // Vẽ với hiệu ứng 3D
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          // Vẽ outline
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
          ctx.stroke();
          
          // Vẽ fill với alpha thấp để thấy 3D
          ctx.fillStyle = color === '#00FF00' ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)';
          ctx.fill();
          
          // Highlight nếu được chọn
          if (highlighted) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.setLineDash([5,5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        function drawPoint(ctx, x, y, color){
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
        }

        function drawPolyline(ctx, pts, color){
          if (pts.length < 2) { if (pts[0]) drawPoint(ctx, pts[0].x, pts[0].y, color); return; }
          ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i=1;i<pts.length;i++){ ctx.lineTo(pts[i].x, pts[i].y); }
          ctx.stroke();
        }

        function drawPolygon(ctx, pts, color, highlighted){
          if (pts.length < 3) return;
          drawPolyline(ctx, pts, color);
          // close
          ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.moveTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.lineTo(pts[0].x, pts[0].y); ctx.stroke();
          // fill
          ctx.fillStyle = color === '#00FF00' ? 'rgba(0,255,0,0.25)' : 'rgba(255,0,0,0.25)';
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++){ ctx.lineTo(pts[i].x, pts[i].y);} ctx.closePath(); ctx.fill();
          // highlight khung
          if (highlighted){
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([6,6]); ctx.lineWidth = 1;
            const bb = bbox(pts); ctx.strokeRect(bb.x, bb.y, bb.w, bb.h); ctx.setLineDash([]);
          }
        }

        function bbox(pts){
          let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity; for(const p of pts){ x1=Math.min(x1,p.x); y1=Math.min(y1,p.y); x2=Math.max(x2,p.x); y2=Math.max(y2,p.y);} return {x:x1,y:y1,w:x2-x1,h:y2-y1};
        }

        function hitTestShapes(x,y){
          // Ưu tiên chọn shape chứa điểm (ray casting)
          for (let i=window.rnDraw.shapes.length-1; i>=0; i--){
            const s = window.rnDraw.shapes[i];
            if (pointInPolygon({x,y}, s.points)) return s.id;
          }
          return null;
        }

        function pointInPolygon(pt, pts){
          let inside = false; for (let i=0,j=pts.length-1; i<pts.length; j=i++){
            const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
            const intersect = ((yi>pt.y)!=(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi);
            if (intersect) inside = !inside;
          } return inside;
        }

        function getSelectedShape(){
          const id = window.rnDraw.selectedId; if (!id) return null;
          return window.rnDraw.shapes.find(s=>s.id===id) || null;
        }

        // === Krpano integration ===
        function resolveKrpano(){
          // Tìm instance Krpano
          if (typeof krpano !== 'undefined' && krpano.get && krpano.call) {
            log('resolveKrpano: found global krpano');
            return krpano;
          }
          
          // Tìm trong DOM
          const selectors = ['#krpanoSWFObject', '#krpano', '#pano', 'object', 'embed'];
          const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
          for (const node of nodes){
            const inst = node;
            if (inst && typeof inst.get === 'function' && typeof inst.call === 'function'){
              log('resolveKrpano: found DOM node id=' + (inst.id||'(no-id)'));
              return inst;
            }
          }
          return null;
        }

        function waitForKrpano(cb){
          let attempts = 0;
          const tryIt = ()=>{
            attempts++;
            const inst = resolveKrpano();
            if (inst){
              window.krpano = inst;
              log('waitForKrpano: ready after ' + attempts + ' attempts');
              cb();
            } else {
              if (attempts % 10 === 0){ log('waitForKrpano: still waiting (' + attempts + ')'); }
              setTimeout(tryIt, 100);
            }
          };
          tryIt();
        }

        function safeCall(cmd){ 
          try{ 
            krpano.call(cmd); 
            log('safeCall: ' + cmd);
          } catch(e){ 
            log('safeCall ERROR: ' + e.message + ' cmd:' + cmd); 
          } 
        }

        function sphereFromScreen(x, y){
          log('sphereFromScreen: trying x=' + x + ', y=' + y);
          
          // x,y hiện tại là toạ độ theo overlay-canvas. Quy đổi sang clientX/Y trước.
          const overlayRect = window.rnDraw.canvas.getBoundingClientRect();
          const clientX = x + overlayRect.left;
          const clientY = y + overlayRect.top;

          // Chuyển sang toạ độ theo viewer (CSS pixel bên trong viewer)
          const v = toViewerXY(clientX, clientY);

          // PHƯƠNG PHÁP 1: Sử dụng screentosphere trực tiếp với tọa độ stage chính xác
          try {
            if (typeof krpano.screentosphere === 'function') {
              // Lấy canvas thực của Krpano
              const cvs = resolveViewerCanvas();
              if (cvs) {
                // Tính tỷ lệ chính xác giữa CSS pixel và stage pixel
                const rect = cvs.getBoundingClientRect();
                const scaleX = cvs.width / rect.width;
                const scaleY = cvs.height / rect.height;
                
                // Chuyển từ CSS pixel sang stage pixel
                let stageX = (clientX - rect.left) * scaleX;
                let stageY = (clientY - rect.top) * scaleY;
                
                // Clamp vào vùng canvas hợp lệ
                stageX = Math.max(0, Math.min(stageX, cvs.width - 1));
                stageY = Math.max(0, Math.min(stageY, cvs.height - 1));
                
                log('sphereFromScreen: stage coords x=' + stageX + ', y=' + stageY + ' (canvas: ' + cvs.width + 'x' + cvs.height + ')');
                
                const sp = krpano.screentosphere(stageX, stageY);
                log('sphereFromScreen: screentosphere result ath=' + sp?.ath + ', atv=' + sp?.atv);
                
                if (sp && isFinite(sp.ath) && isFinite(sp.atv)) {
                  return sp;
                }
              }
            }
          } catch(e) {
            log('sphereFromScreen: screentosphere ERROR ' + e.message);
          }
          
          // PHƯƠNG PHÁP 2: Ray casting với tọa độ tương đối chính xác
          try {
            const view = krpano.get('view');
            log('sphereFromScreen: using ray casting calculation, view=' + JSON.stringify(view));
            
            // Lấy canvas rect của Krpano
            const cvs = resolveViewerCanvas();
            if (!cvs) {
              log('sphereFromScreen: cannot resolve viewer canvas for ray casting');
              return null;
            }
            
            const rect = cvs.getBoundingClientRect();
            
            // Tính toán tọa độ tương đối trong canvas (-1 đến +1)
            const nx = ((clientX - rect.left) / rect.width) * 2 - 1; // -1 (left) .. +1 (right)
            const ny = -((clientY - rect.top) / rect.height) * 2 + 1; // +1 (top) .. -1 (bottom)
            
            // Lấy thông tin góc nhìn hiện tại
            const hlookat = parseFloat(view.hlookat) || 0;
            const vlookat = parseFloat(view.vlookat) || 0;
            const fov = parseFloat(view.fov) || 90;
            const fovType = view.fovtype || 'MFOV';
            
            // Tính toán ath/atv dựa trên FOV và ray casting
            let ath, atv;
            
            if (fovType === 'MFOV' || fovType === 'HFOV') {
              // FOV theo chiều ngang - sử dụng ray casting chính xác
              ath = hlookat + (nx * fov * 0.5);
              
              // Tính atv dựa trên ray casting với perspective projection
              const fovRad = (fov * Math.PI) / 180;
              const hlookatRad = (hlookat * Math.PI) / 180;
              const vlookatRad = (vlookat * Math.PI) / 180;
              
              // Ray direction vector
              const rayX = Math.sin((ath * Math.PI) / 180);
              const rayY = Math.cos((ath * Math.PI) / 180);
              const rayZ = Math.tan((ny * fov * 0.5 * Math.PI) / 180);
              
              // Tính atv từ ray direction
              atv = Math.atan2(rayZ, Math.sqrt(rayX * rayX + rayY * rayY)) * 180 / Math.PI;
              atv = vlookat + atv;
              
            } else {
              // FOV theo chiều dọc hoặc diagonal
              ath = hlookat + (nx * fov * 0.5);
              atv = vlookat + (ny * fov * 0.5);
            }
            
            // Normalize ath về khoảng -180 đến +180
            ath = ((ath + 180) % 360) - 180;
            
            // Clamp atv về khoảng hợp lệ (-90 đến +90)
            atv = Math.max(-90, Math.min(90, atv));
            
            log('sphereFromScreen: ray casting result ath=' + ath + ', atv=' + atv);
            return { ath, atv };
            
          } catch(e) {
            log('sphereFromScreen: ray casting ERROR ' + e.message);
          }
          
          // PHƯƠNG PHÁP 3: Fallback với tọa độ tương đối đơn giản
          try {
            log('sphereFromScreen: using simple fallback calculation');
            
            // Sử dụng tọa độ tương đối từ góc nhìn hiện tại
            const view = krpano.get('view');
            const hlookat = parseFloat(view.hlookat) || 0;
            const vlookat = parseFloat(view.vlookat) || 0;
            
            // Tính offset tương đối từ center
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const offsetX = (clientX - centerX) / centerX; // -1 đến +1
            const offsetY = (clientY - centerY) / centerY; // -1 đến +1
            
            // Chuyển đổi sang ath/atv với offset nhỏ
            const ath = hlookat + (offsetX * 30); // offset tối đa 30 độ
            const atv = vlookat + (offsetY * 30); // offset tối đa 30 độ
            
            log('sphereFromScreen: fallback result ath=' + ath + ', atv=' + atv);
            return { ath, atv };
            
          } catch(e) {
            log('sphereFromScreen: all methods failed: ' + e.message);
          }
          
          return null;
        }
        
        function createKrpanoPolygon(id, pts){
          log('=== CREATE POLYGON START ===');
          log('id=' + id + ', points=' + pts.length);
          
          waitForKrpano(()=>{
            const name = id;
            
            // 1. Tạo hotspot theo cách chuẩn của Krpano
            log('1. Creating hotspot: ' + name);
            safeCall('addhotspot(' + name + ');');
            
            // 2. Cấu hình hotspot theo Krpano API
            log('2. Configuring hotspot');
            safeCall('set(hotspot[' + name + '].type, polygon);');
            safeCall('set(hotspot[' + name + '].renderer, webgl);');
            safeCall('set(hotspot[' + name + '].fillcolor, 0x00FF00);');
            safeCall('set(hotspot[' + name + '].fillalpha, 0.5);');
            safeCall('set(hotspot[' + name + '].bordercolor, 0x00FF00);');
            safeCall('set(hotspot[' + name + '].borderalpha, 1.0);');
            safeCall('set(hotspot[' + name + '].borderwidth, 2.0);');
            safeCall('set(hotspot[' + name + '].fill, true);');
            safeCall('set(hotspot[' + name + '].zorder, 1000);');
            safeCall('set(hotspot[' + name + '].visible, true);');
            safeCall('set(hotspot[' + name + '].enabled, false);');
            safeCall('set(hotspot[' + name + '].capture, false);');
            
            // 3. Thêm points theo cách chuẩn của Krpano
            log('3. Adding points to hotspot - starting with ' + pts.length + ' points');
            safeCall('hotspot[' + name + '].clearpoints();');
            
            const spherePoints = [];
            const debugInfo = [];
            
            pts.forEach((p, idx) => {
              log('Processing point ' + idx + ': screen(' + p.x + ',' + p.y + ')');
              
              // Lưu thông tin debug
              const debugPoint = {
                index: idx,
                screen: { x: p.x, y: p.y },
                client: null,
                viewer: null,
                stage: null,
                sphere: null
              };
              
              // Chuyển đổi tọa độ từng bước để debug
              const overlayRect = window.rnDraw.canvas.getBoundingClientRect();
              const clientX = p.x + overlayRect.left;
              const clientY = p.y + overlayRect.top;
              debugPoint.client = { x: clientX, y: clientY };
              
              const v = toViewerXY(clientX, clientY);
              debugPoint.viewer = { x: v.x, y: v.y };
              
              // Lấy canvas và tính stage coordinates
              const cvs = resolveViewerCanvas();
              if (cvs) {
                const rect = cvs.getBoundingClientRect();
                const scaleX = cvs.width / rect.width;
                const scaleY = cvs.height / rect.height;
                
                let stageX = (clientX - rect.left) * scaleX;
                let stageY = (clientY - rect.top) * scaleY;
                
                stageX = Math.max(0, Math.min(stageX, cvs.width - 1));
                stageY = Math.max(0, Math.min(stageY, cvs.height - 1));
                
                debugPoint.stage = { x: stageX, y: stageY, scaleX, scaleY };
              }
              
              // Chuyển đổi sang sphere coordinates
              const sp = sphereFromScreen(p.x, p.y);
              if (sp && isFinite(sp.ath) && isFinite(sp.atv)) {
                debugPoint.sphere = { ath: sp.ath, atv: sp.atv };
                
                log('Point ' + idx + ': final coordinates -> sphere(' + sp.ath + ',' + sp.atv + ')');
                const addCmd = 'hotspot[' + name + '].addpoint(' + sp.ath + ',' + sp.atv + ');';
                log('Point ' + idx + ': calling ' + addCmd);
                safeCall(addCmd);
                spherePoints.push({ ath: sp.ath, atv: sp.atv });
              } else {
                log('Point ' + idx + ': ERROR - invalid coordinates');
              }
              
              debugInfo.push(debugPoint);
            });
            
            // Lưu lại toạ độ cầu và thông tin debug
            const shape = window.rnDraw.shapes.find(s => s.id === id);
            if (shape) { 
              shape.spherePoints = spherePoints;
              shape.debugInfo = debugInfo;
              log('Saved debug info for shape: ' + JSON.stringify(debugInfo, null, 2));
            }

            // 4. Kiểm tra và log kết quả
            try {
              const pc = krpano.get('hotspot[' + name + '].pointcount');
              log('hotspot[' + name + '] pointcount=' + pc);
              
              // Thử lấy thông tin hotspot
              const hotspot = krpano.get('hotspot[' + name + ']');
              log('hotspot[' + name + '] info: type=' + hotspot.type + ', visible=' + hotspot.visible + ', enabled=' + hotspot.enabled);
              
              // Test: liệt kê tất cả hotspots
              const allHotspots = krpano.get('hotspot');
              log('Total hotspots: ' + (allHotspots ? allHotspots.length : 0));
              if (allHotspots) {
                for (let i = 0; i < allHotspots.length; i++) {
                  const h = allHotspots[i];
                  log('hotspot[' + i + ']: name=' + h.name + ', type=' + h.type + ', visible=' + h.visible);
                }
              }
            } catch(e) { 
              log('read hotspot info error: ' + e.message); 
            }
            
            log('=== CREATE POLYGON END ===');
          });
        }
        
        // helper debug: ẩn/hiện overlay
        window.debugToggleOverlay = function(show){
          if (!window.rnDraw || !window.rnDraw.overlay) return;
          window.rnDraw.overlay.style.display = show ? 'block' : 'none';
        };
        
        // helper debug: hiển thị thông tin tọa độ của shape
        window.debugShapeCoordinates = function(shapeId){
          if (!window.rnDraw || !window.rnDraw.shapes) return;
          const shape = window.rnDraw.shapes.find(s => s.id === shapeId);
          if (shape && shape.debugInfo) {
            console.log('=== DEBUG SHAPE COORDINATES ===');
            console.log('Shape ID:', shapeId);
            console.log('Debug Info:', JSON.stringify(shape.debugInfo, null, 2));
            console.log('Sphere Points:', shape.spherePoints);
            console.log('Screen Points:', shape.points);
            console.log('=== END DEBUG ===');
          } else {
            console.log('Shape not found or no debug info available');
          }
        };
        
        // helper debug: tạo polygon test với tọa độ cố định
        window.createTestPolygon = function(){
          log('=== CREATE TEST POLYGON START ===');
          waitForKrpano(()=>{
            const name = 'test_poly_' + Date.now();
            safeCall('addhotspot(' + name + ');');
            safeCall('set(hotspot[' + name + '].type, polygon);');
            safeCall('set(hotspot[' + name + '].fillcolor, 0xFF0000);');
            safeCall('set(hotspot[' + name + '].fillalpha, 0.5);');
            safeCall('set(hotspot[' + name + '].bordercolor, 0xFF0000);');
            safeCall('set(hotspot[' + name + '].borderalpha, 1.0);');
            safeCall('set(hotspot[' + name + '].borderwidth, 2.0);');
            safeCall('set(hotspot[' + name + '].fill, true);');
            safeCall('set(hotspot[' + name + '].visible, true);');
            safeCall('set(hotspot[' + name + '].enabled, false);');
            safeCall('hotspot[' + name + '].clearpoints();');
            
            // Tạo polygon hình vuông đơn giản ở center
            const view = krpano.get('view');
            const hlookat = parseFloat(view.hlookat) || 0;
            const vlookat = parseFloat(view.vlookat) || 0;
            
            // Tạo 4 điểm tạo thành hình vuông nhỏ
            const size = 10; // độ
            safeCall('hotspot[' + name + '].addpoint(' + (hlookat - size) + ',' + (vlookat - size) + ');');
            safeCall('hotspot[' + name + '].addpoint(' + (hlookat + size) + ',' + (vlookat - size) + ');');
            safeCall('hotspot[' + name + '].addpoint(' + (hlookat + size) + ',' + (vlookat + size) + ');');
            safeCall('hotspot[' + name + '].addpoint(' + (hlookat - size) + ',' + (vlookat + size) + ');');
            
            log('Created test polygon: ' + name + ' at center (h=' + hlookat + ', v=' + vlookat + ')');
            log('=== CREATE TEST POLYGON END ===');
          });
        };
        
        // helper debug: tạo polygon với tọa độ được tính toán lại từ shape hiện có
        window.recreatePolygonFromShape = function(shapeId){
          if (!window.rnDraw || !window.rnDraw.shapes) return;
          const shape = window.rnDraw.shapes.find(s => s.id === shapeId);
          if (!shape) {
            console.log('Shape not found:', shapeId);
            return;
          }
          
          log('=== RECREATE POLYGON FROM SHAPE START ===');
          log('Recreating polygon: ' + shapeId);
          
          waitForKrpano(()=>{
            // Xóa hotspot cũ
            safeCall('removehotspot(' + shapeId + ');');
            
            // Tạo hotspot mới
            const name = shapeId;
            safeCall('addhotspot(' + name + ');');
            safeCall('set(hotspot[' + name + '].type, polygon);');
            safeCall('set(hotspot[' + name + '].fillcolor, 0x00FF00);');
            safeCall('set(hotspot[' + name + '].fillalpha, 0.5);');
            safeCall('set(hotspot[' + name + '].bordercolor, 0x00FF00);');
            safeCall('set(hotspot[' + name + '].borderalpha, 1.0);');
            safeCall('set(hotspot[' + name + '].borderwidth, 2.0);');
            safeCall('set(hotspot[' + name + '].fill, true);');
            safeCall('set(hotspot[' + name + '].zorder, 1000);');
            safeCall('set(hotspot[' + name + '].visible, true);');
            safeCall('set(hotspot[' + name + '].enabled, false);');
            safeCall('set(hotspot[' + name + '].capture, false);');
            safeCall('hotspot[' + name + '].clearpoints();');
            
            // Sử dụng tọa độ sphere đã lưu nếu có
            if (shape.spherePoints && shape.spherePoints.length > 0) {
              log('Using saved sphere coordinates: ' + shape.spherePoints.length + ' points');
              shape.spherePoints.forEach((sp, idx) => {
                safeCall('hotspot[' + name + '].addpoint(' + sp.ath + ',' + sp.atv + ');');
                log('Added point ' + idx + ': ath=' + sp.ath + ', atv=' + sp.atv);
              });
            } else {
              // Tính toán lại từ tọa độ screen
              log('Recalculating from screen coordinates: ' + shape.points.length + ' points');
              shape.points.forEach((p, idx) => {
                const sp = sphereFromScreen(p.x, p.y);
                if (sp && isFinite(sp.ath) && isFinite(sp.atv)) {
                  safeCall('hotspot[' + name + '].addpoint(' + sp.ath + ',' + sp.atv + ');');
                  log('Recalculated point ' + idx + ': ath=' + sp.ath + ', atv=' + sp.atv);
                } else {
                  log('Failed to recalculate point ' + idx);
                }
              });
            }
            
            log('=== RECREATE POLYGON FROM SHAPE END ===');
          });
        };
        
        // helper test: tạo hotspot đơn giản để test theo Krpano API
        window.testHotspot = function(){
          log('=== TEST HOTSPOT START ===');
          safeCall('addhotspot(test_spot);');
          safeCall('set(hotspot[test_spot].type, spot);');
          safeCall('set(hotspot[test_spot].ath, 0);');
          safeCall('set(hotspot[test_spot].atv, 0);');
          safeCall('set(hotspot[test_spot].visible, true);');
          safeCall('set(hotspot[test_spot].enabled, true);');
          log('=== TEST HOTSPOT END ===');
        };
        
        // helper test: tạo polygon đơn giản theo Krpano API
        window.testPolygon = function(){
          log('=== TEST POLYGON START ===');
          safeCall('addhotspot(test_poly);');
          safeCall('set(hotspot[test_poly].type, polygon);');
          safeCall('set(hotspot[test_poly].fillcolor, 0xFF0000);');
          safeCall('set(hotspot[test_poly].fillalpha, 0.5);');
          safeCall('set(hotspot[test_poly].bordercolor, 0xFF0000);');
          safeCall('set(hotspot[test_poly].borderalpha, 1.0);');
          safeCall('set(hotspot[test_poly].borderwidth, 2.0);');
          safeCall('set(hotspot[test_poly].visible, true);');
          safeCall('set(hotspot[test_poly].enabled, false);');
          safeCall('hotspot[test_poly].clearpoints();');
          safeCall('hotspot[test_poly].addpoint(-10, 10);');
          safeCall('hotspot[test_poly].addpoint(10, 10);');
          safeCall('hotspot[test_poly].addpoint(10, -10);');
          safeCall('hotspot[test_poly].addpoint(-10, -10);');
          log('=== TEST POLYGON END ===');
        };
        
        function updateKrpanoPolygon(id, pts){
          log('=== UPDATE POLYGON START ===');
          log('id=' + id + ', points=' + pts.length);
          
          waitForKrpano(()=>{
            const name = id;
            safeCall('hotspot[' + name + '].clearpoints();');
            
            const spherePoints = [];
            pts.forEach((p, idx) => {
              log('Update point ' + idx + ': screen(' + p.x + ',' + p.y + ')');
              
              // Sử dụng cùng logic chuyển đổi tọa độ như createKrpanoPolygon
              const sp = sphereFromScreen(p.x, p.y);
              if (sp && isFinite(sp.ath) && isFinite(sp.atv)) {
                log('Update point ' + idx + ': final coordinates -> sphere(' + sp.ath + ',' + sp.atv + ')');
                safeCall('hotspot[' + name + '].addpoint(' + sp.ath + ',' + sp.atv + ');');
                spherePoints.push({ ath: sp.ath, atv: sp.atv });
              } else {
                log('Update point ' + idx + ': ERROR - invalid coordinates');
              }
            });
            
            const shape = window.rnDraw.shapes.find(s => s.id === id);
            if (shape) { shape.spherePoints = spherePoints; }

            log('=== UPDATE POLYGON END ===');
          });
        }
        
        function clearAll(){
          const d = window.rnDraw; if (!d) return;
          d.points = []; d.active = false; d.completed = true; // kết thúc phiên vẽ
          d.overlay && d.overlay.parentNode && d.overlay.parentNode.removeChild(d.overlay);
          log('overlay removed (shapes persisted in krpano)');
        }

        // Thiết lập lắng nghe thay đổi góc nhìn để redraw overlay khi đang edit
        waitForKrpano(() => {
          try {
            window.rnDraw.onViewChange = function(){
              redraw();
            };
            safeCall('set(events.keep, true);');
            safeCall('set(events.onviewchange, js(window.rnDraw && window.rnDraw.onViewChange && window.rnDraw.onViewChange()));');
            // Revert: không tạo layer capture; chỉ dùng overlay
            window.rnDraw.useKrpanoCapture = false;
            updatePointerEvents();
          } catch (e) { log('hook onviewchange error: ' + e.message); }
        });
      })();
    `;

    webViewRef.current?.injectJavaScript(script + '\ntrue;');
  };

  const clearDrawing = () => {
    const script = `
      if (window.clearDrawing) {
        window.clearDrawing();
      }
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  const onMessage = (event: any) => {
    const data = event.nativeEvent.data;
    console.log('Message from WebView:', data);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        onMessage={onMessage}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
      />
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackPress}
        activeOpacity={0.7}
      >
        <Text style={styles.iconText}>←</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.drawingButton,
          isDrawingMode && styles.drawingButtonActive
        ]}
        onPress={toggleDrawingMode}
        activeOpacity={0.7}
      >
        <Text style={[styles.iconText, isDrawingMode && styles.iconTextActive]}>
          {isDrawingMode ? '✓' : '✏️'}
        </Text>
      </TouchableOpacity>

      {isDrawingMode && (
        <TouchableOpacity
          style={styles.undoButton}
          onPress={undoLastPoint}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>↻</Text>
        </TouchableOpacity>
      )}

      {!isDrawingMode && (
        <TouchableOpacity
          style={[
            styles.editButton,
            isEditMode && styles.editButtonActive
          ]}
          onPress={() => toggleEditMode()}
          activeOpacity={0.7}
        >
          <Text style={[styles.iconText, isEditMode && styles.iconTextActive]}>
            {isEditMode ? '✓' : '✏️'}
          </Text>
        </TouchableOpacity>
      )}

      {showInstructions && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Chạm vào màn hình để thêm điểm{'\n'}
            Chạm vào điểm đầu tiên để hoàn thành
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawingButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawingButtonActive: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  undoButton: {
    position: 'absolute',
    top: 110,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editButton: {
    position: 'absolute',
    top: 110,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editButtonActive: {
    backgroundColor: 'rgba(0, 255, 0, 0.8)',
  },
  iconText: {
    fontSize: 24,
    color: '#000000',
    fontWeight: 'bold',
  },
  iconTextActive: {
    color: '#FFFFFF',
  },
  instructionsContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    zIndex: 1000,
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default KrpanoScreen; 