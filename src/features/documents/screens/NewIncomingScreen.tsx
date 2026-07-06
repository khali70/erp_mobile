import { DocumentForm } from '../components/DocumentForm';

/** وارد جديد · فاتورة مشتريات — new incoming document / purchase. Renders the
 *  shared DocumentForm in `purchase` mode (supplier party, unit costs, no scan). */
export function NewIncomingScreen() {
  return <DocumentForm mode="purchase" />;
}
