import ManualHistoryComponent from "@/components/manual-history"


export default function ManualStockHistoryPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Enhanced Header Section */}
            <div className="bg-white shadow-lg border-b border-gray-100">
                <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        Manual Stock History Dashboard
                                    </h1>
                                    <p className="mt-2 text-base text-gray-600 max-w-2xl">
                                        Comprehensive manual stock history tracking and management. View detailed records of bonus shares, cash dividends, rights issues, and promoter holdings
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
                <ManualHistoryComponent />
            </div>
        </div>
    )
}