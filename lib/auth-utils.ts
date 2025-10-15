import { auth } from "./auth";

/**
 * Get the current user's session on the server side
 * Use this in Server Components or API routes
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

/**
 * Check if a user is authenticated on the server side
 * Use this in Server Components or API routes
 */
export async function isAuthenticated() {
  const session = await auth();
  return !!session?.user;
}

/**
 * Get user ID from session
 * Use this in Server Components or API routes
 */
export async function getCurrentUserId() {
  const session = await auth();
  return session?.user?.id;
}
