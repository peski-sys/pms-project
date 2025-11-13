import { AuditLayout } from "@/components/audit-layout"

export default function AuditPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Enhanced Header Section */}
            <div className="bg-white shadow-lg border-b border-gray-100">
                <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        Audit Logs Dashboard
                                    </h1>
                                    <p className="mt-2 text-base text-gray-600 max-w-2xl">
                                        Comprehensive system audit trail and activity monitoring. Track all user actions, system changes, and security events with detailed logging capabilities
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
                            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>Live Data</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Content Section with full width utilization */}
            <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
                <AuditLayout />
            </div>
        </div>
    )
}
