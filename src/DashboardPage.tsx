import { useState, useEffect } from "react";
import {
    Scan,
    LayoutDashboard,
    Building2,
    ClipboardList,
    Upload,
    MapPin,
    GitCompare,
    Wrench,
    BarChart3,
    LogOut,
    ChevronLeft,
    PlusCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
} from "lucide-react";
import { apiRequest } from "./api/client";
import AssetsView from "./components/AssetsView";
import ImageUploadView from "./components/ImageUploadView";
import InspectionReportModal from "./components/InspectionReportModal";
import DamageMapView from "./components/DamageMapView";
import HistoricalComparisonView from "./components/HistoricalComparisonView";
import MaintenanceQueueView from "./components/MaintenanceQueueView";
import AnalyticsView from "./components/AnalyticsView";

interface DashboardPageProps {
    userRole: string;
    onLogout: () => void;
}

interface DashboardStats {
    total_assets: number;
    critical_defects: number;
    pending_review: number;
    approved_audits: number;
}

export default function DashboardPage({ userRole, onLogout }: DashboardPageProps) {
    const [activeTab, setActiveTab] = useState("Dashboard");
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    const [inspectionsList, setInspectionsList] = useState([
        { id: "INS-001", asset: "Eastern Viaduct Pier 14", type: "Bridge", inspector: "Pranali Tantak", severity: "Critical", status: "Needs Review", date: "2026-10-24" },
        { id: "INS-002", asset: "North Dam Spillway Gate B", type: "Dam", inspector: "Pujita", severity: "Moderate", status: "In Progress", date: "2026-10-23" },
        { id: "INS-003", asset: "City Center Metro Overpass", type: "Bridge", inspector: "Rohit", severity: "Safe", status: "Approved", date: "2026-10-22" },
    ]);
    const [selectedInspection, setSelectedInspection] = useState<(typeof inspectionsList)[0] | null>(null);

    const userName = localStorage.getItem("infrascan_user_name") || "Pranali Tantak";

    useEffect(() => {
        setLoadingStats(true);
        apiRequest<DashboardStats>("/dashboard/summary")
            .then((data) => setStats(data))
            .catch(() => {
                setStats({
                    total_assets: 28,
                    critical_defects: 5,
                    pending_review: 12,
                    approved_audits: 25,
                });
            })
            .finally(() => setLoadingStats(false));
    }, []);

    const navItems = [
        { name: "Dashboard", icon: LayoutDashboard },
        { name: "Assets", icon: Building2 },
        { name: "Inspections", icon: ClipboardList },
        { name: "Image upload", icon: Upload },
        { name: "Damage Map", icon: MapPin },
        { name: "Before & After", icon: GitCompare },
        { name: "Maintenance", icon: Wrench },
        { name: "Analytics", icon: BarChart3 },
    ];

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex">
            <aside className="w-64 bg-[#0a1628] text-slate-300 hidden md:flex flex-col justify-between p-5 select-none border-r border-slate-800">
                <div>
                    <div className="flex items-center justify-between mb-8 text-white px-2">
                        <div className="flex items-center gap-2.5">
                            <Scan className="w-5 h-5 text-cyan-400" />
                            <span className="font-bold text-base tracking-tight">InfraScan</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => {
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

                <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3 px-2">
                    <div>
                        <span className="block text-xs font-semibold text-white">{userName}</span>
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
                    {activeTab === "Dashboard" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Assets</p>
                                        <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                            {loadingStats ? "..." : stats?.total_assets ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Critical Defects</p>
                                        <h3 className="text-2xl font-bold text-rose-600 mt-1">
                                            {loadingStats ? "..." : stats?.critical_defects ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Review</p>
                                        <h3 className="text-2xl font-bold text-amber-600 mt-1">
                                            {loadingStats ? "..." : stats?.pending_review ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Audits</p>
                                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                            {loadingStats ? "..." : stats?.approved_audits ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>

                            <AnalyticsView />
                        </div>
                    )}

                    {activeTab === "Assets" && <AssetsView />}

                    {activeTab === "Inspections" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-slate-900 text-base">Inspection Logs & Reviews</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Track field inspections, YOLO/U-Net overlays, and Grad-CAM reports.</p>
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
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${insp.severity === "Critical"
                                                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                            : insp.severity === "Moderate"
                                                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            }`}
                                                    >
                                                        {insp.severity}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-slate-600 text-xs font-medium">{insp.status}</td>
                                                <td className="py-4 px-6 text-right">
                                                    <button
                                                        onClick={() => setSelectedInspection(insp)}
                                                        className="text-cyan-600 hover:text-cyan-800 text-xs font-medium"
                                                    >
                                                        Review Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "Image upload" && <ImageUploadView />}
                    {activeTab === "Damage Map" && <DamageMapView />}
                    {activeTab === "Before & After" && <HistoricalComparisonView />}
                    {activeTab === "Maintenance" && <MaintenanceQueueView />}
                    {activeTab === "Analytics" && <AnalyticsView />}
                </div>
            </main>

            {selectedInspection && (
                <InspectionReportModal
                    inspectionId={selectedInspection.id}
                    fallbackSummary={selectedInspection}
                    onClose={() => setSelectedInspection(null)}
                    onStatusChange={(id, newStatus) =>
                        setInspectionsList((prev) =>
                            prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
                        )
                    }
                />
            )}
        </div>
    );
}