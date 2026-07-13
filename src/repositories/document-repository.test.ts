import { makeTestDb } from '@/db/testing/test-db';
import {
  createDocumentRepository,
  NegativeStockError,
  type CreateDocumentInput,
  type DocumentRepository,
} from './document-repository';

let repo: DocumentRepository;

beforeEach(() => {
  repo = createDocumentRepository(makeTestDb());
});

const incoming = (itemId: string, qty: number, unitPrice = 0): CreateDocumentInput => ({
  kind: 'incoming',
  status: 'posted',
  lines: [{ itemId, qty, unitPrice }],
});
const outgoing = (itemId: string, qty: number, unitPrice = 0): CreateDocumentInput => ({
  kind: 'outgoing',
  status: 'posted',
  lines: [{ itemId, qty, unitPrice }],
});

describe('documentRepository — posting into real SQL', () => {
  it('posting incoming (A,10) sets on-hand 10; then outgoing (A,3) → 7', () => {
    repo.create(incoming('A', 10));
    expect(repo.onHand('A')).toBe(10);
    repo.create(outgoing('A', 3));
    expect(repo.onHand('A')).toBe(7);
  });

  it('a draft has no stock effect; posting it applies the effect exactly once', () => {
    const id = repo.create({ kind: 'incoming', lines: [{ itemId: 'A', qty: 5 }] }); // default draft
    expect(repo.onHand('A')).toBe(0);
    repo.post(id);
    expect(repo.onHand('A')).toBe(5);
    repo.post(id); // idempotent — no double count
    expect(repo.onHand('A')).toBe(5);
  });

  it('blocks an overdrawing outgoing post (allowNegative=false) and leaves stock intact', () => {
    repo.create(incoming('A', 5));
    const draftId = repo.create({ kind: 'outgoing', lines: [{ itemId: 'A', qty: 8 }] });
    expect(() => repo.post(draftId)).toThrow(NegativeStockError);
    expect(repo.onHand('A')).toBe(5);
  });

  it('allows the same overdraw when allowNegative=true (on-hand goes negative)', () => {
    repo.create(incoming('A', 5));
    const draftId = repo.create({ kind: 'outgoing', lines: [{ itemId: 'A', qty: 8 }] });
    repo.post(draftId, { allowNegative: true });
    expect(repo.onHand('A')).toBe(-3);
  });

  it('unpost reverts a posted doc; on-hand re-derives without it', () => {
    repo.create(incoming('A', 10));
    const outId = repo.create(outgoing('A', 4));
    expect(repo.onHand('A')).toBe(6);
    repo.unpost(outId);
    expect(repo.onHand('A')).toBe(10);
  });

  it('remove (soft-delete) drops the doc stock effect', () => {
    const inId = repo.create(incoming('A', 10));
    expect(repo.onHand('A')).toBe(10);
    repo.remove(inId);
    expect(repo.onHand('A')).toBe(0);
    expect(repo.list()).toHaveLength(0); // hidden from live list
  });

  it('editing via unpost→repost does not double count', () => {
    const inId = repo.create(incoming('A', 10));
    repo.unpost(inId);
    repo.post(inId);
    expect(repo.onHand('A')).toBe(10);
  });

  it('assigns monotonic per-kind doc numbers', () => {
    const a = repo.create(incoming('A', 1));
    const b = repo.create(incoming('A', 1));
    const c = repo.create(outgoing('A', 1));
    expect(repo.getWithLines(a)!.docNo).toBe('IN-000001');
    expect(repo.getWithLines(b)!.docNo).toBe('IN-000002');
    expect(repo.getWithLines(c)!.docNo).toBe('OUT-000001');
  });

  it('caches total_amount from line qty × unit price', () => {
    const id = repo.create(incoming('A', 2, 350)); // 2 × 3.50
    expect(repo.getWithLines(id)!.totalAmount).toBe(700);
  });

  // A haggled sale must record BOTH what it sold for and what it listed at. The
  // gap is the discount, and it cannot be reconstructed later — items.sale_price
  // moves, and the ledger is immutable. See docs/plan/features/02.
  it('records the negotiated unit price and the list price it was sold against', () => {
    repo.create(incoming('A', 5, 18000)); // stock to sell from
    const id = repo.create({
      kind: 'outgoing',
      status: 'posted',
      lines: [{ itemId: 'A', qty: 1, unitPrice: 20000, listPrice: 25000 }], // sold 200, lists 250
    });
    const [line] = repo.getWithLines(id)!.lines;
    expect(line.unitPrice).toBe(20000);
    expect(line.listPrice).toBe(25000);
    // Revenue follows the price actually charged, not the list price.
    expect(repo.getWithLines(id)!.totalAmount).toBe(20000);
  });

  it('leaves listPrice null when none is supplied (purchases, legacy lines)', () => {
    const id = repo.create(incoming('A', 2, 350));
    expect(repo.getWithLines(id)!.lines[0].listPrice).toBeNull();
  });

  it('list filters by kind and status', () => {
    repo.create(incoming('A', 1));
    repo.create(outgoing('A', 0.0)); // zero-qty outgoing, still a posted doc
    repo.create({ kind: 'incoming', lines: [{ itemId: 'B', qty: 1 }] }); // draft
    expect(repo.list({ kind: 'incoming' })).toHaveLength(2);
    expect(repo.list({ status: 'posted' })).toHaveLength(2);
    expect(repo.list({ status: 'draft' })).toHaveLength(1);
  });
});
