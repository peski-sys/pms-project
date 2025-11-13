import Dashcard from "@/components/dashboardCardLayout";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Minimal Dashboard Container with consistent styling */}
      <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
        <Dashcard />
      </div>
    </div>
  )
}
