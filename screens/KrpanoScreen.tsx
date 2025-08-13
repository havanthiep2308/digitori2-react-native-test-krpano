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
                // Chuyển đổi tọa độ 3D sang 2D hiện tại
                const r = window.rnDraw.viewerRect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
                const scaleX = window.rnDraw.stageScaleX || 1;
                const scaleY = window.rnDraw.stageScaleY || 1;
                screenPoints = shape.spherePoints.map(spherePoint => {
                  if (typeof krpano.spheretoscreen === 'function') {
                    const screen = krpano.spheretoscreen(spherePoint.ath, spherePoint.atv);
                    // stage coords -> CSS pixel theo canvas rect
                    const cssX = (screen.x || 0) / (scaleX || 1) + r.left;
                    const cssY = (screen.y || 0) / (scaleY || 1) + r.top;
                    return { x: cssX, y: cssY };
                  }
                  return shape.points[0]; // fallback
                });
              } catch(e) {
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

          // Thử dùng screentosphere trước
          try {
            if (typeof krpano.screentosphere === 'function') {
              // chuyển từ CSS pixel (viewer) sang stage coord dựa trên kích thước canvas thực
              const r = window.rnDraw.viewerRect.width > 0 ? window.rnDraw.viewerRect : { left:0, top:0, width: window.innerWidth, height: window.innerHeight };
              const scaleX = window.rnDraw.stageScaleX || 1;
              const scaleY = window.rnDraw.stageScaleY || 1;
              let stageX = v.x * (scaleX || 1);
              let stageY = v.y * (scaleY || 1);
              // Clamp vào vùng canvas
              const cvs = window.rnDraw.viewerCanvas;
              if (cvs){
                stageX = Math.max(0, Math.min(stageX, cvs.width));
                stageY = Math.max(0, Math.min(stageY, cvs.height));
              }
              const sp = krpano.screentosphere(stageX, stageY);
              log('sphereFromScreen: screentosphere result ath=' + sp?.ath + ', atv=' + sp?.atv);
              if (sp && isFinite(sp.ath) && isFinite(sp.atv) && sp.ath !== 0 && sp.atv !== 0) {
                return sp;
              }
            }
          } catch(e) {
            log('sphereFromScreen: screentosphere ERROR ' + e.message);
          }
          
          // Fallback: tính tương đối từ góc nhìn hiện tại
          try {
            const view = krpano.get('view');
            log('sphereFromScreen: using fallback, view=' + JSON.stringify(view));
            
            const r = window.rnDraw.viewerRect.width > 0 ? window.rnDraw.viewerRect : { left:0, top:0, width: window.innerWidth, height: window.innerHeight };
            const nx = (v.x / r.width) * 2 - 1; // -1 (left) .. +1 (right)
            const ny = (v.y / r.height) * 2 - 1; // -1 (top) .. +1 (bottom)
            
            // Tính offset từ góc nhìn hiện tại
            const hlookat = view.hlookat || 0;
            const vlookat = view.vlookat || 0;
            const fov = view.fov || 90;
            
            // Chuyển đổi sang ath/atv tương đối
            const ath = hlookat + (nx * fov * 0.5);
            const atv = vlookat + (ny * fov * 0.5) * -1; // đảo chiều để top là atv âm
            
            log('sphereFromScreen: fallback result ath=' + ath + ', atv=' + atv);
            return { ath, atv };
          } catch(e) {
            log('sphereFromScreen: fallback ERROR ' + e.message);
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
            safeCall('set(hotspot[' + name + '].zorder, 1000);');
            safeCall('set(hotspot[' + name + '].visible, true);');
            safeCall('set(hotspot[' + name + '].enabled, false);');
            safeCall('set(hotspot[' + name + '].capture, false);');
            
            // 3. Thêm points theo cách chuẩn của Krpano
            log('3. Adding points to hotspot - starting with ' + pts.length + ' points');
            safeCall('hotspot[' + name + '].clearpoints();');
            
            const spherePoints = [];
            pts.forEach((p, idx) => {
              log('Processing point ' + idx + ': screen(' + p.x + ',' + p.y + ')');
              
              // Nếu có sx/sy (stage), dùng trực tiếp để đổi sang sphere
              let sp = null;
              if (typeof p.sx === 'number' && typeof p.sy === 'number'){
                try { sp = krpano.screentosphere(p.sx, p.sy); } catch(e) {}
              }
              if (!sp){ sp = sphereFromScreen(p.x, p.y); }
              if (sp && isFinite(sp.ath) && isFinite(sp.atv)) {
                log('Point ' + idx + ': final coordinates -> sphere(' + sp.ath + ',' + sp.atv + ')');
                // Dùng cách chuẩn của Krpano: addpoint với ath,atv
                const addCmd = 'hotspot[' + name + '].addpoint(' + sp.ath + ',' + sp.atv + ');';
                log('Point ' + idx + ': calling ' + addCmd);
                safeCall(addCmd);
                spherePoints.push({ ath: sp.ath, atv: sp.atv });
              } else {
                log('Point ' + idx + ': ERROR - invalid coordinates');
              }
            });
            
            // Lưu lại toạ độ cầu để vẽ preview theo view hiện tại khi ở edit mode
            const shape = window.rnDraw.shapes.find(s => s.id === id);
            if (shape) { shape.spherePoints = spherePoints; }

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
              let ath, atv;
              let sp = sphereFromScreen(p.x, p.y);
              if (sp){ ath = sp.ath; atv = sp.atv; }
              else {
                // Fallback cũng phải tính từ overlay-canvas -> client -> viewer -> stage
                try {
                  const overlayRect = window.rnDraw.canvas.getBoundingClientRect();
                  const clientX = p.x + overlayRect.left;
                  const clientY = p.y + overlayRect.top;
                  const v = toViewerXY(clientX, clientY);
                  const scaleX = window.rnDraw.stageScaleX || 1;
                  const scaleY = window.rnDraw.stageScaleY || 1;
                  const stageX = v.x * (scaleX || 1);
                  const stageY = v.y * (scaleY || 1);
                  const sp2 = krpano.screentosphere(stageX, stageY);
                  if (sp2){ ath = sp2.ath; atv = sp2.atv; }
                } catch(e) {}
              }
              if (!isFinite(ath) || !isFinite(atv)){
                const view = krpano.get('view');
                const overlayRect = window.rnDraw.canvas.getBoundingClientRect();
                const clientX = p.x + overlayRect.left;
                const clientY = p.y + overlayRect.top;
                const r = window.rnDraw.viewerRect.width > 0 ? window.rnDraw.viewerRect : { width: window.innerWidth, height: window.innerHeight };
                const nx = ((clientX - r.left) / r.width) * 2 - 1;
                const ny = -((clientY - r.top) / r.height) * 2 + 1;
                ath = view.hlookat + (nx * (view.fov || 90) * 0.5);
                atv = view.vlookat + (ny * (view.fov || 90) * 0.5);
              }
              safeCall('hotspot[' + name + '].addpoint(' + ath + ',' + atv + ');');
              spherePoints.push({ ath, atv });
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