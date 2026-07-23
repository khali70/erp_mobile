import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

interface DialogProps {
  visible: boolean;
  /**
   * Omit to make the dialog NON-DISMISSIBLE: no backdrop tap, no Android back
   * button. For a step that must not be interrupted (a database being replaced)
   * or a state the owner must read before moving on.
   */
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  /** Extra classes on the dialog surface. */
  className?: string;
}

/**
 * Centred modal dialog — the counterpart to BottomSheet for short, decisive
 * interactions (confirm, progress, result) rather than long pickable lists.
 *
 * `onRequestClose` is always supplied: on Android, omitting it lets the hardware
 * back button dismiss the Modal natively, which is exactly what a blocking
 * progress dialog must not allow. When `onClose` is absent it is a deliberate
 * no-op, so back does nothing.
 */
export function Dialog({ visible, onClose, children, className = '' }: DialogProps) {
  const dismissible = typeof onClose === 'function';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onClose?.()}
    >
      <Pressable
        className="flex-1 bg-black/50 items-center justify-center px-6"
        onPress={dismissible ? onClose : undefined}
        accessibilityElementsHidden={!dismissible}
      >
        <Pressable
          className={`w-full bg-surface rounded-3xl p-5 ${className}`}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="gap-3">{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
