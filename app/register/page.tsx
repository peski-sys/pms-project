import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
            {/* Background Pattern */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-4 -right-4 w-72 h-72 bg-blue-200 rounded-full opacity-20 blur-3xl"></div>
                <div className="absolute -bottom-8 -left-8 w-96 h-96 bg-indigo-200 rounded-full opacity-20 blur-3xl"></div>
                <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-purple-200 rounded-full opacity-10 blur-2xl"></div>
            </div>
            
            {/* Content */}
            <div className="relative w-full max-w-md z-10">
                <RegisterForm />
            </div>
        </div>
    );
}
