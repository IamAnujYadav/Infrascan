import React, { useState, useEffect } from "react";
import { Search, Plus, Edit2, MapPin, X, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest } from "../api/client";

export interface Asset {
    id: string;
    name: string;
    type: "Bridge" | "Road" | "Building" | "Dam";
    location: string;
    latitude?: number;
    longitude?: number;
    lastInspected: string;
    risk: "Critical" | "Moderate" | "Safe";
}

const INITIAL_ASSETS: Asset[] = [
    { id: "AST-101", name: "Eastern Viaduct Pier 14", type: "Bridge", location: "Sector 4 Highway", latitude: 19.076, longitude: 72.8777, lastInspected: "2026-10-24", risk: "Critical" },
    { id: "AST-102", name: "North Dam Spillway Gate B", type: "Dam", location: "Koyna Reservoir", latitude: 17.401, longitude: 73.751, lastInspected: "2026-10-23", risk: "Moderate" },
    { id: "AST-103", name: "City Center Metro Overpass", type: "Bridge", location: "Downtown Line 2", latitude: 18.5204, longitude: 73.8567, lastInspected: "2026-10-22", risk: "Safe" },
    { id: "AST-104", name: "Mumbai-Pune Expressway Tunnel", type: "Road", location: "Km Marker 84", latitude: 18.7557, longitude: 73.4091, lastInspected: "2026-10-21", risk: "Critical" },
    { id: "AST-105", name: "Civic Operations Tower B", type: "Building", location: "Bandra Complex", latitude: 19.0596, longitude: 72.8295, lastInspected: "2026-10-19", risk: "Safe" },
];

export default function AssetsView() {
    const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("All");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [statusNotice, setStatusNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [type, setType] = useState<Asset["type"]>("Bridge");
    const [location, setLocation] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [risk, setRisk] = useState<Asset["risk"]>("Safe");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiRequest<Asset[]>("/assets")
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) setAssets(data);
            })
            .catch(() => {
                // Keep initial state when backend server is offline
            });
    }, []);

    const openAddModal = () => {
        setEditingAsset(null);
        setName("");
        setType("Bridge");
        setLocation("");
        setLatitude("");
        setLongitude("");
        setRisk("Safe");
        setIsModalOpen(true);
    };

    const openEditModal = (asset: Asset) => {
        setEditingAsset(asset);
        setName(asset.name);
        setType(asset.type);
        setLocation(asset.location);
        setLatitude(asset.latitude !== undefined ? String(asset.latitude) : "");
        setLongitude(asset.longitude !== undefined ? String(asset.longitude) : "");
        setRisk(asset.risk);
        setIsModalOpen(true);
    };

    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatusNotice(null);

        const payload = {
            name,
            type,
            location,
            latitude: latitude ? parseFloat(latitude) : undefined,
            longitude: longitude ? parseFloat(longitude) : undefined,
            risk,
            lastInspected: editingAsset?.lastInspected || new Date().toISOString().split("T")[0],
        };

        try {
            if (editingAsset) {
                const updated = await apiRequest<Asset>(`/assets/${editingAsset.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                }).catch(() => ({ ...editingAsset, ...payload }));

                setAssets((prev) => prev.map((a) => (a.id === editingAsset.id ? updated : a)));
                setStatusNotice({ type: "success", text: `Updated "${name}" successfully.` });
            } else {
                const created = await apiRequest<Asset>("/assets", {
                    method: "POST",
                    body: JSON.stringify(payload),
                }).catch(() => ({
                    id: `AST-${Math.floor(106 + Math.random() * 890)}`,
                    ...payload,
                }));

                setAssets((prev) => [created, ...prev]);
                setStatusNotice({ type: "success", text: `Added "${name}" to registry.` });
            }
            setIsModalOpen(false);
        } catch (err: any) {
            setStatusNotice({ type: "error", text: err.message || "Failed to save asset." });
        } finally {
            setSaving(false);
        }
    };

    const filteredAssets = assets.filter((asset) => {
        const matchesSearch =
            asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "All" || asset.type === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header & Add Button */}
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base">Infrastructure Assets Registry</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Manage bridges, roads, buildings, and dams with GPS coordinates for field inspections.
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" /> Add Asset
                </button>
            </div>

            {/* Status Alert */}
            {statusNotice && (
                <div
                    className={`mx-5 mt-4 p-3 rounded-md text-xs flex items-center gap-2 ${statusNotice.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                >
                    {statusNotice.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{statusNotice.text}</span>
                </div>
            )}

            {/* Search & Category Filter Bar */}
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by asset name, ID, or location..."
                        className="w-full bg-white border border-slate-200 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {["All", "Bridge", "Road", "Building", "Dam"].map((category) => (
                        <button
                            key={category}
                            onClick={() => setTypeFilter(category)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${typeFilter === category
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                        >
                            {category === "All" ? "All Types" : `${category}s`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                            <th className="py-3 px-6">Asset ID & Name</th>
                            <th className="py-3 px-6">Category</th>
                            <th className="py-3 px-6">Location / GPS</th>
                            <th className="py-3 px-6">Last Inspected</th>
                            <th className="py-3 px-6">Risk Status</th>
                            <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredAssets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                                    No infrastructure assets match your current filter.
                                </td>
                            </tr>
                        ) : (
                            filteredAssets.map((asset) => (
                                <tr key={asset.id} className="hover:bg-slate-50 transition">
                                    <td className="py-4 px-6 font-medium text-slate-900">
                                        {asset.name}
                                        <span className="block text-xs font-mono text-slate-400">{asset.id}</span>
                                    </td>
                                    <td className="py-4 px-6 text-slate-600">{asset.type}</td>
                                    <td className="py-4 px-6 text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>{asset.location}</span>
                                        </div>
                                        {asset.latitude !== undefined && asset.longitude !== undefined && (
                                            <span className="block text-[11px] font-mono text-slate-400 mt-0.5">
                                                {asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-slate-600">{asset.lastInspected}</td>
                                    <td className="py-4 px-6">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${asset.risk === "Critical"
                                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                : asset.risk === "Moderate"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                }`}
                                        >
                                            {asset.risk}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => openEditModal(asset)}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Asset Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm">
                                {editingAsset ? `Edit Asset (${editingAsset.id})` : "Register New Infrastructure Asset"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Asset Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Godavari Bridge Pier 7"
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as Asset["type"])}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                        <option value="Bridge">Bridge</option>
                                        <option value="Road">Road</option>
                                        <option value="Building">Building</option>
                                        <option value="Dam">Dam</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Initial Risk Status</label>
                                    <select
                                        value={risk}
                                        onChange={(e) => setRisk(e.target.value as Asset["risk"])}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                        <option value="Safe">Safe</option>
                                        <option value="Moderate">Moderate</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Location / Corridor</label>
                                <input
                                    type="text"
                                    required
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g., NH-60 Km 112"
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Latitude (GPS)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        placeholder="18.5204"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Longitude (GPS)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        placeholder="73.8567"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-xs font-medium transition disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : editingAsset ? "Save Changes" : "Create Asset"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}