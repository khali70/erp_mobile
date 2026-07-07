import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { InventoryItem } from '@/features/inventory/types';
import { useBarcodeScan } from '../hooks/useBarcodeScan';

// Restrict to the retail formats we expect — fewer types = faster decode and
// far fewer false reads than scanning every symbology.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

interface ScanPaneProps {
  items: InventoryItem[];
  /** Add/bump the scanned item; returns the resulting qty for the feedback strip. */
  onScanItem: (item: InventoryItem) => number;
  onClose: () => void;
  /** Decode with no catalog match → let the user add it by hand. */
  onManualAdd: () => void;
}

/**
 * Inline live barcode scanner. Camera mounts only while this is rendered
 * (parent gates it behind a toggle) so there is zero idle battery/permission
 * cost. Continuous scan: each decode adds/bumps a line and the camera stays up.
 */
export function ScanPane({ items, onScanItem, onClose, onManualAdd }: ScanPaneProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const { feedback, handleScan } = useBarcodeScan({ items, onHit: onScanItem });

  // Ask once on mount if the choice hasn't been made yet.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const CloseBtn = (
    <Pressable
      className={`${ROW} items-center gap-1.5 self-center bg-surface px-3.5 py-2 rounded-xl border border-border`}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={t('documents.scanner.close')}
    >
      <Feather name="x" size={16} color={colors.muted} />
      <Text className="text-muted text-xs font-bold">{t('documents.scanner.close')}</Text>
    </Pressable>
  );

  // Permission not yet resolved.
  if (!permission) {
    return <View className="bg-surface rounded-2xl p-6 border border-border h-64" />;
  }

  // Denied — never leave a dead form; explain and offer the way back.
  if (!permission.granted) {
    return (
      <View className="bg-surface rounded-2xl p-6 border border-border items-center gap-3">
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
            <Text className="text-white text-xs font-bold">{t('documents.scanner.permGrant')}</Text>
          </Pressable>
        )}
        {CloseBtn}
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      <View className="rounded-2xl overflow-hidden border border-primary/30 h-64 bg-black">
        <CameraView
          style={{ flex: 1 }}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        />
        {/* Aim frame */}
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View className="w-3/4 h-24 rounded-xl border-2 border-white/80" />
        </View>
        {/* Top bar: torch + close over the preview */}
        <View className={`${ROW} absolute top-2.5 left-2.5 right-2.5 items-center justify-between`}>
          <Pressable
            className="bg-black/50 p-2.5 rounded-full"
            onPress={() => setTorch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('documents.scanner.torch')}
          >
            <Feather name="zap" size={16} color={torch ? colors.warning : colors.surface} />
          </Pressable>
          <Pressable
            className="bg-black/50 p-2.5 rounded-full"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('documents.scanner.close')}
          >
            <Feather name="x" size={16} color={colors.surface} />
          </Pressable>
        </View>
        {/* Hint */}
        <View className="absolute bottom-2.5 left-2.5 right-2.5 items-center pointer-events-none">
          <Text className="text-white/90 text-xs font-semibold bg-black/50 px-2.5 py-1 rounded-lg">
            {t('documents.scanner.title')}
          </Text>
        </View>
      </View>

      {/* Feedback strip — non-blocking, replaces an Alert that would kill the camera. */}
      {feedback?.kind === 'hit' && (
        <View className={`${ROW} items-center justify-center gap-2 bg-primary-light rounded-xl px-3 py-2`}>
          <Feather name="check-circle" size={15} color={colors.primary} />
          <Text className="text-primary text-xs font-bold">
            {feedback.qty > 1
              ? t('documents.scanner.qtyBumped', { name: feedback.name, qty: feedback.qty })
              : t('documents.scanner.added', { name: feedback.name })}
          </Text>
        </View>
      )}
      {feedback?.kind === 'miss' && (
        <Pressable
          className={`${ROW} items-center justify-between gap-2 bg-warning-light rounded-xl px-3 py-2`}
          onPress={onManualAdd}
          accessibilityRole="button"
        >
          <Text className="text-primary text-xs font-extrabold">
            {t('documents.scanner.noMatchAction')}
          </Text>
          <View className={`${ROW} items-center gap-1.5 flex-1`}>
            <Text className="text-warning-dark text-xs font-bold text-right flex-1" numberOfLines={1}>
              {t('documents.scanner.noMatch', { code: feedback.code })}
            </Text>
            <Feather name="alert-circle" size={15} color={colors.warning} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
