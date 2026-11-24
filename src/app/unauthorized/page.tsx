import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { homePathForRole } from "@/features/rbac/route-access";

export default async function UnauthorizedPage() {
  const profile = await getCurrentProfile();
  const home = profile ? homePathForRole(profile.role) : "/login";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            Your account does not have permission for this area, or your
            profile is missing / inactive.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={home}>{profile ? "Back to home" : "Back to login"}</Link>
          </Button>
          {profile ? (
            <Button asChild variant="outline">
              <Link href="/login">Switch account</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
