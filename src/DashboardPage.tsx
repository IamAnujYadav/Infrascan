import React, { useState } from "react";
import {
    Scan,
    LayoutDashboard,
    Building2,
    ClipboardList,
    Upload,
    LogOut,
    ChevronLeft,
    PlusCircle,
    Search,
    MapPin,
    ArrowUpRight,
    FileCheck,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Image as ImageIcon,
    Sliders,
    RefreshCw
} from "lucide-react";

interface DashboardPageProps {
    userRole: string;
    onLogout: () => void;
}

export default function DashboardPage({ userRole, onLogout }: DashboardPageProps) {
    const [activeTab, setActiveTab] = useState("Dashboard");
    const [searchTerm, setSearchTerm] = useState("");

    // Image upload state for the Image Upload Workspace
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processed, setProcessed] = useState(false);

    // Mock data for assets
    const assetsList = [
        { id: "AST-101", name: "Eastern Viaduct Pier 14", type: "Bridge", location: "Sector 4 Highway", lastInspected: "2026-10-24", risk: "Critical" },
        { id: "AST-102", name: "North Dam Spillway Gate B", type: "Dam", location: "Koyna Reservoir", lastInspected: "2026-10-23", risk: "Moderate" },
        { id: "AST-103", name: "City Center Metro Overpass", type: "Bridge", location: "Downtown Line 2", lastInspected: "2026-10-22", risk: "Safe" },
        { id: "AST-104", name: "Mumbai-Pune Expressway Tunnel", type: "Road / Tunnel", location: "Km Marker 84", lastInspected: "2026-10-21", risk: "Critical" },
    ];

    // Mock data for inspections
    const inspectionsList = [
        { id: "INS-001", asset: "Eastern Viaduct Pier 14", type: "Bridge", inspector: "Pranali Tantak", severity: "Critical", status: "Needs Review", date: "2026-10-24" },
        { id: "INS-002", asset: "North Dam Spillway Gate B", type: "Dam", inspector: "Pujita", severity: "Moderate", status: "In Progress", date: "2026-10-23" },
        { id: "INS-003", asset: "City Center Metro Overpass", type: "Bridge", inspector: "Rohit", severity: "Safe", status: "Approved", date: "2026-10-22" },
    ];

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(URL.createObjectURL(file));
            setProcessed(false);
        }
    };

    const handleRunPreprocessing = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setProcessed(true);
        }, 1500);
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-[#0a1628] text-slate-300 hidden md:flex flex-col justify-between p-5 select-none border-r border-slate-800">
                <div>
                    {/* Logo */}
                    <div className="flex items-center justify-between mb-8 text-white px-2">
                        <div className="flex items-center gap-2.5">
                            <Scan className="w-5 h-5 text-cyan-400" />
                            <span className="font-bold text-base tracking-tight">InfraScan</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </div>

                    {/* Navigation Links */}
                    <nav className="space-y-1.5">
                        {[
                            { name: "Dashboard", icon: LayoutDashboard },
                            { name: "Assets", icon: Building2 },
                            { name: "Inspections", icon: ClipboardList },
                            { name: "Image upload", icon: Upload },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => setActiveTab(item.name)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === item.name
                                        ? "bg-slate-800/90 text-white shadow-sm"
                                        : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                                        }`}
                                >
                                    <Icon className="w-4 h-4" /> {item.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* User Profile Footer */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3 px-2">
                    <div>
                        <span className="block text-xs font-semibold text-white">Pranalitantak0</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">{userRole}</span>
                    </div>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition py-1"
                    >
                        <LogOut className="w-4 h-4 text-slate-400" /> Sign out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
                    <h1 className="text-lg font-bold text-slate-900">{activeTab}</h1>
                    <button
                        onClick={() => setActiveTab("Image upload")}
                        className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition shadow-sm"
                    >
                        <PlusCircle className="w-4 h-4" /> New Inspection
                    </button>
                </header>

                <div className="p-8 max-w-7xl w-full mx-auto space-y-6">

                    {/* TAB 1: DASHBOARD */}
                    {activeTab === "Dashboard" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Assets</p>
                                        <h3 className="text-2xl font-bold text-slate-900 mt-1">28</h3>
                                    </div>
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Building2 className="w-5 h-5" /></div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Critical Defects</p>
                                        <h3 className="text-2xl font-bold text-rose-600 mt-1">5</h3>
                                    </div>
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Review</p>
                                        <h3 className="text-2xl font-bold text-amber-600 mt-1">12</h3>
                                    </div>
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Audits</p>
                                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">25</h3>
                                    </div>
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-base font-bold text-slate-900 mb-4">Quick Overview</h2>
                                <p className="text-sm text-slate-600">
                                    Welcome back, <span className="font-semibold text-slate-800">Pranalitantak0</span>. Use the left sidebar to navigate through <span className="font-semibold">Assets</span> inventory, review scheduled <span className="font-semibold">Inspections</span>, or upload new site images to the <span className="font-semibold">Image upload</span> pipeline for crack detection analysis.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: ASSETS VIEW */}
                    {activeTab === "Assets" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-slate-900 text-base">Infrastructure Assets Registry</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Manage bridges, dams, tunnels, and structural assets.</p>
                                </div>
                                <button className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition">
                                    + Add Asset
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                                            <th className="py-3 px-6">Asset ID & Name</th>
                                            <th className="py-3 px-6">Type</th>
                                            <th className="py-3 px-6">Location</th>
                                            <th className="py-3 px-6">Last Inspected</th>
                                            <th className="py-3 px-6">Risk Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {assetsList.map((asset) => (
                                            <tr key={asset.id} className="hover:bg-slate-50 transition">
                                                <td className="py-4 px-6 font-medium text-slate-900">
                                                    {asset.name}
                                                    <span className="block text-xs font-mono text-slate-400">{asset.id}</span>
                                                </td>
                                                <td className="py-4 px-6 text-slate-600">{asset.type}</td>
                                                <td className="py-4 px-6 text-slate-600">{asset.location}</td>
                                                <td className="py-4 px-6 text-slate-600">{asset.lastInspected}</td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${asset.risk === "Critical" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                                        asset.risk === "Moderate" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        }`}>
                                                        {asset.risk}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: INSPECTIONS MANAGEMENT */}
                    {activeTab === "Inspections" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-slate-900 text-base">Inspection Logs & Reviews</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Track field inspections and engineering audit statuses.</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                                            <th className="py-3 px-6">Inspection ID</th>
                                            <th className="py-3 px-6">Asset Name</th>
                                            <th className="py-3 px-6">Inspector</th>
                                            <th className="py-3 px-6">Severity</th>
                                            <th className="py-3 px-6">Status</th>
                                            <th className="py-3 px-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {inspectionsList.map((insp) => (
                                            <tr key={insp.id} className="hover:bg-slate-50 transition">
                                                <td className="py-4 px-6 font-mono text-xs text-slate-600">{insp.id}</td>
                                                <td className="py-4 px-6 font-medium text-slate-900">{insp.asset}</td>
                                                <td className="py-4 px-6 text-slate-600">{insp.inspector}</td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${insp.severity === "Critical" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                                        insp.severity === "Moderate" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        }`}>
                                                        {insp.severity}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-slate-600 text-xs font-medium">{insp.status}</td>
                                                <td className="py-4 px-6 text-right">
                                                    <button className="text-cyan-600 hover:text-cyan-800 text-xs font-medium">Review Report</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: IMAGE UPLOAD & PREPROCESSING WORKSPACE */}
                    {activeTab === "Image upload" && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <h2 className="text-base font-bold text-slate-900 mb-1">Site Image Upload & Preprocessing Pipeline</h2>
                                <p className="text-xs text-slate-500 mb-6">Upload drone or site photographs for AI crack detection and damage segmentation analysis.</p>

                                {/* Upload Box */}
                                {!selectedImage ? (
                                    <label className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 transition">
                                        <ImageIcon className="w-10 h-10 text-slate-400 mb-3" />
                                        <span className="text-sm font-medium text-slate-700">Click to upload site photo or drag and drop</span>
                                        <span className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG (Max file size: 25MB)</span>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Original Image */}
                                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Original Site Image</span>
                                                <div className="h-64 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                                                    <img src={selectedImage} alt="Uploaded site preview" className="max-h-full object-contain" />
                                                </div>
                                            </div>

                                            {/* Preprocessed / Output View */}
                                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                                                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Preprocessing & AI Mask Output</span>
                                                <div className="h-64 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center relative">
                                                    {isProcessing ? (
                                                        <div className="text-center text-slate-300 space-y-2">
                                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                                                            <p className="text-xs">Running crack segmentation & normalization...</p>
                                                        </div>
                                                    ) : processed ? (
                                                        <div className="relative w-full h-full flex items-center justify-center">
                                                            <img src={selectedImage} alt="Processed" className="max-h-full object-contain opacity-50" />
                                                            <div className="absolute inset-0 bg-rose-500/10 border-2 border-rose-500/60 flex items-center justify-center pointer-events-none">
                                                                <span className="bg-rose-900/80 text-rose-200 text-[10px] font-mono px-2 py-1 rounded">Defect Detected: Crack Width ~0.8mm</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-400 text-xs px-4">
                                                            Click &quot;Run Preprocessing&quot; below to initiate image analysis.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                            <button
                                                onClick={() => setSelectedImage(null)}
                                                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                                            >
                                                Upload a different image
                                            </button>
                                            <button
                                                onClick={handleRunPreprocessing}
                                                disabled={isProcessing || processed}
                                                className="bg-[#0e7490] hover:bg-[#155e75] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-sm"
                                            >
                                                <Sliders className="w-4 h-4" /> {isProcessing ? "Processing..." : processed ? "Analysis Complete" : "Run Preprocessing Pipeline"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}