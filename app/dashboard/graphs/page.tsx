import GraphPageComponent from "@/components/graph-page"

export default function GraphsPage(){
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-3xl font-bold text-gray-900">Portfolio Analytics</h1>
                            <p className="mt-2 text-sm text-gray-600">
                                Comprehensive portfolio analysis, sector allocation, and investment insights
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Content Section */}
            <GraphPageComponent />
        </div>
    )
}
