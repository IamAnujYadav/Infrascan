import { useState, useEffect } from "react";
import { ArrowRight, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { apiRequest, normalizeAsset, resolveFileUrl, unwrapItems } from "../api/client";

export default function HistoricalComparisonView() {
    const [assets, setAssets] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState("");
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [beforeIdx, setBeforeIdx] = useState(0);
    const [afterIdx, setAfterIdx] = useState(0);

    useEffect(() => {
        apiRequest("/assets?limit=200")
            .then((data) => {
                const items = unwrapItems(data).map(normalizeAsset);
                setAssets(items);
                if (items.length > 0) {
                    setSelectedAssetId(String(items[0].id));
                } else {
                    setLoading(false);
                }
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedAssetId) return;
        setLoading(true);
        apiRequest(`/assets/${selectedAssetId}/inspections?limit=50`)
            .then(async (data) => {
                const inspections = unwrapItems(data).slice().reverse(); // oldest first
                const detailed = await Promise.all(
                    inspections.map(async (ins) => {
                        const res = await apiRequest(`/inspections/${ins.id}/results`).catch(() => null);
                        const firstOk = res?.items?.find((it) => it.analysis?.status === "ok") || res?.items?.[0];
                        const geom = firstOk?.analysis?.result?.segmentation?.geometry || null;
                        return {
                            inspectionId: ins.id,
                            date: ins.inspection_date || ins.scheduled_date || ins.created_at?.split("T")[0] || "Unknown",
                            status: ins.status,
                            severity: res?.summary?.overall_severity || "Not assessed",
                            imageUrl: resolveFileUrl(
                                firstOk?.analysis?.result?.segmentation?.overlay_path ||
                                    firstOk?.image?.url
                            ),
                            maxWidthPx: geom?.max_width ?? 0,
                            lengthPx: geom?.length ?? 0,
                            areaPx: geom?.area ?? 0,
                        };
                    })
                );
                setSnapshots(detailed);
                setBeforeIdx(0);
                setAfterIdx(Math.max(0, detailed.length - 1));
            })
            .catch(() => setSnapshots([]))
            .finally(() => setLoading(false));
    }, [selectedAssetId]);

    const before = snapshots[beforeIdx] || null;
    const after = snapshots[afterIdx] || null;

    const widthDelta = before && after ? +(after.maxWidthPx - before.maxWidthPx).toFixed(2) : 0;
    const lengthDelta = before && after ? +(after.lengthPx - before.lengthPx).toFixed(1) : 0;
    const widthPct = before && before.maxWidthPx > 0 ? Math.round((widthDelta / before.maxWidthPx) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base">
                        Historical Inspection Comparison (Before & After)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Compare real inspection runs and extracted pixel geometry across dates for any registered asset.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        className="border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800"
                    >
                        {assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                                {asset.assetCode} — {asset.name} ({asset.type})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" /> Loading asset inspection history...
                </div>
            ) : snapshots.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                    No inspections recorded for this asset yet. Upload inspection photos to compare progression over time.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* BEFORE */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> Baseline (Before)
                                </span>
                                <select
                                    value={beforeIdx}
                                    onChange={(e) => setBeforeIdx(Number(e.target.value))}
                                    className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono"
                                >
                                    {snapshots.map((snap, idx) => (
                                        <option key={snap.inspectionId} value={idx}>
                                            {snap.date} (Inspection #{snap.inspectionId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="h-56 rounded-lg bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                {before?.imageUrl ? (
                                    <img
                                        src={before.imageUrl}
                                        alt={`Inspection #${before.inspectionId}`}
                                        className="max-h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-400">No analyzed image in this inspection</span>
                                )}
                                {before && (
                                    <span className="absolute top-3 left-3 bg-slate-950/85 text-slate-200 text-[11px] font-mono px-2.5 py-1 rounded">
                                        Width: {before.maxWidthPx} px • Length: {before.lengthPx} px
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* AFTER */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> Comparison (After)
                                </span>
                                <select
                                    value={afterIdx}
                                    onChange={(e) => setAfterIdx(Number(e.target.value))}
                                    className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono"
                                >
                                    {snapshots.map((snap, idx) => (
                                        <option key={snap.inspectionId} value={idx}>
                                            {snap.date} (Inspection #{snap.inspectionId})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="h-56 rounded-lg bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                {after?.imageUrl ? (
                                    <img
                                        src={after.imageUrl}
                                        alt={`Inspection #${after.inspectionId}`}
                                        className="max-h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-400">No analyzed image in this inspection</span>
                                )}
                                {after && (
                                    <span className="absolute top-3 left-3 bg-slate-950/85 text-rose-200 text-[11px] font-mono px-2.5 py-1 rounded">
                                        Width: {after.maxWidthPx} px • Length: {after.lengthPx} px
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {before && after && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                                <span className="text-xs text-slate-500">Max Crack Width Change (Δ)</span>
                                <div className="mt-1 flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
                                    <span>{before.maxWidthPx} px</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{after.maxWidthPx} px</span>
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                            widthDelta > 0
                                                ? "bg-rose-100 text-rose-700"
                                                : "bg-emerald-100 text-emerald-700"
                                        }`}
                                    >
                                        {widthDelta >= 0 ? `+${widthDelta}` : widthDelta} px (
                                        {widthPct >= 0 ? `+${widthPct}%` : `${widthPct}%`})
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                                <span className="text-xs text-slate-500">Crack Length Change (Δ)</span>
                                <div className="mt-1 flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
                                    <span>{before.lengthPx} px</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{after.lengthPx} px</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                        {lengthDelta >= 0 ? `+${lengthDelta}` : lengthDelta} px
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-slate-500">Latest Severity</span>
                                    <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1">
                                        <TrendingUp className="w-4 h-4 text-cyan-700" /> {after.severity}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
