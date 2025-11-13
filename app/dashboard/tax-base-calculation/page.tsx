import TaxCalculationComponent from "@/components/tax-calculation-component"

export default function TaxBaseCalculationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header Section */}
      <div className="bg-white shadow-lg border-b border-gray-100">
        <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Tax Base Calculation Dashboard
                  </h1>
                  <p className="mt-2 text-base text-gray-600 max-w-2xl">
                    Comprehensive tax base analysis and market value comparisons. Review detailed calculations across trading, promoter, and IPO staging holdings with advanced filtering capabilities
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
        <TaxCalculationComponent />
      </div>
    </div>
  )
}

