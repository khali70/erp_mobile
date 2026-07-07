import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

// Same retail formats as the documents scanner — fewer types = faster, safer decode.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

interface BarcodeScanModalProps {
  visible: boolean;
  onClose: () => void;
  /** Fires once per open with the decoded code, then the modal closes. */
  onScanned: (code: string) => void;
}

/**
 * One-shot barcode capture for the item form. Camera mounts only while open;
 * first decode returns the code and dismisses. Permission strings are shared
 * with the documents scanner.
 */
export function BarcodeScanModal({ visible, onClose, onScanned }: BarcodeScanModalProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  // Guard against the camera firing multiple decodes before unmount.
  const locked = useRef(false);

  useEffect(() => {
    if (visible) locked.current = false;
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScan = (data: string) => {
    if (locked.current) return;
    locked.current = true;
    onScanned(data);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-4">
        <View className="bg-surface rounded-3xl overflow-hidden">
          <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
            <View className={`${ROW} items-center gap-2`}>
              <Feather name="maximize" size={18} color={colors['primary-200']} />
              <Text className="text-white font-bold text-base">{t('inventory.form.scan')}</Text>
            </View>
            <Pressable
              className="w-8 h-8 rounded-full items-center justify-center bg-white/20"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('documents.scanner.close')}
            >
              <Feather name="x" size={16} color={colors.surface} />
            </Pressable>
          </View>

          <View className="p-5">
            {!permission ? (
              <View className="h-64 rounded-2xl bg-black/5" />
            ) : !permission.granted ? (
              <View className="items-center gap-3 py-6">
                <Feather name="camera-off" size={36} color={colors['slate-400']} />
                <Text className="text-ink text-sm font-extrabold text-center">
                  {t('documents.scanner.permTitle')}
                </Text>
                <Text className="text-muted text-xs text-center">
                  {permission.canAskAgain
                    ? t('documents.scanner.permBody')
                    : t('documents.scanner.permDenied')}
                </Text>
                {permission.canAskAgain && (
                  <Pressable
                    className="bg-primary px-4 py-2.5 rounded-xl"
                    onPress={() => void requestPermission()}
                    accessibilityRole="button"
                  >
                    <Text className="text-white text-xs font-bold">
                      {t('documents.scanner.permGrant')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View className="rounded-2xl overflow-hidden border border-primary/30 h-64 bg-black">
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                  onBarcodeScanned={({ data }) => handleScan(data)}
                />
                <View className="absolute inset-0 items-center justify-center pointer-events-none">
                  <View className="w-3/4 h-24 rounded-xl border-2 border-white/80" />
                </View>
                <View className="absolute bottom-2.5 left-2.5 right-2.5 items-center pointer-events-none">
                  <Text className="text-white/90 text-xs font-semibold bg-black/50 px-2.5 py-1 rounded-lg">
                    {t('documents.scanner.title')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
