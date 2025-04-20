import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { logout } from "../../../app/login/actions";
import { createClient } from "../../../utils/supabase/server";

export default async function PrivatePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // No need to check for errors or redirect, as the layout component will handle that

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Private Area</h1>
        <p className="mb-2">Hello {data?.user?.email}</p>
        <p className="mb-6 text-muted-foreground">
          You are logged in and can access protected content.
        </p>

        <div className="flex flex-col space-y-3 mb-6">
          <Link href="/private/chat">
            <Button
              className="w-full flex items-center justify-center"
              variant="outline"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Private Chat
            </Button>
          </Link>

          <Link href="/profile">
            <Button className="w-full" variant="outline">
              View Profile
            </Button>
          </Link>
        </div>

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
  );
}
