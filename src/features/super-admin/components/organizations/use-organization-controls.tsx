"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/features/super-admin/components/common/overlays";
import { OrganizationFormDialog } from "@/features/super-admin/components/organizations/organization-form-dialog";
import { OrganizationSheet } from "@/features/super-admin/components/organizations/organization-sheet";
import { setOrganizationActiveAction } from "@/features/super-admin/actions/organizations";
import { COPY } from "@/features/super-admin/constants/copy";
import type { Organization } from "@/features/super-admin/types";

type FormState = { open: boolean; organization?: Organization };

/**
 * Side panel, create/edit dialog and deactivate confirmation for
 * organizations. Shared by the dashboard and the Organizations page so both
 * behave identically. Render `overlays` once; call the returned functions
 * from rows and buttons.
 */
export function useOrganizationControls() {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<FormState>({ open: false });
  const [formKey, setFormKey] = useState(0);
  const [confirming, setConfirming] = useState<Organization | null>(null);
  const [pending, startTransition] = useTransition();

  const reloadDetails = () => setReloadKey((k) => k + 1);

  function openForm(organization?: Organization) {
    setFormKey((k) => k + 1);
    setForm({ open: true, organization });
  }

  function setActive(o: Organization, active: boolean) {
    startTransition(async () => {
      const result = await setOrganizationActiveAction(o.id, active);
      if (!result.success) return void toast.error(result.error.message);
      toast.success(active ? COPY.organizations.toast.activated(o.name) : COPY.organizations.toast.deactivated(o.name));
      setConfirming(null);
      reloadDetails();
    });
  }

  /** Activates straight away; deactivation asks first. */
  function toggleActive(o: Organization) {
    if (o.active) setConfirming(o);
    else setActive(o, true);
  }

  const overlays = (
    <>
      <OrganizationSheet
        organizationId={detailsId}
        reloadKey={reloadKey}
        onClose={() => setDetailsId(null)}
        onEdit={(o) => openForm(o)}
        onToggleActive={toggleActive}
      />
      <OrganizationFormDialog
        key={formKey}
        open={form.open}
        organization={form.organization}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={reloadDetails}
      />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? COPY.organizations.confirmDeactivate.title(confirming.name) : ""}
        body={COPY.organizations.confirmDeactivate.body}
        confirmLabel={COPY.organizations.confirmDeactivate.confirm}
        destructive
        pending={pending}
        onConfirm={() => confirming && setActive(confirming, false)}
      />
    </>
  );

  return {
    openDetails: (id: string) => setDetailsId(id),
    openCreate: () => openForm(),
    openEdit: (o: Organization) => openForm(o),
    toggleActive,
    pending,
    overlays,
  };
}
