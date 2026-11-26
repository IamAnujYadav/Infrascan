import React, { useState } from "react";
import { Eye, EyeOff, Scan, AlertCircle, CheckCircle2 } from "lucide-react";
import { loginUser, registerUser } from "./api/authApi";

export default function LoginPage({ onLogin }) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (isSignUp && password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (isSignUp && password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);

        try {
            if (isSignUp) {
                await registerUser({
                    full_name: fullName,
                    email: email,
                    password: password,
                });

                setSuccessMessage("Account created successfully! Please sign in.");
                setIsSignUp(false);
                setPassword("");
                setConfirmPassword("");
                setFullName("");
            } else {
                const data = await loginUser({
                    email: email,
                    password: password,
                });

                if (!data.user) {
                    throw new Error("User information was not returned.");
                }

                onLogin(data.user);
            }
        } catch (err) {
            setError(
                err.message ||
                    "Authentication failed. Please check your credentials and backend connection."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row font-sans">
            <div className="w-full md:w-1/2 bg-[#0a1628] text-white p-8 md:p-16 flex flex-col justify-between">
                <div className="flex items-center gap-2.5">
                    <Scan className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold text-lg tracking-tight">InfraScan</span>
                </div>

                <div className="my-auto py-12 max-w-lg">
                    <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold leading-tight tracking-tight text-white mb-6">
                        Crack and damage assessment for civil infrastructure.
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                        Schedule inspections, upload site images, run YOLOv8 + U-Net + ResNet50 AI pipelines, and track defects across bridges, roads, tunnels, buildings and dams.
                    </p>
                </div>

                <div className="font-mono text-xs text-slate-500 tracking-wide">
                    AI results support — not replace — engineering judgement.
                </div>
            </div>

            <div className="w-full md:w-1/2 bg-[#f8fafc] flex items-center justify-center p-8 md:p-16">
                <div className="w-full max-w-[420px]">
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                        {isSignUp ? "Create an account" : "Sign in"}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">
                        {isSignUp
                            ? "Register your InfraScan platform profile."
                            : "Sign in with your InfraScan credentials."}
                    </p>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3.5 mb-5 flex items-start gap-2.5 text-[13px] text-red-800">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3.5 mb-5 flex items-start gap-2.5 text-[13px] text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="e.g., Anuj Yadav"
                                    className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@organization.com"
                                className="w-full bg-[#f1f5f9] border border-slate-200 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                            />
                        </div>

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
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-[#0e7490] hover:bg-[#155e75] active:bg-[#164e63] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-md text-sm transition shadow-sm"
                        >
                            {isLoading
                                ? isSignUp
                                    ? "Creating account..."
                                    : "Signing in..."
                                : isSignUp
                                ? "Create account"
                                : "Sign in"}
                        </button>
                    </form>

                    <div className="text-center mt-6">
                        <p className="text-xs text-slate-500">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError(null);
                                    setSuccessMessage(null);
                                }}
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
