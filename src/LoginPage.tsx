import React, { useState } from "react";
import { Eye, EyeOff, Scan, ChevronDown } from "lucide-react";

interface LoginPageProps {
    onLogin: (role: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState("Civil Engineer");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(role);
    };

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row font-sans">
            {/* Left Column: Dark Navy Branding Panel */}
            <div className="w-full md:w-1/2 bg-[#0a1628] text-white p-8 md:p-16 flex flex-col justify-between">
                {/* Brand Logo */}
                <div className="flex items-center gap-2.5">
                    <Scan className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold text-lg tracking-tight">InfraScan</span>
                </div>

                {/* Main Hero Copy */}
                <div className="my-auto py-12 max-w-lg">
                    <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold leading-tight tracking-tight text-white mb-6">
                        Crack and damage assessment for civil infrastructure.
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                        Schedule inspections, upload site images, and track defects across bridges, roads, buildings and dams.
                    </p>
                </div>

                {/* Bottom Tagline */}
                <div className="font-mono text-xs text-slate-500 tracking-wide">
                    AI results support — not replace — engineering judgement.
                </div>
            </div>

            {/* Right Column: Clean White Form Panel */}
            <div className="w-full md:w-1/2 bg-[#f8fafc] flex items-center justify-center p-8 md:p-16">
                <div className="w-full max-w-[400px]">
                    {/* Header */}
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                        {isSignUp ? "Create an account" : "Sign in"}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">
                        {isSignUp
                            ? "Register your InfraScan inspector profile."
                            : "Use your InfraScan account."}
                    </p>

                    {/* Demo Mode Notice Box */}
                    <div className="bg-[#fff9eb] border border-[#fde68a] rounded-md p-3.5 mb-6 text-[13px] leading-relaxed text-[#78350f]">
                        <span className="font-semibold text-[#78350f]">Demo mode.</span> No server is connected, so any email and password signs you in with sample data. This is not real authentication.
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name Field (Sign Up Only) */}
                        {isSignUp && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder=" "
                                    className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                                />
                            </div>
                        )}

                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder=" "
                                className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md pl-3.5 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field (Sign Up Only) */}
                        {isSignUp && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Confirm Password
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                                />
                            </div>
                        )}

                        {/* Role Dropdown */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                {isSignUp ? "Select Role" : "Demo role"}
                            </label>
                            <div className="relative">
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full appearance-none bg-white border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-800 pr-10 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer transition shadow-sm"
                                >
                                    <option value="Civil Engineer">Civil Engineer</option>
                                    <option value="Infrastructure Inspector">Infrastructure Inspector</option>
                                    <option value="Maintenance Engineer">Maintenance Engineer</option>
                                    <option value="Infrastructure Manager">Infrastructure Manager</option>
                                    <option value="Administrator">Administrator</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            type="submit"
                            className="w-full mt-2 bg-[#0e7490] hover:bg-[#155e75] active:bg-[#164e63] text-white font-medium py-2.5 rounded-md text-sm transition shadow-sm"
                        >
                            {isSignUp ? "Create account" : "Sign in"}
                        </button>
                    </form>

                    {/* Toggle between Sign In and Create Account */}
                    <div className="text-center mt-6">
                        <p className="text-xs text-slate-500">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-[#0e7490] font-medium hover:underline inline-block"
                            >
                                {isSignUp ? "Sign in" : "Create account"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}