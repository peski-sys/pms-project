"use client";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { noUsers, registerUser } from "@/app/register/actions"
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react"

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {

  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [message, setMessage] = useState("");

    const getUser = async () => {
    const noUserRegistered = await noUsers()
      if(noUserRegistered) {
        setIsLoadingMain(false)
      } else {
        router.push('/')
      }
    }

  useEffect(() => {
    getUser()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      await registerUser(formData);
      setMessage("Registration successful! Please login.");
    } catch (error) {
      setMessage("An error occurred during registration");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    !isLoadingMain && (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Prabhu Capital</h1>
        <p className="text-gray-600">Portfolio Management System</p>
        <p className="text-sm text-gray-500">(One Time Registration)</p>
      </div>

      {/* Register Form */}
      <Card className="border-0 shadow-xl">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {message && (
                <div className={`p-4 rounded-lg text-sm font-medium ${
                  message.includes("successful") 
                    ? "bg-green-50 text-green-700 border border-green-200" 
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {message}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                <Input
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <Input 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="Enter your password"
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-sm font-medium text-gray-700">Confirm Password</Label>
                <Input 
                  name="confirm_password" 
                  type="password" 
                  required 
                  placeholder="Confirm your password"
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Registering...
                  </div>
                ) : (
                  "Register"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    )
  )
}
