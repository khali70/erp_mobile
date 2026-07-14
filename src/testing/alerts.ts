// Alert capture for hook tests.
//
// A hook in this app REFUSES by calling `Alert.alert(...)` — the refusal is the
// behaviour, so a test that cannot read the alert cannot assert the refusal.
// `Alert.alert` is replaced with a recorder (no jest globals here, so this file
// typechecks under the app tsconfig) and the captured calls are read back.
//
// The buttons matter as much as the text: the below-cost confirm and the "تم
// الحفظ" OK button are how the flows CONTINUE, so tests must be able to press
// them.
import { Alert, type AlertButton } from 'react-native';

export interface CapturedAlert {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

const captured: CapturedAlert[] = [];

/** Swap Alert.alert for a recorder. Called once per test file, from jest setup. */
export function captureAlerts(): void {
  Alert.alert = ((title: string, message?: string, buttons?: AlertButton[]) => {
    captured.push({ title, message, buttons });
  }) as typeof Alert.alert;
}

export function resetAlerts(): void {
  captured.length = 0;
}

export function alerts(): CapturedAlert[] {
  return captured;
}

export function alertCount(): number {
  return captured.length;
}

export function lastAlert(): CapturedAlert | undefined {
  return captured[captured.length - 1];
}

/** Press a button on the most recent alert, by its rendered label. */
export function pressAlertButton(label: string): void {
  const alert = lastAlert();
  const button = alert?.buttons?.find((b) => b.text === label);
  if (!button) {
    throw new Error(
      `No alert button labelled "${label}". Last alert: ${JSON.stringify(alert ?? null)}`,
    );
  }
  button.onPress?.();
}
