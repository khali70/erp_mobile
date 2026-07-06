// Party domain view-types (customers & suppliers share this shape).

/**
 * A party as the UI consumes it. `balanceMinor` is INTEGER minor units:
 *   customers: + = the customer owes the shop (receivable / ديون لك)
 *   suppliers: + = the shop owes the supplier (payable / ديون عليك)
 */
export interface Party {
  id: string;
  name: string;
  phone: string | null;
  balanceMinor: number;
}

/** Editable fields captured by the party form. */
export interface PartyDraft {
  name: string;
  phone: string;
}
