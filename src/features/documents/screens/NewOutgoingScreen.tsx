import { DocumentForm } from '../components/DocumentForm';

/** صادر جديد · بيع — new outgoing document / sale. Renders the shared
 *  DocumentForm in `sale` mode (customer party, sale prices, barcode scan). */
export function NewOutgoingScreen() {
  return <DocumentForm mode="sale" />;
}
