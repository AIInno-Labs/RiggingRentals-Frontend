"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FormError } from "@/features/super-admin/components/common/form-parts";
import { COPY } from "@/features/super-admin/constants/copy";
import { cn } from "@/lib/utils";

/**
 * Dialog wrapping a form: fixed header and footer, scrolling body.
 * `onSubmit` receives the form's FormData; native validation is turned off so
 * every rule is enforced (and worded) by the Zod schemas.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  error,
  pending,
  submitLabel,
  onSubmit,
  footerStart,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  error: string | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: (data: FormData) => void;
  /** Extra buttons on the left of the footer. */
  footerStart?: ReactNode;
  children: ReactNode;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="gap-0.5 border-b border-zinc-200 px-4 pt-4 pr-12 pb-3">
            <DialogTitle className="font-display text-[22px] font-semibold">{title}</DialogTitle>
            <DialogDescription className={cn(!subtitle && "sr-only")}>{subtitle ?? title}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <FormError message={error} />
            {children}
          </div>
          <DialogFooter className="m-0 flex-wrap rounded-none bg-muted/50 px-4 py-3 sm:justify-end">
            {footerStart}
            {footerStart ? <span className="hidden flex-1 sm:block" /> : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {COPY.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Small yes/no confirmation. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-zinc-700">{body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {COPY.common.cancel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={destructive ? undefined : "bg-zinc-900 text-brand hover:bg-black"}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Right-hand detail panel opened by clicking a list row. */
export function SidePanel({
  open,
  onOpenChange,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-[480px]">
        <SheetHeader className="gap-0.5 border-b border-zinc-200 px-4 pt-4 pr-12 pb-3">
          <SheetTitle className="font-display text-[22px] font-semibold">{title}</SheetTitle>
          <SheetDescription className={cn(!subtitle && "sr-only")}>{subtitle ?? title}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-muted/50 px-4 py-3">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
