import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { logout } from "../../../app/login/actions";
import { createClient } from "../../../utils/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // No need to check for errors or redirect, as the layout component will handle that
  const user = data?.user;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">User Profile</h1>

        <div className="space-y-4 mb-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Email</h2>
            <p className="mt-1 text-sm">{user?.email}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground">
              User ID
            </h2>
            <p className="mt-1 text-sm">{user?.id}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground">
              Last Sign In
            </h2>
            <p className="mt-1 text-sm">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <Link href="/private">
            <Button variant="outline" className="w-full">
              Private Area
            </Button>
          </Link>

          <Link href="/private/chat">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Private Chat
            </Button>
          </Link>

          <form>
            <Button
              formAction={logout}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Log out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
