import { useState } from "react";
import { ArrowRight, TrendingUp, Calendar } from "lucide-react";

interface HistoricalSnapshot {
    date: string;
    inspectionId: string;
    maxWidthMm: number;
    lengthCm: number;
    areaCm2: number;
    severity: "Safe" | "Moderate" | "Critical";
    crackStrokeWidth: number;
}

const ASSET_HISTORY: Record<string, { name: string; snapshots: HistoricalSnapshot[] }> = {
    "AST-101": {
        name: "Eastern Viaduct Pier 14 (Bridge)",
        snapshots: [
            { date: "2026-04-12", inspectionId: "INS-041", maxWidthMm: 1.4, lengthCm: 34.0, areaCm2: 4.76, severity: "Moderate", crackStrokeWidth: 4 },
            { date: "2026-07-19", inspectionId: "INS-078", maxWidthMm: 1.9, lengthCm: 41.5, areaCm2: 7.89, severity: "Moderate", crackStrokeWidth: 6.5 },
            { date: "2026-10-24", inspectionId: "INS-001", maxWidthMm: 2.4, lengthCm: 48.6, areaCm2: 11.66, severity: "Critical", crackStrokeWidth: 9.5 },
        ],
    },
    "AST-102": {
        name: "North Dam Spillway Gate B (Dam)",
        snapshots: [
            { date: "2026-05-03", inspectionId: "INS-052", maxWidthMm: 0.5, lengthCm: 14.0, areaCm2: 0.7, severity: "Safe", crackStrokeWidth: 3 },
            { date: "2026-10-23", inspectionId: "INS-002", maxWidthMm: 0.9, lengthCm: 19.2, areaCm2: 1.73, severity: "Moderate", crackStrokeWidth: 5 },
        ],
    },
};

export default function HistoricalComparisonView() {
    const [selectedAssetId, setSelectedAssetId] = useState("AST-101");
    const history = ASSET_HISTORY[selectedAssetId];
    const [beforeIdx, setBeforeIdx] = useState(0);
    const [afterIdx, setAfterIdx] = useState(history.snapshots.length - 1);

    const handleAssetChange = (newId: string) => {
        setSelectedAssetId(newId);
        const list = ASSET_HISTORY[newId].snapshots;
        setBeforeIdx(0);
        setAfterIdx(list.length - 1);
    };

    const before = history.snapshots[beforeIdx] || history.snapshots[0];
    const after = history.snapshots[afterIdx] || history.snapshots[history.snapshots.length - 1];

    const widthDelta = +(after.maxWidthMm - before.maxWidthMm).toFixed(2);
    const lengthDelta = +(after.lengthCm - before.lengthCm).toFixed(1);
    const widthPct = before.maxWidthMm > 0 ? Math.round((widthDelta / before.maxWidthMm) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base">Historical Inspection Comparison (Before & After)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Track crack propagation and dimensional deltas across inspection dates for the same asset.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedAssetId}
                        onChange={(e) => handleAssetChange(e.target.value)}
                        className="border border-slate-200 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800"
                    >
                        {Object.entries(ASSET_HISTORY).map(([id, item]) => (
                            <option key={id} value={id}>
                                {id} — {item.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Date Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BEFORE CARD */}
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
                            {history.snapshots.map((snap, idx) => (
                                <option key={snap.inspectionId} value={idx}>
                                    {snap.date} ({snap.inspectionId})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="h-56 rounded-lg bg-slate-900 overflow-hidden relative flex items-center justify-center">
                        <svg viewBox="0 0 600 320" className="w-full h-full">
                            <rect width="600" height="320" fill="#334155" />
                            <path
                                d="M 140 60 L 210 120 L 280 165 L 360 220"
                                fill="none"
                                stroke="#f43f5e"
                                strokeWidth={before.crackStrokeWidth}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute top-3 left-3 bg-slate-950/85 text-slate-200 text-[11px] font-mono px-2.5 py-1 rounded">
                            Width: {before.maxWidthMm} mm • Length: {before.lengthCm} cm
                        </span>
                    </div>
                </div>

                {/* AFTER CARD */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Latest Comparison (After)
                        </span>
                        <select
                            value={afterIdx}
                            onChange={(e) => setAfterIdx(Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono"
                        >
                            {history.snapshots.map((snap, idx) => (
                                <option key={snap.inspectionId} value={idx}>
                                    {snap.date} ({snap.inspectionId})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="h-56 rounded-lg bg-slate-900 overflow-hidden relative flex items-center justify-center">
                        <svg viewBox="0 0 600 320" className="w-full h-full">
                            <rect width="600" height="320" fill="#334155" />
                            <path
                                d="M 140 60 L 210 120 L 280 165 L 360 220 L 445 275"
                                fill="none"
                                stroke="#f43f5e"
                                strokeWidth={after.crackStrokeWidth}
                                strokeLinecap="round"
                            />
                            <path
                                d="M 280 165 L 315 230"
                                fill="none"
                                stroke="#fb7185"
                                strokeWidth={after.crackStrokeWidth * 0.7}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute top-3 left-3 bg-slate-950/85 text-rose-200 text-[11px] font-mono px-2.5 py-1 rounded">
                            Width: {after.maxWidthMm} mm • Length: {after.lengthCm} cm
                        </span>
                    </div>
                </div>
            </div>

            {/* Delta Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-xs text-slate-500">Max Crack Width Change (Δ)</span>
                    <div className="mt-1 flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
                        <span>{before.maxWidthMm} mm</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>{after.maxWidthMm} mm</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${widthDelta > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {widthDelta >= 0 ? `+${widthDelta}` : widthDelta} mm ({widthPct >= 0 ? `+${widthPct}%` : `${widthPct}%`})
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                    <span className="text-xs text-slate-500">Crack Length Propagation (Δ)</span>
                    <div className="mt-1 flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
                        <span>{before.lengthCm} cm</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>{after.lengthCm} cm</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {lengthDelta >= 0 ? `+${lengthDelta}` : lengthDelta} cm
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                    <div>
                        <span className="text-xs text-slate-500">Progression Trend</span>
                        <p className="text-sm font-bold text-rose-700 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" /> Active Structural Growth
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}