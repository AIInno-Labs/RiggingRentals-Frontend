import { superAdminApi } from "@/features/super-admin/api";
import { PageHeader } from "@/features/super-admin/components/common/layout-parts";
import { ChangePasswordForm, ProfileDetailsForm } from "@/features/super-admin/components/profile/profile-forms";
import { TwoStepCard } from "@/features/super-admin/components/profile/two-step-card";
import { COPY } from "@/features/super-admin/constants/copy";

export default async function ProfilePage() {
  const profile = await superAdminApi.getProfile();
  return (
    <>
      <PageHeader title={COPY.profile.title} description={COPY.profile.description} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <ProfileDetailsForm profile={profile} />
          <ChangePasswordForm />
        </div>
        <div className="grid content-start gap-3">
          <TwoStepCard enabled={profile.mfaEnabled} />
        </div>
      </div>
    </>
  );
}
