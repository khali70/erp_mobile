import { eq, isNull } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import * as schema from '@/db/schema';
import {
  backfillWalkInParties,
  seedSentinels,
  WALKIN_CUSTOMER_ID,
  WALKIN_SUPPLIER_ID,
} from './sentinels';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()

let db: TestDb;

beforeEach(() => {
  db = makeTestDb();
});

const allSuppliers = () => db.select().from(schema.suppliers).all();
const allCustomers = () => db.select().from(schema.customers).all();

/** A raw legacy document with NO party — exactly what predates this migration. */
function legacyNullPartyDoc(id: string, kind: 'in' | 'out') {
  db.insert(schema.documents)
    .values({
      id,
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
      kind,
      direction: kind === 'in' ? 1 : -1,
      status: 'posted',
      docNo: id,
      docDate: T0,
      totalAmount: 1000,
      postedAt: T0,
      partyId: null, // ← the null this whole design exists to eliminate
      note: null,
      attachments: null,
    })
    .run();
}

describe('TC-9.1 — the sentinels are seeded, and seeding is IDEMPOTENT', () => {
  it('seeds exactly one of each, with is_system=1', () => {
    seedSentinels(db, T0);

    const supplier = allSuppliers();
    const customer = allCustomers();
    expect(supplier).toHaveLength(1);
    expect(customer).toHaveLength(1);
    expect(supplier[0]).toMatchObject({ id: WALKIN_SUPPLIER_ID, isSystem: 1, balance: 0 });
    expect(customer[0]).toMatchObject({ id: WALKIN_CUSTOMER_ID, isSystem: 1, balance: 0 });
  });

  it('running the migration again (every app boot) creates NO duplicates', () => {
    seedSentinels(db, T0); // fresh install
    seedSentinels(db, T0 + 1); // app restart
    seedSentinels(db, T0 + 2); // ...and again

    // A duplicate sentinel would silently split walk-in history in two — half
    // the walk-in documents pointing at one row, half at the other, and no
    // error anywhere to say so.
    expect(allSuppliers()).toHaveLength(1);
    expect(allCustomers()).toHaveLength(1);
  });

  it('does not overwrite the seeded row on a re-run', () => {
    seedSentinels(db, T0);
    seedSentinels(db, T0 + 5000);
    expect(allSuppliers()[0].createdAt).toBe(T0); // INSERT OR IGNORE, not upsert
  });
});

describe('TC-9.6 — the migration backfills every existing null party', () => {
  it('repoints purchases at the supplier sentinel and sales at the customer sentinel', () => {
    legacyNullPartyDoc('IN-legacy-1', 'in');
    legacyNullPartyDoc('IN-legacy-2', 'in');
    legacyNullPartyDoc('OUT-legacy-1', 'out');

    seedSentinels(db, T0);
    backfillWalkInParties(db, T0);

    const docs = db.select().from(schema.documents).all();
    const byId = new Map(docs.map((d) => [d.id, d.partyId]));
    expect(byId.get('IN-legacy-1')).toBe(WALKIN_SUPPLIER_ID);
    expect(byId.get('IN-legacy-2')).toBe(WALKIN_SUPPLIER_ID);
    expect(byId.get('OUT-legacy-1')).toBe(WALKIN_CUSTOMER_ID);

    // The point of the whole exercise: no document is left with a null party,
    // so no query anywhere needs a special case for one.
    const orphans = db
      .select()
      .from(schema.documents)
      .where(isNull(schema.documents.partyId))
      .all();
    expect(orphans).toHaveLength(0);
  });

  it('leaves documents that already have a real party alone', () => {
    db.insert(schema.suppliers)
      .values({
        id: 'ahmed',
        createdAt: T0,
        updatedAt: T0,
        deletedAt: null,
        name: 'Ahmed',
        phone: null,
        balance: 0,
        isSystem: 0,
      })
      .run();
    db.insert(schema.documents)
      .values({
        id: 'IN-real',
        createdAt: T0,
        updatedAt: T0,
        deletedAt: null,
        kind: 'in',
        direction: 1,
        status: 'posted',
        docNo: 'IN-real',
        docDate: T0,
        totalAmount: 1000,
        postedAt: T0,
        partyId: 'ahmed',
        note: null,
        attachments: null,
      })
      .run();

    seedSentinels(db, T0);
    backfillWalkInParties(db, T0);

    const doc = db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, 'IN-real'))
      .get();
    expect(doc!.partyId).toBe('ahmed');
  });

  it('is a no-op on the second run (idempotent, like the seed)', () => {
    legacyNullPartyDoc('IN-legacy-1', 'in');
    seedSentinels(db, T0);
    backfillWalkInParties(db, T0);
    backfillWalkInParties(db, T0 + 1);

    expect(
      db.select().from(schema.documents).where(isNull(schema.documents.partyId)).all(),
    ).toHaveLength(0);
  });
});
