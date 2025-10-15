import CurrentFundsComponent from "@/components/current-funds"

export default function CurrentFunds() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Current Funds</h1>
          <p className="mt-2 text-gray-600">Manage investment funds and portfolios</p>
        </div>
      </div>
      <CurrentFundsComponent />
    </div>
  )
}
