import { useState, useEffect } from "react";
import { Download, Printer, BarChart3, FileSpreadsheet } from "lucide-react";
import { apiRequest, unwrapItems } from "../api/client";

export default function AnalyticsView({ initialAssets = null, initialInspections = null }) {
    const [assets, setAssets] = useState(initialAssets || []);
    const [inspections, setInspections] = useState(initialInspections || []);
    const [categoryFilter, setCategoryFilter] = useState("all");

    useEffect(() => {
        if (initialAssets) setAssets(initialAssets);
    }, [initialAssets]);

    useEffect(() => {
        if (initialInspections) setInspections(initialInspections);
    }, [initialInspections]);

    useEffect(() => {
        if (initialAssets && initialInspections) return;
        Promise.all([
            initialAssets ? Promise.resolve(initialAssets) : apiRequest("/assets?limit=200").catch(() => ({ items: [] })),
            initialInspections ? Promise.resolve(initialInspections) : apiRequest("/inspections?limit=200").catch(() => ({ items: [] })),
        ]).then(([assetRes, inspRes]) => {
            if (!initialAssets) setAssets(unwrapItems(assetRes));
            if (!initialInspections) setInspections(unwrapItems(inspRes));
        });
    }, []);

    const filteredAssets =
        categoryFilter === "all"
            ? assets
            : assets.filter((a) => String(a.asset_type || "").toLowerCase() === categoryFilter);

    const statusCounts = {
        planned: inspections.filter((i) => i.status === "planned").length,
        in_progress: inspections.filter((i) => i.status === "in_progress").length,
        completed: inspections.filter((i) => i.status === "completed").length,
        cancelled: inspections.filter((i) => i.status === "cancelled").length,
    };

    const byTypeMap = {};
    filteredAssets.forEach((a) => {
        const key = String(a.asset_type || "other");
        byTypeMap[key] = (byTypeMap[key] || 0) + 1;
    });
    const typeRows = Object.entries(byTypeMap).map(([type, count]) => ({
        type,
        label: type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
    }));

    const handleExportCsv = () => {
        const headers = ["Asset Code", "Asset Name", "Type", "Location", "Frequency", "Active"];
        const rows = filteredAssets.map((a) =>
            [a.asset_code, a.name, a.asset_type, a.location, a.inspection_frequency, a.is_active ? "Yes" : "Archived"]
                .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
                .join(",")
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `infrascan_assets_summary_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportExcel = () => {
        const tableRows = filteredAssets
            .map(
                (a) =>
                    `<tr><td>${a.asset_code}</td><td>${a.name}</td><td>${a.asset_type}</td><td>${a.location}</td><td>${a.inspection_frequency}</td></tr>`
            )
            .join("");
        const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
        <h3>InfraScan Infrastructure Registry Summary</h3>
        <table border="1">
          <tr><th>Asset Code</th><th>Name</th><th>Category</th><th>Location</th><th>Inspection Frequency</th></tr>
          ${tableRows}
        </table>
      </body></html>`;
        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `infrascan_assets_summary_${new Date().toISOString().split("T")[0]}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const totalAssetsCount = filteredAssets.length || 1;
    const totalInspectionsCount = inspections.length || 1;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-700" /> Infrastructure & Inspection Analytics
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Live summary of registered infrastructure assets and inspection statuses.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800"
                    >
                        <option value="all">All Infrastructure Types</option>
                        <option value="bridge">Bridges</option>
                        <option value="road">Roads</option>
                        <option value="building">Buildings</option>
                        <option value="dam">Dams</option>
                        <option value="tunnel">Tunnels</option>
                        <option value="concrete_structure">Concrete Structures</option>
                        <option value="retaining_wall">Retaining Walls</option>
                        <option value="industrial_structure">Industrial Structures</option>
                    </select>

                    <button
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-medium transition"
                    >
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>

                    <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-md text-xs font-medium transition"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium transition"
                    >
                        <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Registered Assets by Category</h3>
                    <p className="text-xs text-slate-500 mb-6">Breakdown of active infrastructure assets in database</p>

                    {typeRows.length === 0 ? (
                        <p className="text-xs text-slate-400 py-8 text-center">No assets registered yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {typeRows.map((row) => {
                                const pct = Math.round((row.count / totalAssetsCount) * 100);
                                return (
                                    <div key={row.type} className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="font-medium text-slate-700">{row.label}</span>
                                            <span className="font-mono text-slate-500">
                                                {row.count} ({pct}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                style={{ width: `${pct}%` }}
                                                className="h-full bg-cyan-600 rounded-full"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Inspection Workflow Status</h3>
                    <p className="text-xs text-slate-500 mb-6">Distribution across planned, active, and completed audits</p>

                    <div className="space-y-4">
                        {[
                            { label: "Planned", count: statusCounts.planned, color: "bg-slate-500" },
                            { label: "In Progress", count: statusCounts.in_progress, color: "bg-amber-500" },
                            { label: "Completed", count: statusCounts.completed, color: "bg-emerald-600" },
                            { label: "Cancelled", count: statusCounts.cancelled, color: "bg-rose-500" },
                        ].map((item) => {
                            const pct = inspections.length ? Math.round((item.count / totalInspectionsCount) * 100) : 0;
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
        </div>
    );
}