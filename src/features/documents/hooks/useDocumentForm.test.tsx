/**
 * THE PURCHASE / SALE FORM — where a typo becomes a debt.
 *
 * Every number in this hook is money, and every one of them has a silent way to
 * be wrong: a float tail in the prefill, an Arabic-Indic digit that parseFloat
 * reads as NaN, a cleared box that reads as "paid nothing", a stray letter that
 * routes a whole cash sale into InstaPay. None of these throw. They all just
 * post a document that says something the owner never said.
 *
 * So the repositories here are REAL — the same factories the app builds, over an
 * in-memory better-sqlite3 db with the app's DDL. The assertions read the ROWS:
 * what the cash book holds, what `owed()` derives, whether a transaction row
 * exists at all. A mocked repository could only ever confirm that the hook made
 * the call it made.
 */
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@/i18n';
import { repos as mockRepos, T0 } from '@/testing/hook-repos';
import { alertCount, alerts, lastAlert, pressAlertButton } from '@/testing/alerts';
import { WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { InvalidPaymentError } from '@/repositories/document-repository';
import { pickPhoto, removeAttachment } from '@/utils/attachments';
import type { DocMode } from '../types';
import { useDocumentForm } from './useDocumentForm';

jest.mock('@/repositories/document-repository.client', () => ({
  get documentRepository() {
    return mockRepos.documents;
  },
}));
jest.mock('@/repositories/item-repository.client', () => ({
  get itemRepository() {
    return mockRepos.items;
  },
}));
jest.mock('@/repositories/tag-repository.client', () => ({
  get tagRepository() {
    return mockRepos.tags;
  },
}));
jest.mock('@/repositories/supplier-repository.client', () => ({
  get supplierRepository() {
    return mockRepos.suppliers;
  },
}));
jest.mock('@/repositories/customer-repository.client', () => ({
  get customerRepository() {
    return mockRepos.customers;
  },
}));
jest.mock('@/repositories/debt-repository.client', () => ({
  get debtRepository() {
    return mockRepos.debts;
  },
}));
// The hook marks a voice note processed after a save. Its `.client` singleton
// binds expo-sqlite AND expo-file-system at import time, so it has to be swapped
// here too, otherwise merely importing the hook opens the real database.
jest.mock('@/repositories/voice-note-repository.client', () => ({
  get voiceNoteRepository() {
    return mockRepos.voiceNotes;
  },
}));

const pickPhotoMock = pickPhoto as jest.MockedFunction<typeof pickPhoto>;
const removeAttachmentMock = removeAttachment as jest.MockedFunction<typeof removeAttachment>;

/** The catalog item every test buys and sells: cost 12.60, sale price 20.00. */
function seedItem() {
  return mockRepos.items.create({ name: 'زيت', costPrice: 1260, salePrice: 2000 });
}

/** Stock to sell FROM — an already-posted, already-paid purchase of 10. */
function seedStock(itemId: string) {
  mockRepos.documents.create({
    kind: 'incoming',
    status: 'posted',
    partyId: WALKIN_SUPPLIER_ID,
    lines: [{ itemId, qty: 10, unitPrice: 1260 }],
    payments: [{ amount: 12600, account: 'cash' }],
  });
}

const render = (mode: DocMode) => renderHook(() => useDocumentForm(mode));

/**
 * A form with ONE line: 12.60 × 2 = 25.20 — the exact figure whose float sum is
 * 25.200000000000003. Everything below leans on that.
 */
async function formWithLine(mode: DocMode, unitPrice = 12.6, qty = 2) {
  const view = await render(mode);
  const { result } = view;
  await act(() => result.current.appendItem(result.current.items[0]));
  const lineId = result.current.lines[0].id;
  await act(() => result.current.setPrice(lineId, unitPrice));
  await act(() => result.current.setQty(lineId, qty));
  return view;
}

const supplierRows = (id: string) => mockRepos.transactions.listByRef('supplier', id);
const saleRows = (docId: string) =>
  mockRepos.transactions.listForCashBook().filter((r) => r.docId === docId);
const postedDocs = () => mockRepos.documents.list({ status: 'posted' });
/** The SALE — `seedStock` posts a purchase first, so `[0]` is not it. */
const saleDoc = () => postedDocs().filter((d) => d.kind === 'out');
/** `transactions.attachments` is a JSON text column; `null` when nothing rode along. */
const attachmentsOf = (row: { attachments: string | null }) =>
  row.attachments === null ? null : JSON.parse(row.attachments);

describe('useDocumentForm — the paid box, untouched', () => {
  it('prefills the FULL TOTAL from the integer totalMinor — "٢٥٫٢٠", never a float tail', async () => {
    seedItem();
    const { result } = await formWithLine('purchase');

    // 12.60 × 2 float-summed is 25.200000000000003. The box must show the money.
    expect(result.current.paidValue).toBe('٢٥٫٢٠');
    expect(result.current.paidValue).not.toMatch(/[٠-٩]{4,}$/); // no ٢٥٫٢٠٠٠٠٠٠٠٠٠٠٠٠٠٠٣
    expect(result.current.paid).toBe(25.2);
    expect(result.current.remaining).toBe(0); // untouched ⇒ paid in full ⇒ no debt
  });

  it('pays the invoice IN FULL and leaves no debt behind', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    const rows = supplierRows(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 2520, direction: -1, account: 'cash' });
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
    // The document itself agrees with the payment, to the last piastre.
    expect(postedDocs()[0].totalAmount).toBe(2520);
  });

  it('follows the total when a line is added after the box was never touched', async () => {
    seedItem();
    const { result } = await formWithLine('purchase');

    await act(() => result.current.appendItem(result.current.items[0]));
    await act(() => result.current.setPrice(result.current.lines[1].id, 10));

    expect(result.current.total).toBe(35.2);
    expect(result.current.paid).toBe(35.2);
    expect(result.current.paidValue).toBe('٣٥٫٢٠');
    expect(result.current.remaining).toBe(0);
  });
});

describe('useDocumentForm — the paid box, typed', () => {
  it('PARTIAL: saves, pays what was handed over, and leaves the rest as debt', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('10'));

    expect(result.current.remaining).toBeCloseTo(15.2, 10); // shown as debt, > 0

    await act(() => result.current.save());

    const rows = supplierRows(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(1000);
    expect(mockRepos.debts.owed(supplier.id)).toBe(1520); // 2520 invoiced − 1000 paid
    expect(lastAlert()?.title).toBe(i18n.t('documents.saved'));
  });

  it('ZERO: writes NO transaction row at all — not a zero-amount one', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('0'));
    await act(() => result.current.save());

    // The document posted; the money did not move. `amount > 0` is a CHECK — a
    // zero-amount row would have thrown and rolled the whole purchase back.
    expect(postedDocs()).toHaveLength(1);
    expect(supplierRows(supplier.id)).toHaveLength(0);
    expect(mockRepos.transactions.listForCashBook()).toHaveLength(0);
    expect(mockRepos.transactions.balances()).toMatchObject({ cash: 0, instapay: 0 });
    expect(mockRepos.debts.owed(supplier.id)).toBe(2520); // the whole invoice is debt
  });

  it('MORE THAN THE TOTAL: refused with a LOCALIZED message, and nothing is written', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('30'));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.exceedsTotal'));
    // A real sentence, not `InvalidPaymentError: paid 3000 of 2520`.
    expect(lastAlert()?.message).not.toContain('Error');
    expect(lastAlert()?.message).not.toBe('payments.errors.exceedsTotal');
    expect(postedDocs()).toHaveLength(0);
    expect(supplierRows(supplier.id)).toHaveLength(0);
  });
});

describe('useDocumentForm — the paid box, in ARABIC-INDIC digits', () => {
  // THE REGRESSION THAT MATTERS MOST. An Arabic keyboard reaching parseFloat as
  // NaN became 0, and a purchase paid in full became a debt for its entire value
  // — no error, no exception, nothing on screen. It is the bug that hides.
  it('"٢٥٫٢٠" parses to 2520 MINOR UNITS — not NaN, not 0', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('٢٥٫٢٠'));

    expect(result.current.paid).toBe(25.2);
    expect(Number.isNaN(result.current.paid)).toBe(false);
    expect(result.current.paidValue).toBe('٢٥٫٢٠');
    expect(result.current.remaining).toBe(0);

    await act(() => result.current.save());

    const rows = supplierRows(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(2520);
    // The purchase is PAID. It is not a 25.20 debt wearing a paid receipt.
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });

  it('"١٠" is a partial payment of ten pounds, and the remainder is the debt', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('١٠'));
    await act(() => result.current.save());

    expect(supplierRows(supplier.id)[0].amount).toBe(1000);
    expect(mockRepos.debts.owed(supplier.id)).toBe(1520);
  });

  it('"١٬٠٠٠" is a THOUSAND — the grouping mark must not truncate it to one pound', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    // 500 × 2 = 1000.00 — the same figure the app itself prints as ١٬٠٠٠٫٠٠.
    const { result } = await formWithLine('purchase', 500, 2);

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('١٬٠٠٠'));

    expect(result.current.paid).toBe(1000); // parseFloat('1٬000') === 1
    await act(() => result.current.save());

    expect(supplierRows(supplier.id)[0].amount).toBe(100_000);
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });
});

describe('useDocumentForm — the paid box, half-typed and garbage', () => {
  it('CLEARED after touching is not "paid nothing" — an empty box still means the total', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('10'));
    await act(() => result.current.setPaid('')); // he deleted what he typed

    // An empty box and an untouched box look IDENTICAL on screen. They cannot
    // mean opposite things about money: blank ⇒ the total, as it always was.
    expect(result.current.paid).toBe(25.2);
    expect(result.current.remaining).toBe(0);
    // …and the box still shows blank, because that is what he typed. Re-filling
    // it would fight his next keystroke.
    expect(result.current.paidValue).toBe('');

    await act(() => result.current.save());

    expect(supplierRows(supplier.id)[0].amount).toBe(2520);
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });

  it('GARBAGE is refused, not silently read as zero', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('abc'));
    await act(() => result.current.save());

    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.invalidAmount'));
    expect(lastAlert()?.message).not.toBe('payments.errors.invalidAmount');
    expect(postedDocs()).toHaveLength(0);
    expect(supplierRows(supplier.id)).toHaveLength(0);
    expect(mockRepos.debts.owed(supplier.id)).toBe(0); // no invoice, so no debt
  });

  it('A HALF-NUMBER ("25abc") is refused — parseFloat would have read it as 25', async () => {
    seedItem();
    mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('25abc'));
    await act(() => result.current.save());

    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.invalidAmount'));
    expect(postedDocs()).toHaveLength(0);
  });

  it('A NEGATIVE amount is refused — it must not round up to a zero-paid debt', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setPaid('-5'));
    await act(() => result.current.save());

    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.negative'));
    expect(postedDocs()).toHaveLength(0);
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });
});

describe('useDocumentForm — the WALK-IN purchase (the sentinel)', () => {
  it('must be paid IN FULL: a partial payment is refused, with a localized reason', async () => {
    seedItem();
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(null)); // "شراء نقدي (بدون مورد)"
    expect(result.current.isWalkIn).toBe(true);

    await act(() => result.current.setPaid('10'));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.walkInMustBePaid'));
    expect(lastAlert()?.message).not.toBe('payments.errors.walkInMustBePaid');
    // NOTHING is written: "بدون مورد" is not a person anyone can chase for 15.20.
    expect(postedDocs()).toHaveLength(0);
    expect(mockRepos.transactions.listForCashBook()).toHaveLength(0);
    expect(mockRepos.debts.owed(WALKIN_SUPPLIER_ID)).toBe(0);
  });

  it('refuses a walk-in bought entirely on credit (paid 0) — the sentinel cannot carry debt', async () => {
    seedItem();
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(null));
    await act(() => result.current.setPaid('0'));
    await act(() => result.current.save());

    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.walkInMustBePaid'));
    expect(postedDocs()).toHaveLength(0);
  });

  it('paid in full, it posts against the SENTINEL party — never a null party_id', async () => {
    seedItem();
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(null));
    await act(() => result.current.save()); // untouched ⇒ the full total

    const doc = postedDocs()[0];
    expect(doc.partyId).toBe(WALKIN_SUPPLIER_ID);
    const rows = supplierRows(WALKIN_SUPPLIER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(2520);
    // The money genuinely left the drawer — the cash book shows it…
    expect(mockRepos.transactions.balances().cash).toBe(-2520);
    // …and the sentinel still owes nobody anything.
    expect(mockRepos.debts.owed(WALKIN_SUPPLIER_ID)).toBe(0);
  });
});

describe('useDocumentForm — a SALE is settled in full, across one pocket or two', () => {
  it('a split with a BLANK cash half stays ALL CASH — it does not route the sale to InstaPay', async () => {
    const item = seedItem();
    seedStock(item.id);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await formWithLine('sale', 20, 2); // 40.00

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setSplitEnabled(true));
    // Opening the split PRE-FILLS the cash half with the whole sale…
    expect(result.current.cashPartValue).toBe('٤٠٫٠٠');
    // …and clearing it must not hand the sale to the other pocket on a stray tap.
    await act(() => result.current.setCashPart(''));

    expect(result.current.saleCashPart).toBe(40);
    expect(result.current.saleInstapayPart).toBe(0);
    expect(result.current.saleTouchesInstapay).toBe(false);

    await act(() => result.current.save());

    const rows = saleRows(saleDoc()[0].id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account: 'cash', amount: 4000, direction: 1 });
    expect(mockRepos.transactions.balances()).toMatchObject({ cash: 4000 - 12600, instapay: 0 });
  });

  it('a real split writes TWO rows against ONE document, summing to the total exactly', async () => {
    const item = seedItem();
    seedStock(item.id);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await formWithLine('sale', 20, 2); // 40.00

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setSplitEnabled(true));
    await act(() => result.current.setCashPart('١٥')); // Arabic-Indic, again
    expect(result.current.saleCashPart).toBe(15);
    expect(result.current.saleInstapayPart).toBe(25); // the REMAINDER, by construction

    await act(() => result.current.save());

    const rows = saleRows(saleDoc()[0].id);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(4000); // == the total, exactly
    expect(rows.map((r) => `${r.account}:${r.amount}`).sort()).toEqual(
      ['cash:1500', 'instapay:2500'].sort(),
    );
  });

  it('a GARBAGE cash half is refused — it must not silently send the whole sale to InstaPay', async () => {
    const item = seedItem();
    seedStock(item.id);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await formWithLine('sale', 20, 2);

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setSplitEnabled(true));
    await act(() => result.current.setCashPart('abc'));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.invalidAmount'));
    expect(saleDoc()).toHaveLength(0);
  });

  it('a cash half bigger than the sale is TOLD to him, not quietly trimmed', async () => {
    const item = seedItem();
    seedStock(item.id);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await formWithLine('sale', 20, 2);

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setSplitEnabled(true));
    await act(() => result.current.setCashPart('100'));
    await act(() => result.current.save());

    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.splitExceedsTotal'));
    expect(saleDoc()).toHaveLength(0);
  });

  it('SHORT-PAID is impossible by construction — and if it ever happened, the ledger refuses it', async () => {
    const item = seedItem();
    seedStock(item.id);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await formWithLine('sale', 20, 2);

    await act(() => result.current.selectParty(result.current.parties[0]));

    // There is no "how much" box on a sale: the two halves are the total and the
    // remainder, so they cannot fail to add up. Customer debt (AR) is deprecated
    // — there is no book that could hold an unpaid remainder.
    await act(() => result.current.setSplitEnabled(true));
    await act(() => result.current.setCashPart('12.34'));
    expect(result.current.saleCashPart + result.current.saleInstapayPart).toBe(
      result.current.total,
    );

    // And the ledger is the backstop: a short-paid sale is REJECTED, and the
    // owner is told — not left with a posted sale whose money is missing.
    jest.spyOn(mockRepos.documents, 'create').mockImplementation(() => {
      throw new InvalidPaymentError('A sale must be settled in full — paid 1234 of 4000');
    });

    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(saleDoc()).toHaveLength(0);
    // The draft is NOT cleared: his work survives the refusal.
    expect(result.current.lines).toHaveLength(1);
  });
});

describe('useDocumentForm — InstaPay proof follows the money', () => {
  it('is RELEASED when the account is toggled back to cash — never orphaned in attachments.db', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setAccount('instapay'));

    pickPhotoMock.mockResolvedValueOnce({
      uri: 'file:///proof.jpg',
      name: 'proof.jpg',
      mime: 'image/jpeg',
      size: 1024,
    });
    await act(() => result.current.addPaymentProof());
    expect(result.current.paymentAttachments).toHaveLength(1);
    const proofId = result.current.paymentAttachments[0].id;

    // He changes his mind: it was cash after all. The screenshot is proof of an
    // InstaPay transfer that no longer exists — its bytes must not sit forever in
    // attachments.db attached to nothing, while a chip he can see promises they
    // were filed.
    await act(() => result.current.setAccount('cash'));

    expect(result.current.paymentAttachments).toEqual([]);
    expect(removeAttachmentMock).toHaveBeenCalledWith(proofId);

    await act(() => result.current.save());

    const rows = supplierRows(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].account).toBe('cash');
    expect(attachmentsOf(rows[0])).toBeNull(); // and nothing rode along on the row
  });

  it('rides on the payment row when the money really did go through InstaPay', async () => {
    seedItem();
    const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.setAccount('instapay'));

    pickPhotoMock.mockResolvedValueOnce({
      uri: 'file:///proof.jpg',
      name: 'proof.jpg',
      mime: 'image/jpeg',
      size: 1024,
    });
    await act(() => result.current.addPaymentProof());
    await act(() => result.current.save());

    const rows = supplierRows(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].account).toBe('instapay');
    expect(attachmentsOf(rows[0])).toEqual([
      { id: 'att-proof.jpg', name: 'proof.jpg', mime: 'image/jpeg', size: 1024 },
    ]);
    expect(removeAttachmentMock).not.toHaveBeenCalled();
  });
});

describe('useDocumentForm — refusals never write, and never lose his work', () => {
  it('refuses an empty document, and a zero-cost purchase line, before any money is touched', async () => {
    seedItem();
    const { result } = await render('purchase');

    await act(() => result.current.save()); // no lines
    expect(lastAlert()?.message).toBe(i18n.t('documents.errors.noLines'));

    await act(() => result.current.appendItem(result.current.items[0])); // purchase ⇒ cost 0
    await act(() => result.current.save());
    expect(lastAlert()?.message).toBe(i18n.t('documents.errors.zeroCost'));

    expect(alertCount()).toBe(2);
    expect(postedDocs()).toHaveLength(0);
  });

  it('confirms a save with an OK the owner must press — the screen closes on HIS tap', async () => {
    seedItem();
    mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await formWithLine('purchase');

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    expect(alerts().map((a) => a.title)).toEqual([i18n.t('documents.saved')]);
    expect(() => pressAlertButton(i18n.t('documents.ok'))).not.toThrow();
    expect(postedDocs()).toHaveLength(1);
    expect(postedDocs()[0].postedAt).toBe(T0);
  });
});
