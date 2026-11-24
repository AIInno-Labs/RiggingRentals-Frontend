import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[#f5d400]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#111111_0%,#111111_28%,transparent_28%)] opacity-[0.04]" />
      <LoginForm />
    </div>
  );
}
