import type { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes on the sheet surface (padding, overflow, etc). */
  className?: string;
}

/**
 * Slide-up bottom sheet: dim backdrop, tap-outside to close. `min-h-[70%]` keeps
 * the sheet taller than the keyboard so its search box / inputs stay visible
 * above it (no KeyboardAvoidingView — native slide only); capped at `max-h-[88%]`.
 */
export function BottomSheet({ visible, onClose, children, className = '' }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable
          className={`bg-surface rounded-t-3xl min-h-[70%] max-h-[88%] ${className}`}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
