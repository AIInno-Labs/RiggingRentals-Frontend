"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/features/auth/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPANY } from "@/features/documents/company-profile";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      router.replace(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="steel-panel w-full max-w-md rounded-2xl p-6 md:p-8">
      <div className="mb-5 flex justify-center border-b border-[#e4e4e7] pb-5">
        <BrandLogo variant="login" priority />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Yard sign-in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Staff access for sales, workshop, and finance ·{" "}
        <a
          href={COMPANY.website}
          className="text-[#111111] underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {COMPANY.website.replace(/^https?:\/\//, "")}
        </a>
      </p>
      <form action={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            className="h-10 bg-white/70"
            defaultValue="admin@rigging.demo"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="h-10 bg-white/70"
            defaultValue="RiggingDemo1!"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-10 w-full bg-[#1a1a1a] text-[#f5d400] hover:bg-black"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
