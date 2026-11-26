import { useState, useEffect, useRef } from "react";
import { MapPin, Filter, ExternalLink, Navigation, Layers } from "lucide-react";
import { apiRequest, normalizeAsset } from "../api/client";

function severityMarkerColor(sev) {
    const s = String(sev || "").toLowerCase();
    if (s.includes("critical") || s.includes("severe")) return "#e11d48";
    if (s.includes("moderate") || s.includes("minor")) return "#f59e0b";
    if (s.includes("no visible") || s.includes("safe")) return "#10b981";
    return "#06b6d4";
}

export default function DamageMapView() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");
    const [selectedAsset, setSelectedAsset] = useState(null);

    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersLayerRef = useRef(null);

    useEffect(() => {
        async function loadMap() {
            try {
                const mapItems = await apiRequest("/dashboard/map");
                const normalized = (Array.isArray(mapItems) ? mapItems : []).map((m) => ({
                    ...normalizeAsset(m),
                    latestSeverity: m.latest_severity || "Not assessed",
                    latestPriority: m.latest_priority || null,
                    latestInspectionDate: m.latest_inspection_date || null,
                }));
                setAssets(normalized);
                const withCoords = normalized.find((a) => a.latitude !== null && a.longitude !== null);
                setSelectedAsset(withCoords || normalized[0] || null);
            } catch {
                // fallback if needed
            } finally {
                setLoading(false);
            }
        }
        loadMap();
    }, []);

    const geoAssets = assets.filter((a) => a.latitude !== null && a.longitude !== null);
    const filtered = geoAssets.filter((a) => {
        const typeOk = typeFilter === "all" || (a.asset_type || a.rawType) === typeFilter;
        const sev = String(a.latestSeverity || "").toLowerCase();
        const sevOk =
            severityFilter === "all" ||
            (severityFilter === "critical" && (sev.includes("critical") || sev.includes("severe"))) ||
            (severityFilter === "moderate" && (sev.includes("moderate") || sev.includes("minor"))) ||
            (severityFilter === "safe" && (sev.includes("no visible") || sev.includes("not assessed")));
        return typeOk && sevOk;
    });

    useEffect(() => {
        const L = window.L;
        if (!L || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: [22.9734, 78.6569],
                zoom: 5,
            });
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);
            markersLayerRef.current = L.layerGroup().addTo(map);
            mapInstanceRef.current = map;
        }

        const map = mapInstanceRef.current;
        const layerGroup = markersLayerRef.current;
        layerGroup.clearLayers();

        const bounds = [];
        filtered.forEach((asset) => {
            const lat = Number(asset.latitude);
            const lng = Number(asset.longitude);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return;
            bounds.push([lat, lng]);

            const color = severityMarkerColor(asset.latestSeverity);
            const isSelected = selectedAsset?.id === asset.id;

            const marker = L.circleMarker([lat, lng], {
                radius: isSelected ? 11 : 8,
                fillColor: color,
                color: isSelected ? "#0f172a" : "#ffffff",
                weight: isSelected ? 3 : 2,
                opacity: 1,
                fillOpacity: 0.9,
            });

            marker.bindPopup(
                `<div style="font-family:sans-serif;font-size:12px;">
                    <strong>${asset.assetCode} — ${asset.name}</strong><br/>
                    Type: ${asset.type}<br/>
                    Latest Severity: <strong>${asset.latestSeverity}</strong>
                </div>`
            );

            marker.on("click", () => {
                setSelectedAsset(asset);
            });

            marker.addTo(layerGroup);
        });

        if (bounds.length === 1) {
            map.setView(bounds[0], 13);
        } else if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
    }, [filtered.length, selectedAsset?.id, typeFilter, severityFilter]);

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-700" /> Geospatial Infrastructure Damage Map (OpenStreetMap)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Live severity risk pins from /api/dashboard/map ({geoAssets.length} geotagged assets).
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        {[
                            { value: "all", label: "All Severity" },
                            { value: "critical", label: "Severe / Critical" },
                            { value: "moderate", label: "Minor / Moderate" },
                            { value: "safe", label: "Safe / Unassessed" },
                        ].map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setSeverityFilter(s.value)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                                    severityFilter === s.value
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="border border-slate-200 rounded-md px-2.5 py-1 text-xs bg-white text-slate-700"
                    >
                        <option value="all">All Asset Types</option>
                        <option value="bridge">Bridges</option>
                        <option value="road">Roads</option>
                        <option value="building">Buildings</option>
                        <option value="dam">Dams</option>
                        <option value="tunnel">Tunnels</option>
                        <option value="concrete_structure">Concrete Structures</option>
                        <option value="retaining_wall">Retaining Walls</option>
                        <option value="industrial_structure">Industrial Structures</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 relative h-[460px] bg-slate-100">
                    <div ref={mapContainerRef} className="w-full h-full z-0" />

                    {!loading && filtered.length === 0 && (
                        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center p-6">
                            <div className="bg-white/95 border border-slate-200 shadow-md rounded-xl p-4 text-center max-w-sm">
                                <p className="text-xs text-slate-600">
                                    No geotagged assets match this filter. Add Latitude & Longitude in the{" "}
                                    <strong>Assets</strong> tab to plot markers on OpenStreetMap.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 z-10 bg-white/95 border border-slate-200 shadow-sm rounded-lg px-3.5 py-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Severe / Critical
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Minor / Moderate
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> No Visible Damage
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Not Assessed
                        </span>
                    </div>
                </div>

                <div className="p-6 flex flex-col justify-between bg-slate-50/60 border-t lg:border-t-0 lg:border-l border-slate-200">
                    {selectedAsset ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold text-cyan-700">
                                    {selectedAsset.assetCode}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800">
                                    {selectedAsset.latestSeverity}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-slate-900">{selectedAsset.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-cyan-600" />{" "}
                                    {selectedAsset.location || "No address specified"} ({selectedAsset.type})
                                </p>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">GPS Coordinates</span>
                                    <span className="font-mono font-medium text-slate-800">
                                        {selectedAsset.latitude !== null && selectedAsset.longitude !== null
                                            ? `${Number(selectedAsset.latitude).toFixed(4)}, ${Number(selectedAsset.longitude).toFixed(4)}`
                                            : "Not set"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Priority</span>
                                    <span className="font-medium text-slate-800">
                                        {selectedAsset.latestPriority || "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Latest Inspection Date</span>
                                    <span className="font-medium text-slate-800">
                                        {selectedAsset.latestInspectionDate || "—"}
                                    </span>
                                </div>
                            </div>

                            {selectedAsset.latitude !== null && selectedAsset.longitude !== null && (
                                <a
                                    href={`https://www.google.com/maps?q=${selectedAsset.latitude},${selectedAsset.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                >
                                    <Navigation className="w-3.5 h-3.5" /> Open coordinates in Google Maps{" "}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">Select an asset marker on the map to view details.</p>
                    )}

                    <div className="pt-4 border-t border-slate-200">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Geotagged Assets ({filtered.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {filtered.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setSelectedAsset(item);
                                        if (mapInstanceRef.current && item.latitude && item.longitude) {
                                            mapInstanceRef.current.setView([Number(item.latitude), Number(item.longitude)], 14);
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                                        selectedAsset?.id === item.id
                                            ? "bg-slate-900 text-white"
                                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                                    }`}
                                >
                                    <span className="truncate font-medium">{item.name}</span>
                                    <span className="font-mono text-[10px] opacity-75">{item.latestSeverity}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
