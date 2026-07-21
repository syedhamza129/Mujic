import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let _toastCallback: ((text: string, type?: 'success' | 'error' | 'info') => void) | null = null;

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  _toastCallback?.(text, type);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const counter = useRef(0);

  const show = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++counter.current;
    setToast({ id, text, type });
  }, []);

  useEffect(() => {
    _toastCallback = show;
    return () => { _toastCallback = null; };
  }, [show]);

  useEffect(() => {
    if (!toast) return;

    opacity.setValue(0);
    translateY.setValue(-30);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 300, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 2200);

    return () => clearTimeout(timer);
  }, [toast?.id]);

  const bgColor = toast?.type === 'error' ? Colors.error
    : toast?.type === 'info' ? Colors.accent
    : Colors.success;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: bgColor, opacity, transform: [{ translateY }] },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
