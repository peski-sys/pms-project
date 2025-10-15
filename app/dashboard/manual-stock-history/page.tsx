import ManualHistoryComponent from "@/components/manual-history"


export default function ManualStockHistoryPage() {
    return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Manual Stocks History</h1>
          <p className="mt-2 text-gray-600">History Record of Bonus, Cash, Right or Promoter Shares</p>
        </div>
      </div>
      <ManualHistoryComponent />
    </div>
    )
}