# ديون الزبائن — Debts by Customer (Receivables / AR) — **REMOVED**

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md).

## Status: DROPPED (2026-07-07 — owner)
**No customer debt (AR) in this app.** Sales are always paid in full, cash. There are no receivables to report, so this screen is **removed**.

Ripple (apply everywhere):
- Home: delete the «ديون لك (زبائن)» KPI tile. Keep only «ديون عليك (موردين)» = supplier debt (AP).
- Reports hub: remove the "ديون حسب الزبون" entry. Keep "الديون حسب المورد" (AP).
- Customers screen: customers have **no balance field** — contact record only (name/phone). No debt column, no aging.
- Navigation: drop the `DebtsByCustomer` route from `RootNavigator`.

Debt lives **only** on the supplier side — see [`DebtsBySupplierScreen.md`](./DebtsBySupplierScreen.md) and [`NewIncomingScreen.md`](../../documents/screens/NewIncomingScreen.md).
