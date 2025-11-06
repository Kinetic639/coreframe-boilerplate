// =============================================
// Contact Detail Page - Individual Contact View
// =============================================

import { ContactDetailView } from "@/modules/contacts/components/contact-detail-view";

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  return <ContactDetailView contactId={params.id} />;
}
