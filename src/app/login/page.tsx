import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 max-w-full">
        <h1 className="text-2xl font-bold mb-6">Login or Signup</h1>

        {searchParams?.error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {searchParams.error}
          </div>
        )}

        {searchParams?.message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {searchParams.message}
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex justify-between gap-4 pt-2">
            <button
              formAction={login}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition"
            >
              Log in
            </button>
            <button
              formAction={signup}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition"
            >
              Sign up
            </button>
          </div>

          <div className="text-center mt-4">
            <Link
              href="/auth/reset-password"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Forgot your password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
