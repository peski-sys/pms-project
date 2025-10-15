import { AuditLayout } from "@/components/audit-layout"

export default function AuditPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="mt-2 text-gray-600">Track system activities and user actions</p>
                </div>
            </div>
            <AuditLayout />
        </div>
    )
}
