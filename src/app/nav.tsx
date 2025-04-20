"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { logout } from "./login/actions";

export default function Navigation() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      setUser(user);
    } else {
      setUser(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  return (
    <div className="w-full max-w-2xl flex justify-end gap-4 mb-4">
      {loading ? (
        <div className="animate-pulse h-10 w-20 bg-gray-200 rounded"></div>
      ) : user ? (
        <>
          <Link href="/profile">
            <Button variant="outline" className="mr-2">
              Profile
            </Button>
          </Link>
          <Link href="/private">
            <Button variant="outline" className="mr-2">
              Private
            </Button>
          </Link>
          <form>
            <Button formAction={logout} variant="destructive">
              Logout
            </Button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login">
            <Button variant="outline" className="mr-2">
              Login
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="default">Sign Up</Button>
          </Link>
        </>
      )}
    </div>
  );
}
