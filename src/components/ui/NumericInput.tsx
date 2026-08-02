import { useState } from 'react';
import { TextInput, type KeyboardTypeOptions } from 'react-native';
import { evaluateNumeric, hasMathOperator } from '@/utils/mathInput';

interface NumericInputProps {
  value: string;
  onChangeText: (text: string) => void;
  className?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  onFocus?: () => void;
  selectTextOnFocus?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
}

/**
 * TextInput that resolves quick-math (`*`, `/`) on blur.
 *
 * While focused it holds its own raw text buffer, so a `*`/`/` expression — and a
 * half-typed `12.` or `50*` — survives keystroke-by-keystroke even when the parent
 * stores a PARSED NUMBER and feeds back `String(n)` (as DocLineRow does). Each
 * keystroke still forwards to `onChangeText` so live totals keep updating; the
 * value only becomes exact on blur, when the expression is evaluated and committed.
 *
 * Not focused → the controlled `value` shows through unchanged. Invalid input is
 * left untouched; the downstream parser falls back to 0 exactly as before.
 */
export function NumericInput({
  value,
  onChangeText,
  keyboardType = 'decimal-pad',
  onFocus,
  ...rest
}: NumericInputProps) {
  // null = not editing (show controlled `value`); string = live edit buffer.
  const [buffer, setBuffer] = useState<string | null>(null);

  const commit = () => {
    const raw = buffer ?? value;
    if (hasMathOperator(raw)) {
      const result = evaluateNumeric(raw);
      if (Number.isFinite(result)) onChangeText(String(result));
    }
    setBuffer(null);
  };

  return (
    <TextInput
      {...rest}
      value={buffer ?? value}
      keyboardType="default"
      onFocus={() => {
        setBuffer(value);
        onFocus?.();
      }}
      onChangeText={(t) => {
        setBuffer(t);
        onChangeText(t);
      }}
      onBlur={commit}
    />
  );
}
