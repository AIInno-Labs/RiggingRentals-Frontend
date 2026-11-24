"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnOffBadge, ToneBadge } from "@/features/super-admin/components/common/badges";
import { Field, FormError } from "@/features/super-admin/components/common/form-parts";
import { Panel, PanelHeader } from "@/features/super-admin/components/common/layout-parts";
import { ConfirmDialog } from "@/features/super-admin/components/common/overlays";
import { confirmMfaAction, disableMfaAction, startMfaSetupAction } from "@/features/super-admin/actions/profile";
import { COPY } from "@/features/super-admin/constants/copy";
import type { MfaSetup } from "@/features/super-admin/types";

const T = COPY.profile.mfa;

export function TwoStepCard({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startMfaSetupAction();
      if (result.success) setSetup(result.data);
      else toast.error(result.error.message);
    });
  }

  function confirm(code: string) {
    setError(null);
    startTransition(async () => {
      const result = await confirmMfaAction(code);
      if (!result.success) return setError(result.error.message);
      setSetup(null);
      toast.success(T.turnedOn);
    });
  }

  function turnOff() {
    startTransition(async () => {
      const result = await disableMfaAction();
      if (!result.success) return void toast.error(result.error.message);
      setConfirmingOff(false);
      toast.success(T.turnedOff);
    });
  }

  return (
    <Panel>
      <PanelHeader title={T.title} actions={enabled ? <OnOffBadge on /> : <ToneBadge tone="warn">{COPY.common.off}</ToneBadge>} />
      <div className="p-4">
        {enabled ? (
          <>
            <p className="mb-3">{T.onBody}</p>
            <Button variant="destructive" onClick={() => setConfirmingOff(true)}>
              {T.turnOff}
            </Button>
          </>
        ) : setup ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              confirm(String(new FormData(e.currentTarget).get("code") ?? ""));
            }}
          >
            <FormError message={error} />
            <p className="mb-2.5 text-[12.5px]">{T.scanHint}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <QrPlaceholder seed={setup.secret} />
              <div>
                <div className="text-[12.5px] text-muted-foreground">{T.orEnterKey}</div>
                <div className="font-mono break-all">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</div>
              </div>
            </div>
            <Field label={T.code} htmlFor="mfa-code" className="mt-3 max-w-[200px]">
              <Input id="mfa-code" name="code" maxLength={6} inputMode="numeric" autoComplete="one-time-code" className="font-mono" autoFocus />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSetup(null)}>
                {COPY.common.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {T.turnOn}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="mb-3">{T.offBody}</p>
            <Button disabled={pending} onClick={start}>
              {T.start}
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmingOff}
        onOpenChange={setConfirmingOff}
        title={T.confirmOffTitle}
        body={T.confirmOffBody}
        confirmLabel={T.turnOff}
        destructive
        pending={pending}
        onConfirm={turnOff}
      />
    </Panel>
  );
}

/**
 * Visual stand-in for the authenticator QR code (front-end only).
 * When the backend returns a real `otpauthUri`, render it with a QR library.
 */
function QrPlaceholder({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => (h = (h * 1103515245 + 12345) >>> 0) % 100;
  const finder = (r: number, c: number) => {
    for (const [fr, fc] of [[0, 0], [0, 14], [14, 0]]) {
      const y = r - fr;
      const x = c - fc;
      if (y >= 0 && y < 7 && x >= 0 && x < 7) return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4);
    }
    return null;
  };
  const cells: boolean[] = [];
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) cells.push(finder(r, c) ?? next() < 48);

  return (
    <div role="img" aria-label={T.qrLabel} className="grid size-[168px] grid-cols-[repeat(21,1fr)] border-8 border-white outline outline-1 outline-zinc-200">
      {cells.map((dark, i) => (
        <i key={i} className={dark ? "bg-brand-ink" : "bg-white"} />
      ))}
    </div>
  );
}
