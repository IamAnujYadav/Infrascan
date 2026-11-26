import { useState, useEffect } from "react";
import { Search, Plus, Edit2, MapPin, X, CheckCircle2, AlertCircle, Archive, RotateCcw, Upload } from "lucide-react";
import { apiRequest, normalizeAsset, unwrapItems } from "../api/client";

const FALLBACK_ASSET_TYPES = [
    { value: "building", label: "Building" },
    { value: "bridge", label: "Bridge" },
    { value: "road", label: "Road" },
    { value: "tunnel", label: "Tunnel" },
    { value: "dam", label: "Dam" },
    { value: "concrete_structure", label: "Concrete structure" },
    { value: "retaining_wall", label: "Retaining wall" },
    { value: "industrial_structure", label: "Industrial structure" },
];

const FALLBACK_FREQUENCIES = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Every 3 months" },
    { value: "half_yearly", label: "Every 6 months" },
    { value: "yearly", label: "Yearly" },
];

export default function AssetsView({ userRole }) {
    const normalizedRole = String(userRole || "").toLowerCase();
    const canManageAssets = ["civil_engineer", "manager", "admin", "civil engineer", "infrastructure manager", "administrator"].includes(normalizedRole);
    const canArchiveAssets = ["manager", "admin", "infrastructure manager", "administrator"].includes(normalizedRole);

    const [assets, setAssets] = useState([]);
    const [assetTypes, setAssetTypes] = useState(FALLBACK_ASSET_TYPES);
    const [frequencies, setFrequencies] = useState(FALLBACK_FREQUENCIES);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [includeArchived, setIncludeArchived] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [statusNotice, setStatusNotice] = useState(null);

    const [assetCode, setAssetCode] = useState("");
    const [name, setName] = useState("");
    const [assetType, setAssetType] = useState("bridge");
    const [location, setLocation] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [constructionYear, setConstructionYear] = useState("");
    const [materialType, setMaterialType] = useState("");
    const [responsibleDepartment, setResponsibleDepartment] = useState("");
    const [inspectionFrequency, setInspectionFrequency] = useState("yearly");
    const [saving, setSaving] = useState(false);
    const [csvImporting, setCsvImporting] = useState(false);

    const handleCsvImport = async (e) => {
        const csvFile = e.target.files?.[0];
        e.target.value = "";
        if (!csvFile) return;

        setCsvImporting(true);
        setStatusNotice(null);
        try {
            const text = await csvFile.text();
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            if (lines.length < 2) {
                throw new Error("CSV must have a header row and at least one asset row.");
            }
            const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
            const validTypes = new Set(assetTypes.map((t) => t.value));
            let createdCount = 0;
            const createdItems = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = cols[idx] ?? "";
                });
                const rawType = (row.asset_type || row.type || "bridge").toLowerCase().replace(/\s+/g, "_");
                const payload = {
                    name: row.name || `Imported Asset ${i}`,
                    asset_type: validTypes.has(rawType) ? rawType : "bridge",
                    ...(row.asset_code ? { asset_code: row.asset_code } : {}),
                    location: row.location || "",
                    latitude: row.latitude ? parseFloat(row.latitude) : null,
                    longitude: row.longitude ? parseFloat(row.longitude) : null,
                    construction_year: row.construction_year ? parseInt(row.construction_year, 10) : null,
                    material_type: row.material_type || "",
                    responsible_department: row.responsible_department || "",
                    inspection_frequency: row.inspection_frequency || "yearly",
                };
                const created = await apiRequest("/assets", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                createdItems.push(normalizeAsset(created));
                createdCount++;
            }
            setAssets((prev) => [...createdItems.reverse(), ...prev]);
            setStatusNotice({ type: "success", text: `Imported ${createdCount} asset(s) from CSV.` });
        } catch (err) {
            setStatusNotice({ type: "error", text: err.message || "CSV import failed." });
        } finally {
            setCsvImporting(false);
        }
    };

    const loadAssets = async (showArchived = includeArchived) => {
        setLoading(true);
        try {
            const query = showArchived && canArchiveAssets ? "?include_archived=true&limit=200" : "?limit=200";
            const data = await apiRequest(`/assets${query}`);
            setAssets(unwrapItems(data).map(normalizeAsset));
        } catch (err) {
            setStatusNotice({ type: "error", text: err.message || "Could not load assets." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        apiRequest("/asset-options")
            .then((opts) => {
                if (Array.isArray(opts?.asset_types) && opts.asset_types.length > 0) {
                    setAssetTypes(opts.asset_types);
                }
                if (Array.isArray(opts?.inspection_frequencies) && opts.inspection_frequencies.length > 0) {
                    setFrequencies(opts.inspection_frequencies);
                }
            })
            .catch(() => {});
        loadAssets(false);
    }, []);

    const openAddModal = () => {
        setEditingAsset(null);
        setAssetCode("");
        setName("");
        setAssetType("bridge");
        setLocation("");
        setLatitude("");
        setLongitude("");
        setConstructionYear("");
        setMaterialType("");
        setResponsibleDepartment("");
        setInspectionFrequency("yearly");
        setIsModalOpen(true);
    };

    const openEditModal = (asset) => {
        setEditingAsset(asset);
        setAssetCode(asset.asset_code || asset.assetCode || "");
        setName(asset.name || "");
        setAssetType(asset.asset_type || asset.rawType || "bridge");
        setLocation(asset.location || "");
        setLatitude(asset.latitude !== null && asset.latitude !== undefined ? String(asset.latitude) : "");
        setLongitude(asset.longitude !== null && asset.longitude !== undefined ? String(asset.longitude) : "");
        setConstructionYear(asset.construction_year ? String(asset.construction_year) : "");
        setMaterialType(asset.material_type || "");
        setResponsibleDepartment(asset.responsible_department || "");
        setInspectionFrequency(asset.inspection_frequency || "yearly");
        setIsModalOpen(true);
    };

    const handleSaveAsset = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusNotice(null);

        const basePayload = {
            name: name.trim(),
            asset_type: assetType,
            location: location.trim(),
            latitude: latitude !== "" ? parseFloat(latitude) : null,
            longitude: longitude !== "" ? parseFloat(longitude) : null,
            construction_year: constructionYear !== "" ? parseInt(constructionYear, 10) : null,
            material_type: materialType.trim(),
            responsible_department: responsibleDepartment.trim(),
            inspection_frequency: inspectionFrequency,
        };

        try {
            if (editingAsset) {
                const updated = await apiRequest(`/assets/${editingAsset.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(basePayload),
                });
                const normalized = normalizeAsset(updated);
                setAssets((prev) => prev.map((a) => (a.id === editingAsset.id ? normalized : a)));
                setStatusNotice({ type: "success", text: `Updated "${normalized.name}" (${normalized.assetCode}).` });
            } else {
                const createPayload = {
                    ...basePayload,
                    ...(assetCode.trim() ? { asset_code: assetCode.trim() } : {}),
                };
                const created = await apiRequest("/assets", {
                    method: "POST",
                    body: JSON.stringify(createPayload),
                });
                const normalized = normalizeAsset(created);
                setAssets((prev) => [normalized, ...prev]);
                setStatusNotice({ type: "success", text: `Registered "${normalized.name}" (${normalized.assetCode}).` });
            }
            setIsModalOpen(false);
        } catch (err) {
            setStatusNotice({ type: "error", text: err.message || "Failed to save asset." });
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (asset) => {
        setStatusNotice(null);
        try {
            const updated = asset.is_active === false
                ? await apiRequest(`/assets/${asset.id}/restore`, { method: "POST" })
                : await apiRequest(`/assets/${asset.id}`, { method: "DELETE" });
            const normalized = normalizeAsset(updated);
            setAssets((prev) =>
                prev
                    .map((a) => (a.id === asset.id ? normalized : a))
                    .filter((a) => includeArchived || a.is_active !== false)
            );
            setStatusNotice({
                type: "success",
                text: normalized.is_active === false
                    ? `Archived "${normalized.name}".`
                    : `Restored "${normalized.name}".`,
            });
        } catch (err) {
            setStatusNotice({ type: "error", text: err.message || "Action failed." });
        }
    };

    const filteredAssets = assets.filter((asset) => {
        const matchesSearch =
            asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(asset.assetCode || asset.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "all" || (asset.asset_type || asset.rawType) === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base">Infrastructure Assets Registry</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Manage bridges, roads, tunnels, buildings, and dams with GPS coordinates and inspection schedules.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {canArchiveAssets && (
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-2 rounded-md cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeArchived}
                                onChange={(e) => {
                                    setIncludeArchived(e.target.checked);
                                    loadAssets(e.target.checked);
                                }}
                                className="accent-cyan-700"
                            />
                            Show archived
                        </label>
                    )}
                    {canManageAssets && (
                        <>
                            <label
                                title="CSV columns: name,asset_type,location,latitude,longitude,material_type"
                                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5 text-cyan-700" />
                                {csvImporting ? "Importing..." : "Import CSV"}
                                <input type="file" accept=".csv,text/csv" onChange={handleCsvImport} className="hidden" />
                            </label>
                            <button
                                onClick={openAddModal}
                                className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
                            >
                                <Plus className="w-4 h-4" /> Add Asset (Manual)
                            </button>
                        </>
                    )}
                </div>
            </div>

            {statusNotice && (
                <div
                    className={`mx-5 mt-4 p-3 rounded-md text-xs flex items-center gap-2 ${
                        statusNotice.type === "success"
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

            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by asset name, code, or location..."
                        className="w-full bg-white border border-slate-200 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        onClick={() => setTypeFilter("all")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            typeFilter === "all"
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        All Types
                    </button>
                    {assetTypes.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setTypeFilter(t.value)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                typeFilter === t.value
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                            <th className="py-3 px-6">Asset Code & Name</th>
                            <th className="py-3 px-6">Category</th>
                            <th className="py-3 px-6">Location / GPS</th>
                            <th className="py-3 px-6">Frequency & Material</th>
                            <th className="py-3 px-6">Status</th>
                            <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                                    Loading assets from backend...
                                </td>
                            </tr>
                        ) : filteredAssets.length === 0 ? (
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
                                        <span className="block text-xs font-mono text-slate-400">
                                            {asset.assetCode || asset.id}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-slate-600">{asset.type}</td>
                                    <td className="py-4 px-6 text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>{asset.location || "—"}</span>
                                        </div>
                                        {asset.latitude !== null && asset.longitude !== null && (
                                            <span className="block text-[11px] font-mono text-slate-400 mt-0.5">
                                                {Number(asset.latitude).toFixed(4)}, {Number(asset.longitude).toFixed(4)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-xs text-slate-600">
                                        <span className="capitalize block font-medium text-slate-700">
                                            {String(asset.inspection_frequency || "yearly").replaceAll("_", " ")}
                                        </span>
                                        {asset.material_type && (
                                            <span className="text-slate-400">{asset.material_type}</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                asset.is_active === false
                                                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            }`}
                                        >
                                            {asset.is_active === false ? "Archived" : "Active"}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right space-x-3">
                                        {canManageAssets && asset.is_active !== false && (
                                            <button
                                                onClick={() => openEditModal(asset)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Edit
                                            </button>
                                        )}
                                        {canArchiveAssets && (
                                            <button
                                                onClick={() => handleArchiveToggle(asset)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                                                title={asset.is_active === false ? "Restore asset" : "Archive asset"}
                                            >
                                                {asset.is_active === false ? (
                                                    <>
                                                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                                                    </>
                                                ) : (
                                                    <>
                                                        <Archive className="w-3.5 h-3.5" /> Archive
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden my-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm">
                                {editingAsset
                                    ? `Edit Asset (${editingAsset.assetCode || editingAsset.id})`
                                    : "Register New Infrastructure Asset"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Asset Name *</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={2}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Godavari Bridge Pier 7"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                        Asset Code {!editingAsset && "(Optional)"}
                                    </label>
                                    <input
                                        type="text"
                                        disabled={Boolean(editingAsset)}
                                        value={assetCode}
                                        onChange={(e) => setAssetCode(e.target.value)}
                                        placeholder="Auto (e.g. BRG-0001)"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                                    <select
                                        value={assetType}
                                        onChange={(e) => setAssetType(e.target.value)}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                        {assetTypes.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                        Inspection Frequency
                                    </label>
                                    <select
                                        value={inspectionFrequency}
                                        onChange={(e) => setInspectionFrequency(e.target.value)}
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                        {frequencies.map((freq) => (
                                            <option key={freq.value} value={freq.value}>
                                                {freq.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Location / Corridor</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g., NH-60 Km 112"
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Latitude (GPS)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min={-90}
                                        max={90}
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        placeholder="26.9124"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Longitude (GPS)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        min={-180}
                                        max={180}
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        placeholder="75.7873"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Built Year</label>
                                    <input
                                        type="number"
                                        min={1800}
                                        max={new Date().getFullYear()}
                                        value={constructionYear}
                                        onChange={(e) => setConstructionYear(e.target.value)}
                                        placeholder="2005"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Material Type</label>
                                    <input
                                        type="text"
                                        value={materialType}
                                        onChange={(e) => setMaterialType(e.target.value)}
                                        placeholder="e.g., Reinforced concrete"
                                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Responsible Dept.</label>
                                    <input
                                        type="text"
                                        value={responsibleDepartment}
                                        onChange={(e) => setResponsibleDepartment(e.target.value)}
                                        placeholder="e.g., PWD / Highways"
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
