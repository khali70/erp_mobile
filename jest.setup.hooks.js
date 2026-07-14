/**
 * Setup for the `hooks` project (jest-expo + @testing-library/react-native).
 *
 * Everything NATIVE is stubbed here — and only what is native. The hooks' own
 * logic, and the repositories underneath them, run for real:
 *   • the repositories come from src/testing/hook-repos.ts (real SQL, real CHECK
 *     constraints, in-memory better-sqlite3) — each test file re-points its
 *     `.client` singletons at them;
 *   • i18n is the REAL i18next, loaded with the REAL ar/en resource files, so a
 *     test can assert an error is LOCALIZED (a missing key echoes back as the
 *     key itself and the assertion fails, which is the point);
 *   • Alert is captured (src/testing/alerts.ts) — a hook REFUSES by alerting, so
 *     the alert is the assertion.
 *
 * The clock is frozen at T0. Nothing in this app may read the wall clock in a
 * test: a draft's docDate and a payment's occurredAt are both `Date.now()`.
 */
/* eslint-env jest */
const { resetHookRepos, T0 } = require('./src/testing/hook-repos');
const { captureAlerts, resetAlerts } = require('./src/testing/alerts');

// --- native modules -------------------------------------------------------

// Deterministic ids (src/utils/id.ts).
jest.mock('expo-crypto', () => {
  let n = 0;
  return {
    randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
});

// MMKV — the crash-safe draft buffer (useDocDraft) and the settings store write
// here synchronously. An in-memory Map is a faithful stand-in.
//
// `__store` is exposed so each test can start on an EMPTY device. The buffer is
// deliberately durable — it survives an OS kill, which is its whole job — so it
// would just as happily survive into the next test, and a form that re-hydrates
// the previous test's lines and paid amount is a form testing nothing.
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    __store: store,
    createMMKV: () => ({
      getString: (k) => (store.has(k) ? store.get(k) : undefined),
      set: (k, v) => store.set(k, v),
      remove: (k) => store.delete(k),
      delete: (k) => store.delete(k),
      clearAll: () => store.clear(),
    }),
  };
});

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ar', languageTag: 'ar-EG', textDirection: 'rtl' }],
}));

// The attachment BYTES live in a second expo-sqlite database. Hook tests care
// about the METADATA lifecycle (is a released InstaPay proof deleted, or left
// orphaned?), so the byte store is a spy and `removeAttachment` below is what
// the assertions read.
jest.mock('@/repositories/attachment-repository', () => ({
  attachmentRepository: {
    insert: jest.fn(),
    getBytes: jest.fn(() => null),
    listMeta: jest.fn(() => []),
    remove: jest.fn(),
    assignDocument: jest.fn(),
  },
}));

// The picker/ingest pipeline (expo-image-picker, expo-file-system, expo-sharing).
// `ingest` is what puts bytes in attachments.db; `removeAttachment` is what takes
// them out again — the orphaned-proof test asserts on exactly that call.
jest.mock('@/utils/attachments', () => ({
  pickPhoto: jest.fn(async () => null),
  pickFile: jest.fn(async () => null),
  ingest: jest.fn(async (picked) => ({
    id: `att-${picked?.name ?? 'file'}`,
    name: picked?.name ?? 'file.jpg',
    mime: picked?.mime ?? 'image/jpeg',
    size: 1024,
  })),
  openAttachment: jest.fn(async () => undefined),
  removeAttachment: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    constructor(uri) {
      this.uri = uri;
    }
    text() {
      return Promise.resolve('');
    }
  },
  Paths: { document: '/tmp', cache: '/tmp' },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
  useRoute: () => ({ params: {} }),
}));

// --- real i18n (ar), real resources ---------------------------------------
require('./src/i18n');

// --- per-test world -------------------------------------------------------

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(T0);
  resetHookRepos();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-mmkv').__store.clear(); // a fresh device, not the last test's draft
  captureAlerts();
  resetAlerts();
});

afterEach(() => {
  jest.restoreAllMocks();
});
