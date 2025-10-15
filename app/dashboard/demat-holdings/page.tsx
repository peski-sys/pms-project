import DematHoldingsComponent from "@/components/demat-holdings-comp"

export default function DematHoldingsPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">Demat Holdings</h1>
                    <p className="mt-2 text-gray-600">View Details for DEMAT Holdings. Note: Only Includes Those which are DEMATTED i.e. Uploaded Via PDF</p>
                </div>
            </div>
            <DematHoldingsComponent />
        </div>
    )
}