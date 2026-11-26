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
    Users,
    LogOut,
    ChevronLeft,
    PlusCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Cpu,
    ShieldCheck,
    FileCheck2,
    Trash2,
} from "lucide-react";

import { apiRequest, formatRoleLabel, unwrapItems } from "./api/client";

import AssetsView from "./components/AssetsView";
import ImageUploadView from "./components/ImageUploadView";
import InspectionReportModal from "./components/InspectionReportModal";
import DamageMapView from "./components/DamageMapView";
import HistoricalComparisonView from "./components/HistoricalComparisonView";
import MaintenanceQueueView from "./components/MaintenanceQueueView";
import AnalyticsView from "./components/AnalyticsView";
import AdminUsersView from "./components/AdminUsersView";

const ROLE_DASHBOARD_SUBTITLE = {
    inspector: "Field Inspector View — Assigned inspections, site image uploads & defect capture",
    civil_engineer: "Civil Engineer View — Structural damage analysis, crack geometry & AI review verification",
    maintenance_engineer: "Maintenance Engineer View — Priority repairs, work logs & asset maintenance history",
    manager: "Infrastructure Manager View — Portfolio health, high-priority findings & inspection oversight",
    admin: "Administrator View — Platform health, AI model versions, user roles & audit logs",
};

export default function DashboardPage({ user, userRole, onLogout }) {
    const [activeTab, setActiveTab] = useState("Dashboard");

    const [stats, setStats] = useState(null);
    const [modelsInfo, setModelsInfo] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);

    const [inspectionsList, setInspectionsList] = useState([]);
    const [assetsCache, setAssetsCache] = useState([]);
    const [selectedInspection, setSelectedInspection] = useState(null);

    const rawRole = String(userRole || user?.role || "inspector").toLowerCase();
    const isAdmin = rawRole === "admin";
    const canDeleteInspection = ["admin", "manager", "civil_engineer"].includes(rawRole);
    const userName = user?.full_name || user?.email || "User";
    const displayRole = formatRoleLabel(rawRole);

    const loadDashboardData = async () => {
        setLoadingStats(true);
        try {
            const [summaryRes, mapRes, inspectionResponse, modelsResponse, assetsResponse] = await Promise.all([
                apiRequest("/dashboard/summary").catch(() => null),
                apiRequest("/dashboard/map").catch(() => null),
                apiRequest("/inspections?limit=200"),
                apiRequest("/models").catch(() => []),
                apiRequest("/assets?limit=200").catch(() => ({ items: [] })),
            ]);
            setAssetsCache(unwrapItems(assetsResponse));

            const inspections = unwrapItems(inspectionResponse);
            const mapItems = Array.isArray(mapRes) ? mapRes : [];

            const latestSeverityByAsset = {};
            const latestPriorityByAsset = {};
            mapItems.forEach((m) => {
                if (m && m.id !== undefined) {
                    latestSeverityByAsset[m.id] = m.latest_severity;
                    latestPriorityByAsset[m.id] = m.latest_priority;
                }
            });

            const enrichedInspections = inspections.map((item) => ({
                id: item.id,
                asset_id: item.asset_id,
                asset: item.asset_name || item.asset_code || `Asset ${item.asset_id ?? ""}`,
                asset_code: item.asset_code || "",
                type: item.asset_type || "Infrastructure",
                inspector: item.assigned_to_name || "Unassigned",
                severity: latestSeverityByAsset[item.asset_id] || "Not assessed",
                priority: latestPriorityByAsset[item.asset_id] || "—",
                image_count: item.image_count ?? 0,
                status: item.status || "planned",
                date: item.inspection_date || item.scheduled_date || item.created_at?.split("T")[0] || "",
            }));

            if (summaryRes) {
                setStats({
                    total_assets: summaryRes.total_assets ?? 0,
                    critical_defects: summaryRes.severe_or_critical_count ?? 0,
                    open_inspections:
                        (summaryRes.planned_inspections ?? 0) + (summaryRes.in_progress_inspections ?? 0),
                    awaiting_review: summaryRes.awaiting_review ?? 0,
                    completed_inspections: summaryRes.completed_inspections ?? 0,
                });
            } else {
                const criticalDefects = enrichedInspections.filter((item) => {
                    const s = String(item.severity || "").toLowerCase();
                    return s.includes("critical") || s.includes("severe");
                }).length;
                const openInspections = enrichedInspections.filter((item) =>
                    ["planned", "in_progress"].includes(String(item.status || "").toLowerCase())
                ).length;
                const completedInspections = enrichedInspections.filter(
                    (item) => String(item.status || "").toLowerCase() === "completed"
                ).length;

                setStats({
                    total_assets: mapItems.length,
                    critical_defects: criticalDefects,
                    open_inspections: openInspections,
                    awaiting_review: 0,
                    completed_inspections: completedInspections,
                });
            }

            setModelsInfo(Array.isArray(modelsResponse) ? modelsResponse : []);
            setInspectionsList(enrichedInspections);
        } catch (error) {
            console.error("Dashboard data could not be loaded:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleDeleteInspection = async (insp) => {
        if (!window.confirm(`Delete Inspection #${insp.id} (${insp.asset}) and all its photos permanently?`)) {
            return;
        }
        try {
            await apiRequest(`/inspections/${insp.id}`, { method: "DELETE" });
            setInspectionsList((prev) => prev.filter((item) => item.id !== insp.id));
            loadDashboardData();
        } catch (err) {
            alert(err.message || "Failed to delete inspection.");
        }
    };

    useEffect(() => {
        loadDashboardData();
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
        ...(isAdmin ? [{ name: "Users & Audit", icon: Users }] : []),
    ];

    const severityPill = (sev) => {
        const s = String(sev || "").toLowerCase();
        if (s.includes("critical") || s.includes("severe")) {
            return "bg-rose-50 text-rose-700 border border-rose-200";
        }
        if (s.includes("moderate") || s.includes("minor")) {
            return "bg-amber-50 text-amber-700 border border-amber-200";
        }
        if (s.includes("no visible")) {
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";
        }
        return "bg-slate-50 text-slate-600 border border-slate-200";
    };

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
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                                        activeTab === item.name
                                            ? "bg-slate-800/90 text-white shadow-sm"
                                            : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3 px-2">
                    <div>
                        <span className="block text-xs font-semibold text-white">{userName}</span>
                        <span className="block text-[11px] text-cyan-400 mt-0.5">{displayRole}</span>
                    </div>

                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition py-1"
                    >
                        <LogOut className="w-4 h-4 text-slate-400" />
                        Sign out
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{activeTab}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {modelsInfo.length > 0 && (
                            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                                <Cpu className="w-3.5 h-3.5 text-cyan-700" />
                                <span>
                                    AI Models: {modelsInfo.filter((m) => m.loaded).length}/{modelsInfo.length} active
                                </span>
                            </div>
                        )}

                        <button
                            onClick={() => setActiveTab("Image upload")}
                            className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition shadow-sm"
                        >
                            <PlusCircle className="w-4 h-4" />
                            New Inspection
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
                    {activeTab === "Dashboard" && (
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <ShieldCheck className="w-5 h-5 text-cyan-700 shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">
                                            {displayRole} Workspace
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {ROLE_DASHBOARD_SUBTITLE[rawRole] || ROLE_DASHBOARD_SUBTITLE.inspector}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {rawRole === "civil_engineer" && (
                                        <button
                                            onClick={() => setActiveTab("Inspections")}
                                            className="px-3 py-1.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-medium hover:bg-cyan-100"
                                        >
                                            Review AI Findings ({stats?.awaiting_review ?? 0})
                                        </button>
                                    )}
                                    {rawRole === "maintenance_engineer" && (
                                        <button
                                            onClick={() => setActiveTab("Maintenance")}
                                            className="px-3 py-1.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-medium hover:bg-cyan-100"
                                        >
                                            Log Maintenance Work
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button
                                            onClick={() => setActiveTab("Users & Audit")}
                                            className="px-3 py-1.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-medium hover:bg-cyan-100"
                                        >
                                            Manage Roles & Audit Logs
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Active Assets
                                        </p>
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
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Severe / Critical
                                        </p>
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
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            {rawRole === "civil_engineer" ? "Photos Awaiting Review" : "Open Inspections"}
                                        </p>
                                        <h3 className="text-2xl font-bold text-amber-600 mt-1">
                                            {loadingStats
                                                ? "..."
                                                : rawRole === "civil_engineer"
                                                ? stats?.awaiting_review ?? 0
                                                : stats?.open_inspections ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                                        {rawRole === "civil_engineer" ? (
                                            <FileCheck2 className="w-5 h-5" />
                                        ) : (
                                            <Clock className="w-5 h-5" />
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            Completed Audits
                                        </p>
                                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                            {loadingStats ? "..." : stats?.completed_inspections ?? 0}
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>

                            {modelsInfo.length > 0 && (
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                        Deployed AI Inference Pipeline Models
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {modelsInfo.map((m) => (
                                            <div
                                                key={m.name}
                                                className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                                            >
                                                <div>
                                                    <span className="text-xs font-bold text-slate-800 capitalize block">
                                                        {m.name} ({m.version})
                                                    </span>
                                                    <span className="text-[11px] font-mono text-slate-400">
                                                        {m.weights ? m.weights.split(/[\\/]/).pop() : "default"}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                        m.loaded
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-amber-100 text-amber-700"
                                                    }`}
                                                >
                                                    {m.loaded ? "Loaded" : "Lazy / Standby"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <AnalyticsView initialAssets={assetsCache} initialInspections={inspectionsList} />
                        </div>
                    )}

                    {activeTab === "Assets" && <AssetsView userRole={rawRole} />}

                    {activeTab === "Inspections" && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-slate-900 text-base">
                                        Inspection Logs & AI Assessment Reports
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Open an inspection to view YOLOv8 detections, U-Net masks, Grad-CAM heatmaps, and submit engineer reviews.
                                    </p>
                                </div>
                                <button
                                    onClick={loadDashboardData}
                                    className="px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                                            <th className="py-3 px-6">ID</th>
                                            <th className="py-3 px-6">Asset</th>
                                            <th className="py-3 px-6">Inspector</th>
                                            <th className="py-3 px-6">Photos</th>
                                            <th className="py-3 px-6">Latest Severity</th>
                                            <th className="py-3 px-6">Status</th>
                                            <th className="py-3 px-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loadingStats ? (
                                            <tr>
                                                <td colSpan="7" className="py-8 text-center text-slate-500">
                                                    Loading inspections...
                                                </td>
                                            </tr>
                                        ) : inspectionsList.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="py-8 text-center text-slate-500">
                                                    No inspections found. Create one via &quot;New Inspection&quot;.
                                                </td>
                                            </tr>
                                        ) : (
                                            inspectionsList.map((insp) => (
                                                <tr key={insp.id} className="hover:bg-slate-50 transition">
                                                    <td className="py-4 px-6 font-mono text-xs text-slate-600">
                                                        #{insp.id}
                                                    </td>
                                                    <td className="py-4 px-6 font-medium text-slate-900">
                                                        {insp.asset}
                                                        {insp.asset_code && (
                                                            <span className="block font-mono text-[11px] text-slate-400">
                                                                {insp.asset_code}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-600">{insp.inspector}</td>
                                                    <td className="py-4 px-6 font-mono text-xs text-slate-600">
                                                        {insp.image_count}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityPill(
                                                                insp.severity
                                                            )}`}
                                                        >
                                                            {insp.severity}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-600 text-xs font-medium capitalize">
                                                        {String(insp.status).replaceAll("_", " ")}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="inline-flex items-center justify-end gap-3">
                                                            <button
                                                                onClick={() => setSelectedInspection(insp)}
                                                                className="text-cyan-700 hover:text-cyan-900 text-xs font-semibold"
                                                            >
                                                                Inspect & Review Report
                                                            </button>
                                                            {canDeleteInspection && (
                                                                <button
                                                                    onClick={() => handleDeleteInspection(insp)}
                                                                    title="Delete Inspection"
                                                                    className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "Image upload" && (
                        <ImageUploadView
                            onOpenInspection={(newId) => {
                                loadDashboardData();
                                setActiveTab("Inspections");
                                setSelectedInspection({ id: newId });
                            }}
                        />
                    )}

                    {activeTab === "Damage Map" && <DamageMapView />}

                    {activeTab === "Before & After" && <HistoricalComparisonView />}

                    {activeTab === "Maintenance" && <MaintenanceQueueView userRole={rawRole} />}

                    {activeTab === "Analytics" && <AnalyticsView initialAssets={assetsCache} initialInspections={inspectionsList} />}

                    {activeTab === "Users & Audit" && isAdmin && <AdminUsersView currentUserId={user?.id} />}
                </div>
            </main>

            {selectedInspection && (
                <InspectionReportModal
                    inspectionId={selectedInspection.id}
                    fallbackSummary={selectedInspection}
                    userRole={rawRole}
                    onClose={() => {
                        setSelectedInspection(null);
                        loadDashboardData();
                    }}
                    onStatusChange={(id, newStatus) =>
                        setInspectionsList((prev) =>
                            prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
                        )
                    }
                    onDeleted={(id) => {
                        setSelectedInspection(null);
                        setInspectionsList((prev) => prev.filter((item) => item.id !== id));
                        loadDashboardData();
                    }}
                />
            )}
        </div>
    );
}