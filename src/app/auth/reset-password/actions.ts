"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    return redirect("/auth/reset-password?error=Email is required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }/auth/update-password`,
  });

  if (error) {
    return redirect(`/auth/reset-password?error=${error.message}`);
  }

  return redirect(
    "/auth/reset-password?message=Check your email for a password reset link"
  );
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;

  if (!password) {
    return redirect("/auth/update-password?error=Password is required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return redirect(`/auth/update-password?error=${error.message}`);
  }

  return redirect("/login?message=Your password has been updated successfully");
}
