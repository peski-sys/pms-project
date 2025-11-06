import UserManagementComponent from "@/components/user-management-component"

export default function UserManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">Manage system users and their roles</p>
        </div>
      </div>
      <UserManagementComponent />
    </div>
  )
}

