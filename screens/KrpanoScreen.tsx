import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { injectDrawingScript, toggleDrawingMode as toggleDrawingModeUtil, toggleFreehandMode, toggleEditMode as toggleEditModeUtil, toggleMoveMode as toggleMoveModeUtil, undoLastPoint as undoLastPointUtil, clearDrawing as clearDrawingUtil } from '../src/utils/krpanoDrawingUtils';

const KrpanoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { url } = route.params as { url: string };
  
  const webViewRef = useRef<WebView>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFreehandMode, setIsFreehandMode] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{x: number, y: number}>>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleToggleDrawingMode = () => {
    if (isEditMode) {
      // tắt edit trước khi vẽ
      handleToggleEditMode(false);
    }
    if (isFreehandMode) {
      // tắt freehand trước khi vẽ polygon
      setIsFreehandMode(false);
    }
    
    const newDrawingMode = !isDrawingMode;
    setIsDrawingMode(newDrawingMode);
    
    if (newDrawingMode) {
      // Bắt đầu chế độ vẽ
      setDrawingPoints([]);
      setShowInstructions(true);
      
      // Đảm bảo script được inject trước khi kích hoạt chế độ vẽ
      injectDrawingScript(webViewRef);
      
      // Đợi một chút để script được inject hoàn tất
      setTimeout(() => {
        toggleDrawingModeUtil(webViewRef);
        console.log('Drawing mode activated');
        // Đảm bảo sự kiện click được truyền đúng cách từ WebView đến overlay
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              document.addEventListener('click', function(e) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({type: 'click', x: e.clientX, y: e.clientY}));
                }
              }, true);
            `);
          }
      }, 500);
      
      setTimeout(() => {
        setShowInstructions(false);
      }, 5000);
    } else {
      // Thoát chế độ vẽ: chỉ tắt tương tác, KHÔNG xoá hình
      toggleEditModeUtil(webViewRef, false);
      setShowInstructions(false);
    }
  };

  const handleToggleFreehandMode = () => {
    if (isEditMode) {
      // tắt edit trước khi vẽ
      handleToggleEditMode(false);
    }
    if (isDrawingMode) {
      // tắt polygon trước khi vẽ tự do
      setIsDrawingMode(false);
    }
    
    const newFreehandMode = !isFreehandMode;
    setIsFreehandMode(newFreehandMode);
    
    if (newFreehandMode) {
      // Bắt đầu chế độ vẽ tự do
      setDrawingPoints([]);
      setShowInstructions(true);
      
      // Đảm bảo script được inject trước khi kích hoạt chế độ vẽ tự do
      injectDrawingScript(webViewRef);
      
      // Đợi một chút để script được inject hoàn tất
      setTimeout(() => {
        toggleFreehandMode(webViewRef);
        console.log('Freehand mode activated');
      }, 500);
      
      setTimeout(() => {
        setShowInstructions(false);
      }, 5000);
    } else {
      // Thoát chế độ vẽ tự do: chỉ tắt tương tác, KHÔNG xoá hình
      toggleEditModeUtil(webViewRef, false);
      setShowInstructions(false);
    }
  };

  const handleToggleEditMode = (forceValue?: boolean) => {
    const next = forceValue !== undefined ? forceValue : !isEditMode;
    setIsEditMode(next);
    if (next) {
      if (isDrawingMode) setIsDrawingMode(false);
      if (isFreehandMode) setIsFreehandMode(false);
      if (isMoveMode) setIsMoveMode(false);
    }
    toggleEditModeUtil(webViewRef, next);
  };

  const handleToggleMoveMode = (forceValue?: boolean) => {
    const next = forceValue !== undefined ? forceValue : !isMoveMode;
    setIsMoveMode(next);
    if (next) {
      if (isDrawingMode) setIsDrawingMode(false);
      if (isFreehandMode) setIsFreehandMode(false);
      if (isEditMode) setIsEditMode(false);
    }
    toggleMoveModeUtil(webViewRef, next);
  };

  const handleUndoLastPoint = () => {
    undoLastPointUtil(webViewRef);
  };

  const injectJavaScript = () => {
    injectDrawingScript(webViewRef);
  };

  const onMessage = (event: any) => {
    const data = event.nativeEvent.data;
    console.log('Message from WebView:', data);
  };

  const clearDrawing = () => {
    clearDrawingUtil(webViewRef);
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
          // Inject drawing script khi WebView đã load xong
          injectDrawingScript(webViewRef);
        }}
        // Thêm các thuộc tính để đảm bảo WebView xử lý sự kiện đúng cách
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        mixedContentMode="always"
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
        onPress={() => handleToggleDrawingMode()}
        activeOpacity={0.7}
      >
        <Text style={[styles.iconText, isDrawingMode && styles.iconTextActive]}>
          {isDrawingMode ? '✓' : '✏️'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.freehandButton,
          isFreehandMode && styles.freehandButtonActive
        ]}
        onPress={handleToggleFreehandMode}
        activeOpacity={0.7}
      >
        <Text style={[styles.iconText, isFreehandMode && styles.iconTextActive]}>
          {isFreehandMode ? '✓' : '✎'}
        </Text>
      </TouchableOpacity>

      {(isDrawingMode || isFreehandMode) && (
        <>
          <TouchableOpacity
            style={styles.undoButton}
            onPress={handleUndoLastPoint}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>↩️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearDrawing}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>🗑️</Text>
          </TouchableOpacity>
        </>
      )}

      {!isDrawingMode && !isFreehandMode && (
        <>
          <TouchableOpacity
            style={[
              styles.editButton,
              isEditMode && styles.editButtonActive
            ]}
            onPress={() => handleToggleEditMode()}
            activeOpacity={0.7}
          >
            <Text style={[styles.iconText, isEditMode && styles.iconTextActive]}>
              {isEditMode ? '✓' : '✏️'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.moveButton,
              isMoveMode && styles.moveButtonActive
            ]}
            onPress={() => handleToggleMoveMode()}
            activeOpacity={0.7}
          >
            <Text style={[styles.iconText, isMoveMode && styles.iconTextActive]}>
              {isMoveMode ? '✓' : '↔️'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {showInstructions && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {isFreehandMode ? 
              "Chạm và kéo để vẽ tự do\nThả ra để hoàn thành" : 
              isDrawingMode ? 
                "Chạm vào màn hình để thêm điểm\nChạm vào điểm đầu tiên để hoàn thành" :
                isMoveMode ? 
                  "Chạm vào hình vẽ để di chuyển\nKéo để di chuyển trong không gian 3D" :
                  "Chạm vào hình vẽ để chỉnh sửa\nKéo để thay đổi hình dạng"
            }
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
    backgroundColor: 'rgba(0, 255, 0, 0.8)',
  },
  freehandButton: {
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
  freehandButtonActive: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  undoButton: {
    position: 'absolute',
    top: 170,
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
  clearButton: {
    position: 'absolute',
    top: 230,
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
  moveButton: {
    position: 'absolute',
    top: 170,
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
  moveButtonActive: {
    backgroundColor: 'rgba(0, 0, 255, 0.8)',
  },
});

export default KrpanoScreen;