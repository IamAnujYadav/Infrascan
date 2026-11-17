import { useState } from "react";
import { Download, Printer, BarChart3 } from "lucide-react";

const DEFECT_TRENDS = [
    { month: "May", count: 8 },
    { month: "Jun", count: 12 },
    { month: "Jul", count: 10 },
    { month: "Aug", count: 17 },
    { month: "Sep", count: 21 },
    { month: "Oct", count: 19 },
];

const CRACK_CLASSES = [
    { label: "Longitudinal Cracks", count: 34, color: "bg-cyan-600" },
    { label: "Transverse Cracks", count: 25, color: "bg-amber-500" },
    { label: "Diagonal Shear Cracks", count: 16, color: "bg-rose-600" },
    { label: "Alligator / Fatigue", count: 12, color: "bg-indigo-600" },
];

const ASSET_HEALTH = [
    { category: "Bridges", safe: 8, moderate: 3, critical: 2 },
    { category: "Roads", safe: 5, moderate: 2, critical: 2 },
    { category: "Buildings", safe: 4, moderate: 1, critical: 0 },
    { category: "Dams", safe: 2, moderate: 1, critical: 1 },
];

export default function AnalyticsView() {
    const [categoryFilter, setCategoryFilter] = useState("All");

    const visibleHealth =
        categoryFilter === "All"
            ? ASSET_HEALTH
            : ASSET_HEALTH.filter((row) => row.category === categoryFilter);

    const handleExportCsv = () => {
        const headers = ["Asset Category", "Safe Assets", "Moderate Defects", "Critical Defects"];
        const rows = visibleHealth.map((r) => [r.category, r.safe, r.moderate, r.critical].join(","));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `infrascan_analytics_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalCracks = CRACK_CLASSES.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="space-y-6">
            {/* Top Filter & Export Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-700" /> Structural Damage Analytics & Reporting
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Filter asset health metrics by infrastructure class and export audit summaries.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800"
                    >
                        <option value="All">All Infrastructure Types</option>
                        <option value="Bridges">Bridges</option>
                        <option value="Roads">Roads</option>
                        <option value="Buildings">Buildings</option>
                        <option value="Dams">Dams</option>
                    </select>

                    <button
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition"
                    >
                        <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded-md text-xs font-medium transition"
                    >
                        <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </button>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Monthly Defect Trends */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Monthly Detected Defects Trend</h3>
                    <p className="text-xs text-slate-500 mb-6">Total structural defects logged across field inspections</p>

                    <div className="h-48 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
                        {DEFECT_TRENDS.map((d) => {
                            const heightPct = Math.round((d.count / 24) * 100);
                            return (
                                <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-700">{d.count}</span>
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className="w-full max-w-[40px] bg-cyan-600 hover:bg-cyan-500 rounded-t-md transition-all"
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between gap-3 px-2 pt-2">
                        {DEFECT_TRENDS.map((d) => (
                            <span key={d.month} className="flex-1 text-center text-xs font-medium text-slate-500">
                                {d.month}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Chart 2: Crack Class Distribution */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Crack Class Distribution</h3>
                    <p className="text-xs text-slate-500 mb-6">Breakdown by YOLO & U-Net fracture classification</p>

                    <div className="space-y-4">
                        {CRACK_CLASSES.map((item) => {
                            const pct = Math.round((item.count / totalCracks) * 100);
                            return (
                                <div key={item.label} className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium text-slate-700">{item.label}</span>
                                        <span className="font-mono text-slate-500">
                                            {item.count} ({pct}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div style={{ width: `${pct}%` }} className={`h-full ${item.color} rounded-full`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Chart 3: Asset Health Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Asset Health Status by Category</h3>
                <p className="text-xs text-slate-500 mb-5">Distribution of Safe, Moderate, and Critical assets</p>

                <div className="space-y-4">
                    {visibleHealth.map((row) => {
                        const total = row.safe + row.moderate + row.critical || 1;
                        return (
                            <div key={row.category} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-800">{row.category}</span>
                                    <span className="font-mono text-slate-500">
                                        Safe: {row.safe} • Moderate: {row.moderate} • Critical: {row.critical}
                                    </span>
                                </div>
                                <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-100">
                                    <div style={{ width: `${(row.safe / total) * 100}%` }} className="bg-emerald-500" />
                                    <div style={{ width: `${(row.moderate / total) * 100}%` }} className="bg-amber-400" />
                                    <div style={{ width: `${(row.critical / total) * 100}%` }} className="bg-rose-600" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}