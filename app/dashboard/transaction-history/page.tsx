import  TransactionHistoryComponent  from "@/components/transaction-history"

export default function Transaction() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
                            <p className="mt-2 text-sm text-gray-600">
                                View and analyze all trading transactions with detailed filtering options
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Content Section */}
            <TransactionHistoryComponent />
        </div>
    )
}
