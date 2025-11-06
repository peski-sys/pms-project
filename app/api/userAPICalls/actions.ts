"use server"

import { prisma } from "@/lib/db";
import { hash } from "bcrypt";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth-config";

export type User = {
  user_id: number;
  user_email: string;
  is_admin: boolean;
}

/**
 * Get all users from the database
 */
export async function getUsers(): Promise<User[]> {
  try {
    const users = await prisma.users.findMany({
      select: {
        user_id: true,
        user_email: true,
        is_admin: true,
      },
      orderBy: {
        user_id: "asc",
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

/**
 * Create a new user with email, password, and role
 * Only admins can create users
 */
export async function createUser(
  email: string,
  password: string,
  role: "viewer" | "editor"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if current user is admin
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const currentUser = await prisma.users.findUnique({
      where: { user_email: session.user.email },
      select: { is_admin: true },
    });

    if (!currentUser?.is_admin) {
      return { success: false, error: "Unauthorized. Only admins can create users." };
    }

    // Validate inputs
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPassword = password?.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { success: false, error: "Email and password are required." };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { success: false, error: "Invalid email format." };
    }

    if (trimmedPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    // Check if email already exists
    const existingUser = await prisma.users.findUnique({
      where: { user_email: trimmedEmail },
    });

    if (existingUser) {
      return { success: false, error: "Email already registered." };
    }

    // Hash password (bcrypt handles salting internally)
    const hashedPassword = await hash(trimmedPassword, 12);

    // Determine is_admin based on role
    const isAdmin = role === "editor";

    // Create user
    await prisma.users.create({
      data: {
        user_email: trimmedEmail,
        user_password: hashedPassword,
        is_admin: isAdmin,
      },
    });

    // Create audit log
    await prisma.audit_log.create({
      data: {
        performed_action: `Created new user: ${trimmedEmail} with role: ${role}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

/**
 * Get current user email from session
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const session = await getServerSession(authConfig);
    return session?.user?.email || null;
  } catch (error) {
    console.error("Error getting current user email:", error);
    return null;
  }
}

/**
 * Delete a user by email
 * Only admins can delete users, and cannot delete themselves
 */
export async function deleteUser(
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if current user is admin
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const currentUser = await prisma.users.findUnique({
      where: { user_email: session.user.email },
      select: { is_admin: true },
    });

    if (!currentUser?.is_admin) {
      return { success: false, error: "Unauthorized. Only admins can delete users." };
    }

    // Prevent deleting current user
    if (session.user.email.toLowerCase() === userEmail.toLowerCase()) {
      return { success: false, error: "You cannot delete your own account." };
    }

    // Check if user exists
    const userToDelete = await prisma.users.findUnique({
      where: { user_email: userEmail },
    });

    if (!userToDelete) {
      return { success: false, error: "User not found." };
    }

    // Delete user
    await prisma.users.delete({
      where: { user_email: userEmail },
    });

    // Create audit log
    await prisma.audit_log.create({
      data: {
        performed_action: `Deleted user: ${userEmail}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}

/**
 * Update user role (toggle between viewer and editor)
 * Only admins can update roles, and cannot update their own role
 */
export async function updateUserRole(
  userEmail: string,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if current user is admin
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const currentUser = await prisma.users.findUnique({
      where: { user_email: session.user.email },
      select: { is_admin: true },
    });

    if (!currentUser?.is_admin) {
      return { success: false, error: "Unauthorized. Only admins can update user roles." };
    }

    // Prevent updating current user's role
    if (session.user.email.toLowerCase() === userEmail.toLowerCase()) {
      return { success: false, error: "You cannot change your own role." };
    }

    // Check if user exists
    const userToUpdate = await prisma.users.findUnique({
      where: { user_email: userEmail },
    });

    if (!userToUpdate) {
      return { success: false, error: "User not found." };
    }

    // Update user role
    await prisma.users.update({
      where: { user_email: userEmail },
      data: { is_admin: isAdmin },
    });

    // Create audit log
    const roleName = isAdmin ? "Editor" : "Viewer";
    await prisma.audit_log.create({
      data: {
        performed_action: `Updated user role for ${userEmail} to ${roleName}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating user role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user role",
    };
  }
}

