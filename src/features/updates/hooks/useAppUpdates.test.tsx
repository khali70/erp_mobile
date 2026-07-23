/**
 * The OTA state machine — proven WITHOUT a device, against a mocked expo-updates.
 *
 * The three things that must hold no matter what:
 *   • when `Updates.isEnabled` is false (dev / Expo Go), every action is an inert
 *     no-op that lands on `unavailable` and NEVER throws;
 *   • a check that finds nothing lands on `upToDate` and records the check time;
 *   • a check that finds an update downloads it and raises the "restart" prompt.
 *
 * expo-updates is the only thing mocked — a mutable module object so a test can
 * flip `isEnabled` or hand back a different `checkForUpdateAsync` result and the
 * hook's real branching runs against it.
 */
import { renderHook, act } from '@testing-library/react-native';
import * as Updates from 'expo-updates';

// The factory is INLINE (no out-of-scope reference): a hoisted `jest.mock` whose
// factory reads a `const` would hit that const's TDZ at require time and silently
// fall back to the real module. `__esModule: true` keeps `import * as Updates`
// from re-wrapping the object, so `Updates` IS the mock and mutating it here is
// what the hook reads.
jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  updateId: 'abcdef0123456789',
  channel: 'production',
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
  useUpdates: () => ({ isUpdatePending: false }),
}));

const mockUpdates = Updates as unknown as {
  isEnabled: boolean;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
};

import { useAppUpdates } from './useAppUpdates';

beforeEach(() => {
  mockUpdates.isEnabled = true;
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
});

describe('useAppUpdates — the OTA state machine', () => {
  it('is inert in dev / Expo Go: check() no-ops to "unavailable" and never throws', async () => {
    mockUpdates.isEnabled = false;
    const { result } = await renderHook(() => useAppUpdates());

    expect(result.current.status).toBe('unavailable');
    expect(result.current.isEnabled).toBe(false);

    await act(async () => {
      await result.current.check();
      await result.current.restart();
    });

    expect(result.current.status).toBe('unavailable');
    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });

  it('no update available → "upToDate", and the check time is recorded', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    const { result } = await renderHook(() => useAppUpdates());

    await act(async () => {
      await result.current.check();
    });

    expect(result.current.status).toBe('upToDate');
    expect(result.current.lastCheckedAt).not.toBeNull();
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(result.current.promptVisible).toBe(false);
  });

  it('update available → downloads it and raises the restart prompt', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    const { result } = await renderHook(() => useAppUpdates());

    await act(async () => {
      await result.current.check();
    });

    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('readyToReload');
    expect(result.current.promptVisible).toBe(true);
  });

  it('a rapid double-check is idempotent: only one network round-trip', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    const { result } = await renderHook(() => useAppUpdates());

    await act(async () => {
      await Promise.all([result.current.check(), result.current.check()]);
    });

    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('a failed check lands on "error" with a message, not a throw', async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useAppUpdates());

    await act(async () => {
      await result.current.check();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('offline');
  });

  it('restart applies the update by reloading', async () => {
    const { result } = await renderHook(() => useAppUpdates());

    await act(async () => {
      await result.current.restart();
    });

    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });
});
