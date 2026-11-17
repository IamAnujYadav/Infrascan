import { useState, useEffect } from "react";
import { MapPin, Filter, ExternalLink, Navigation } from "lucide-react";
import { apiRequest } from "../api/client";
import type { Asset } from "./AssetsView";

const MAP_ASSETS_FALLBACK: Asset[] = [
    { id: "AST-101", name: "Eastern Viaduct Pier 14", type: "Bridge", location: "Mumbai Corridor", latitude: 19.076, longitude: 72.8777, lastInspected: "2026-10-24", risk: "Critical" },
    { id: "AST-102", name: "North Dam Spillway Gate B", type: "Dam", location: "Koyna Reservoir", latitude: 17.401, longitude: 73.751, lastInspected: "2026-10-23", risk: "Moderate" },
    { id: "AST-103", name: "City Center Metro Overpass", type: "Bridge", location: "Pune Line 2", latitude: 18.5204, longitude: 73.8567, lastInspected: "2026-10-22", risk: "Safe" },
    { id: "AST-104", name: "Mumbai-Pune Expressway Tunnel", type: "Road", location: "Lonavala Km 84", latitude: 18.7557, longitude: 73.4091, lastInspected: "2026-10-21", risk: "Critical" },
    { id: "AST-105", name: "Civic Operations Tower B", type: "Building", location: "Bandra Complex", latitude: 19.0596, longitude: 72.8295, lastInspected: "2026-10-19", risk: "Safe" },
    { id: "AST-106", name: "Girna River Highway Bridge", type: "Bridge", location: "Malegaon NH-60", latitude: 20.5579, longitude: 74.5287, lastInspected: "2026-10-25", risk: "Moderate" },
];

export default function DamageMapView() {
    const [assets, setAssets] = useState<Asset[]>(MAP_ASSETS_FALLBACK);
    const [severityFilter, setSeverityFilter] = useState<string>("All");
    const [selectedAsset, setSelectedAsset] = useState<Asset>(MAP_ASSETS_FALLBACK[0]);

    useEffect(() => {
        apiRequest<Asset[]>("/assets")
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setAssets(data);
                    setSelectedAsset(data[0]);
                }
            })
            .catch(() => { });
    }, []);

    const filtered = assets.filter(
        (a) => severityFilter === "All" || a.risk === severityFilter
    );

    // Project lat/lng onto normalized map viewport (bounds covering Maharashtra corridor 16.5-21.5N, 72.2-75.5E)
    const projectCoords = (lat = 19.0, lng = 73.5) => {
        const minLat = 16.8;
        const maxLat = 21.2;
        const minLng = 72.3;
        const maxLng = 75.2;
        const x = Math.min(92, Math.max(8, ((lng - minLng) / (maxLng - minLng)) * 100));
        const y = Math.min(90, Math.max(10, (1 - (lat - minLat) / (maxLat - minLat)) * 100));
        return { x, y };
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-bold text-slate-900 text-base">Geospatial Infrastructure Damage Map</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        GPS-plotted bridges, roads, buildings, and dams color-coded by structural damage severity.
                    </p>
                </div>

                <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    {["All", "Critical", "Moderate", "Safe"].map((level) => (
                        <button
                            key={level}
                            onClick={() => setSeverityFilter(level)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${severityFilter === level
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Interactive Map Canvas */}
                <div className="lg:col-span-2 relative h-[440px] bg-[#0b192c] overflow-hidden select-none">
                    {/* Topographic Grid & Corridor Lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="geo-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#38bdf8" strokeWidth="0.6" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#geo-grid)" />
                        {/* Simulated highway & river corridors */}
                        <path d="M 80 390 Q 240 280 360 210 T 680 75" fill="none" stroke="#0284c7" strokeWidth="3" strokeDasharray="6 6" />
                        <path d="M 140 120 Q 320 220 510 340" fill="none" stroke="#64748b" strokeWidth="2" />
                    </svg>

                    {/* Plotted GPS Pins */}
                    {filtered.map((asset) => {
                        const { x, y } = projectCoords(asset.latitude, asset.longitude);
                        const isSelected = selectedAsset?.id === asset.id;
                        const pinColor =
                            asset.risk === "Critical"
                                ? "bg-rose-500 ring-rose-400/40"
                                : asset.risk === "Moderate"
                                    ? "bg-amber-400 ring-amber-300/40"
                                    : "bg-emerald-400 ring-emerald-300/40";

                        return (
                            <button
                                key={asset.id}
                                type="button"
                                onClick={() => setSelectedAsset(asset)}
                                style={{ left: `${x}%`, top: `${y}%` }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                            >
                                <span
                                    className={`block w-4 h-4 rounded-full ${pinColor} ring-8 transition-transform ${isSelected ? "scale-125 ring-12" : "group-hover:scale-110"
                                        }`}
                                />
                                <span className="mt-1.5 block px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-medium text-white whitespace-nowrap shadow">
                                    {asset.name}
                                </span>
                            </button>
                        );
                    })}

                    {/* Map Legend */}
                    <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 rounded-lg px-3.5 py-2 flex items-center gap-4 text-[11px] text-slate-300">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Critical
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Moderate
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Safe
                        </span>
                    </div>
                </div>

                {/* Right Panel: Selected Asset Telemetry */}
                <div className="p-6 flex flex-col justify-between bg-slate-50/60 border-t lg:border-t-0 lg:border-l border-slate-200">
                    {selectedAsset ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-slate-500">{selectedAsset.id}</span>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedAsset.risk === "Critical"
                                        ? "bg-rose-100 text-rose-700"
                                        : selectedAsset.risk === "Moderate"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-emerald-100 text-emerald-700"
                                        }`}
                                >
                                    {selectedAsset.risk}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-slate-900">{selectedAsset.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-cyan-600" /> {selectedAsset.location} ({selectedAsset.type})
                                </p>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">GPS Coordinates</span>
                                    <span className="font-mono font-medium text-slate-800">
                                        {selectedAsset.latitude?.toFixed(4) ?? "19.0760"}° N, {selectedAsset.longitude?.toFixed(4) ?? "72.8777"}° E
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Last Inspection</span>
                                    <span className="font-medium text-slate-800">{selectedAsset.lastInspected}</span>
                                </div>
                            </div>

                            {selectedAsset.latitude && selectedAsset.longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${selectedAsset.latitude},${selectedAsset.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                >
                                    <Navigation className="w-3.5 h-3.5" /> Open coordinates in Google Maps <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ) : null}

                    <div className="pt-4 border-t border-slate-200">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Plotted Assets ({filtered.length})
                        </span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {filtered.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedAsset(item)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${selectedAsset?.id === item.id
                                        ? "bg-slate-900 text-white"
                                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                >
                                    <span className="truncate font-medium">{item.name}</span>
                                    <span className="font-mono text-[10px] opacity-75">{item.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
