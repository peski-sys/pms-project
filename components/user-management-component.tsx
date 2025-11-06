"use client"

import { getUsers, createUser, deleteUser, updateUserRole, getCurrentUserEmail, type User as UserType } from "@/app/api/userAPICalls/actions"
import { Card, CardContent } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw, Users, UserPlus, Shield, User as UserIcon, Trash2, Edit } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

export default function UserManagementComponent() {
  const [users, setUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedRole, setSelectedRole] = useState<"viewer" | "editor">("viewer")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const userPermission = await getCurrentSessionUser()
      setIsAdmin(userPermission ?? false)
      const currentEmail = await getCurrentUserEmail()
      setCurrentUserEmail(currentEmail)
      const response: UserType[] = await getUsers()
      setUsers(response)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to load users. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleUserCreate(formData: FormData) {
    setIsCreating(true)
    try {
      const email = (formData.get("email") as string)?.trim()
      const password = formData.get("password") as string
      const role = selectedRole || (formData.get("role") as "viewer" | "editor") || "viewer"

      if (!email || !password || !role) {
        toast.error("Please fill in all fields.")
        setIsCreating(false)
        return
      }

      const result = await createUser(email, password, role)

      if (result.success) {
        toast.success("User created successfully!")
        await fetchData()
        // Reset form and close dialog
        setSelectedRole("viewer")
        setDialogOpen(false)
      } else {
        toast.error(result.error || "Failed to create user.")
      }
    } catch (error) {
      console.error("Error creating user:", error)
      toast.error("Failed to create user. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteUser(userEmail: string) {
    setDeletingUser(userEmail)
    try {
      const result = await deleteUser(userEmail)
      if (result.success) {
        toast.success("User deleted successfully!")
        await fetchData()
      } else {
        toast.error(result.error || "Failed to delete user.")
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      toast.error("Failed to delete user. Please try again.")
    } finally {
      setDeletingUser(null)
    }
  }

  async function handleToggleRole(userEmail: string, currentIsAdmin: boolean) {
    setUpdatingUser(userEmail)
    try {
      const result = await updateUserRole(userEmail, !currentIsAdmin)
      if (result.success) {
        const newRole = !currentIsAdmin ? "Editor" : "Viewer"
        toast.success(`User role updated to ${newRole}!`)
        await fetchData()
      } else {
        toast.error(result.error || "Failed to update user role.")
      }
    } catch (error) {
      console.error("Error updating user role:", error)
      toast.error("Failed to update user role. Please try again.")
    } finally {
      setUpdatingUser(null)
    }
  }

  const totalUsers = users.length
  const adminUsers = users.filter((u) => u.is_admin).length
  const viewerUsers = users.filter((u) => !u.is_admin).length

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-8 border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-6">
              <p className="text-base font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-6">
              <p className="text-base font-medium text-gray-600">Editors</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{adminUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 border">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="ml-6">
              <p className="text-base font-medium text-gray-600">Viewers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{viewerUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        {isAdmin && (
          <Dialog 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                // Reset form when dialog closes
                setSelectedRole("viewer");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. Editors have admin privileges.
                </DialogDescription>
              </DialogHeader>
              <form action={async (formData: FormData) => {
                await handleUserCreate(formData);
              }} id="create-user-form">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="user@example.com"
                      required
                      className="w-full"
                      key={`email-${dialogOpen}`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      className="w-full"
                      key={`password-${dialogOpen}`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={selectedRole} 
                      onValueChange={(value) => setSelectedRole(value as "viewer" | "editor")}
                      required
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="role" value={selectedRole} />
                  </div>
                </div>
              </form>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isCreating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  form="create-user-form"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Users Table */}
      <Card className="shadow-sm border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">
                    S.N.
                  </TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-gray-900">
                    Email
                  </TableHead>
                  <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">
                    Role
                  </TableHead>
                  <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">
                    Status
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">
                      <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                      <p>Loading users...</p>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">
                      <Users className="size-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, index) => {
                    const isCurrentUser = currentUserEmail?.toLowerCase() === user.user_email.toLowerCase()
                    return (
                      <TableRow
                        key={user.user_id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <TableCell className="px-6 py-4 text-center font-medium text-gray-900">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-6 py-4 font-medium text-gray-900">
                          {user.user_email}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          {user.is_admin ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              <Shield className="w-3 h-3 mr-1" />
                              Editor
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              <UserIcon className="w-3 h-3 mr-1" />
                              Viewer
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Active
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isCurrentUser && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleRole(user.user_email, user.is_admin)}
                                    disabled={updatingUser === user.user_email}
                                    className="h-8"
                                  >
                                    {updatingUser === user.user_email ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Edit className="w-3 h-3 mr-1" />
                                        {user.is_admin ? "Make Viewer" : "Make Editor"}
                                      </>
                                    )}
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={deletingUser === user.user_email}
                                        className="h-8"
                                      >
                                        {deletingUser === user.user_email ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            Delete
                                          </>
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-red-600">Delete User</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete user <strong>{user.user_email}</strong>? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteUser(user.user_email)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              {isCurrentUser && (
                                <span className="text-xs text-gray-500">Current User</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

