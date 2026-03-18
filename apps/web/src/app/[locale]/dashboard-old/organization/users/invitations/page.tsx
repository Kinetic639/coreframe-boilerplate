"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { InvitationManagementView } from "@/modules/organization-managment/components/invitations/InvitationManagementView";
import { InvitationFormDialog } from "@/modules/organization-managment/components/invitations/InvitationFormDialog";

export default function InvitationsPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <InvitationManagementView onInviteUser={() => setInviteDialogOpen(true)} />

      <InvitationFormDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={() => {
          // The InvitationManagementView will automatically refresh
          // when the dialog closes successfully
        }}
      />
    </motion.div>
  );
}
