import FiscalYearComponent from "@/components/fiscal-years"

export default async function FiscalYearMapping() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Fiscal Year Mapping</h1>
          <p className="mt-2 text-gray-600">Manage fiscal year periods and date ranges</p>
        </div>
      </div>
      <FiscalYearComponent />
    </div>
  )
}
