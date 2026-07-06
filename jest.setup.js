// Global test setup. Kept minimal — pure-logic tests need no RN mocks.
// expo-crypto.randomUUID is used by src/utils/id.ts; provide a deterministic-ish
// stub so id-dependent tests don't require the native module.
jest.mock('expo-crypto', () => {
  let n = 0;
  return {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
});
