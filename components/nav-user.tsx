"use client"

import {
  ChevronsUpDown,
  LogOut,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"

import { useAuth } from "@/hooks/use-auth"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

import {
  Avatar,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser() {

  const { user, logout, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await getCurrentSessionUser()
        setIsAdmin(adminStatus ?? false)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAdmin(false)
      }
    }
    checkAdminStatus()
  }, [])

  const userData = {
    name: "Prabhu Capital",
    email: `${user?.email}`,
    avatar: "/assets/user.png",
  }

  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-6 w-6 rounded-lg">
                <AvatarImage src={userData.avatar} alt={userData.name} />
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userData.name}</span>
                <span className="truncate text-xs">{userData.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-6 w-6 rounded-lg">
                  <AvatarImage src={userData.avatar} alt={userData.name} />
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userData.name}</span>
                  <span className="truncate text-xs">{userData.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/user-management" className="flex gap-2 w-full">
                  <Users className="size-4" />
                  Manage Users
                </Link>
              </DropdownMenuItem>
            )}
            {isAdmin && <DropdownMenuSeparator />}
            <DropdownMenuItem>
              <div onClick={logout} className="flex gap-2">
                <LogOut />
              Logout
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
