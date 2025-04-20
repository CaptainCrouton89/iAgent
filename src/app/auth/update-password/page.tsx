import { Button } from "@/components/ui/button";
import Link from "next/link";
import { updatePassword } from "../reset-password/actions";

export default function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 max-w-full">
        <h1 className="text-2xl font-bold mb-6">Update Password</h1>

        {searchParams.error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {searchParams.error}
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter your new password"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Confirm your new password"
            />
          </div>

          <div className="flex flex-col space-y-3">
            <Button
              formAction={updatePassword}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Update Password
            </Button>

            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
