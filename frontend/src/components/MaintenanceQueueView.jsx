import { useState, useEffect } from "react";
import { Wrench, Plus, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { apiRequest, normalizeAsset, unwrapItems } from "../api/client";

export default function MaintenanceQueueView({ userRole }) {
    const normalizedRole = String(userRole || "").toLowerCase();
    const canRecordMaintenance = [
        "admin",
        "manager",
        "civil_engineer",
        "maintenance_engineer",
        "administrator",
        "infrastructure manager",
        "civil engineer",
        "maintenance engineer",
    ].includes(normalizedRole);

    const [assets, setAssets] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState("");
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    const [performedOn, setPerformedOn] = useState(() => new Date().toISOString().split("T")[0]);
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState(null);

    const loadRecords = async (assetId) => {
        if (!assetId) {
            setRecords([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await apiRequest(`/assets/${assetId}/maintenance`);
            setRecords(Array.isArray(data) ? data : []);
        } catch (err) {
            setNotice({ type: "error", text: err.message || "Could not load maintenance history." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        apiRequest("/assets?limit=200")
            .then((data) => {
                const items = unwrapItems(data).map(normalizeAsset);
                setAssets(items);
                if (items.length > 0) {
                    const firstId = String(items[0].id);
                    setSelectedAssetId(firstId);
                    loadRecords(firstId);
                } else {
                    setLoading(false);
                }
            })
            .catch(() => setLoading(false));
    }, []);

    const handleAssetChange = (newId) => {
        setSelectedAssetId(newId);
        setNotice(null);
        loadRecords(newId);
    };

    const handleAddRecord = async (e) => {
        e.preventDefault();
        if (!selectedAssetId || !description.trim()) return;
        setSubmitting(true);
        setNotice(null);
        try {
            const created = await apiRequest(`/assets/${selectedAssetId}/maintenance`, {
                method: "POST",
                body: JSON.stringify({
                    performed_on: performedOn,
                    description: description.trim(),
                }),
            });
            setRecords((prev) => [created, ...prev]);
            setDescription("");
            setNotice({ type: "success", text: "Maintenance record saved to database." });
        } catch (err) {
            setNotice({ type: "error", text: err.message || "Failed to log maintenance record." });
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAsset = assets.find((a) => String(a.id) === String(selectedAssetId));

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-cyan-700" /> Infrastructure Maintenance Log & History
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        View and record completed structural repairs and maintenance interventions per asset.
                    </p>
                </div>

                <select
                    value={selectedAssetId}
                    onChange={(e) => handleAssetChange(e.target.value)}
                    className="border border-slate-200 rounded-md px-3 py-2 text-xs font-medium bg-slate-50 text-slate-800"
                >
                    {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                            {asset.assetCode} — {asset.name} ({asset.type})
                        </option>
                    ))}
                </select>
            </div>

            {notice && (
                <div
                    className={`p-3 rounded-md text-xs flex items-center gap-2 ${
                        notice.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                >
                    {notice.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{notice.text}</span>
                </div>
            )}

            {canRecordMaintenance && selectedAssetId && (
                <form
                    onSubmit={handleAddRecord}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
                >
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Performed On *</label>
                        <input
                            type="date"
                            required
                            max={new Date().toISOString().split("T")[0]}
                            value={performedOn}
                            onChange={(e) => setPerformedOn(e.target.value)}
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            Repair / Maintenance Description *
                        </label>
                        <input
                            type="text"
                            required
                            minLength={3}
                            maxLength={1000}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Epoxy crack injection and protective sealant coating on pier 3"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#0e7490] hover:bg-[#155e75] text-white px-4 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" /> {submitting ? "Saving..." : "Log Maintenance"}
                    </button>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                        Maintenance History {selectedAsset ? `— ${selectedAsset.name}` : ""}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{records.length} record(s)</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50/60 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                                <th className="py-3 px-6">Record ID</th>
                                <th className="py-3 px-6">Performed Date</th>
                                <th className="py-3 px-6">Maintenance Work Description</th>
                                <th className="py-3 px-6">Recorded At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                                        Loading maintenance records...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                                        No maintenance records logged for this asset yet.
                                    </td>
                                </tr>
                            ) : (
                                records.map((rec) => (
                                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                                        <td className="py-4 px-6 font-mono text-xs text-slate-500">#{rec.id}</td>
                                        <td className="py-4 px-6 font-mono text-xs text-slate-800 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                                            {rec.performed_on}
                                        </td>
                                        <td className="py-4 px-6 text-xs text-slate-700">{rec.description}</td>
                                        <td className="py-4 px-6 font-mono text-[11px] text-slate-400">
                                            {String(rec.created_at || "").split("T")[0]}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
