"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {hash} from 'bcrypt';


export async function registerUser(formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = (formData.get("password") as string) || "";
    const confirmPassword = (formData.get("confirm_password") as string) || "";

    // Basic validation
    if (!email || !password || !confirmPassword) {
      console.log("All fields are required");
      throw new Error("All fields are required");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("Invalid email format");
      throw new Error("Invalid email format");
    }

    if (password.length < 8) {
      console.log("Password must be at least 8 characters");
      throw new Error("Password must be at least 8 characters");
    }

    if (password !== confirmPassword) {
      console.log("Passwords do not match");
      throw new Error("Passwords do not match");
    }

    // Check if email already exists
    const existingUser = await prisma.users.findUnique({
      where: { user_email: email },
    });

    if (existingUser) {
      console.log("Email already registered");
      throw new Error("Email already registered");
    }

    // Hash password (bcrypt handles salting internally)
    const hashedPass = await hash(password, 12);

    // Create user
    await prisma.users.create({
      data: {
        user_email: email,
        user_password: hashedPass,
      },
    });

    console.log("User registered successfully!");
    redirect("/");
  } catch (error) {
    if (error instanceof Error && !error.message.includes("NEXT_REDIRECT")) {
      console.log(error.message || "Registration failed");
    }
    throw error;
  }
}

export async function noUsers() {
    const users = await prisma.users.findMany();
    return users.length === 0
}