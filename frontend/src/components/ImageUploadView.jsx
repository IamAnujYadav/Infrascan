import React, { useState, useEffect } from "react";
import {
    Image as ImageIcon,
    Sliders,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    UploadCloud,
    Zap,
    FolderCheck,
    ExternalLink,
} from "lucide-react";
import { apiRequest, normalizeAsset, resolveFileUrl, unwrapItems } from "../api/client";

export default function ImageUploadView({ onOpenInspection }) {
    const [mode, setMode] = useState("inspection"); // "inspection" | "quick"
    const [assets, setAssets] = useState([]);
    const [existingInspections, setExistingInspections] = useState([]);
    const [inspectionChoice, setInspectionChoice] = useState("new"); // "new" or inspection id
    const [selectedAssetId, setSelectedAssetId] = useState("");
    const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");

    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusStep, setStatusStep] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiRequest("/assets?limit=200")
            .then((data) => {
                const items = unwrapItems(data).map(normalizeAsset);
                if (items.length > 0) {
                    setAssets(items);
                    setSelectedAssetId(String(items[0].id));
                }
            })
            .catch(() => {});

        apiRequest("/inspections?limit=100")
            .then((data) => {
                const openOnes = unwrapItems(data).filter(
                    (ins) => !["completed", "cancelled"].includes(String(ins.status || "").toLowerCase())
                );
                setExistingInspections(openOnes);
            })
            .catch(() => {});
    }, []);

    const handleFileSelect = (chosenFile) => {
        const validExt = /\.(jpg|jpeg|png)$/i.test(chosenFile.name);
        if (!validExt && !["image/jpeg", "image/png"].includes(chosenFile.type)) {
            setError("Unsupported format. Backend allows JPG, JPEG, or PNG images only.");
            return;
        }
        if (chosenFile.size > 20 * 1024 * 1024) {
            setError("File exceeds the 20 MB backend limit.");
            return;
        }
        setError(null);
        setFile(chosenFile);
        setPreviewUrl(URL.createObjectURL(chosenFile));
        setResult(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const pollInspectionResult = async (inspectionId, imageId) => {
        for (let attempt = 0; attempt < 25; attempt++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
                const analysisRow = await apiRequest(`/inspections/${inspectionId}/images/${imageId}/analysis`);
                if (analysisRow && !["queued", "running"].includes(analysisRow.status)) {
                    return analysisRow;
                }
            } catch {
                // Keep polling until record is ready
            }
        }
        return null;
    };

    const handleSubmitPipeline = async () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);

        try {
            if (mode === "quick") {
                setStatusStep("Running AI pipeline (/api/analyze)...");
                const formData = new FormData();
                formData.append("file", file);
                const quickRes = await apiRequest("/analyze", {
                    method: "POST",
                    body: formData,
                });
                setResult({
                    mode: "quick",
                    quick: quickRes,
                });
                return;
            }

            // Inspection workflow
            let targetInspectionId = inspectionChoice !== "new" ? Number(inspectionChoice) : null;

            if (!targetInspectionId) {
                if (!selectedAssetId) {
                    throw new Error("Please select an infrastructure asset before creating an inspection.");
                }
                setStatusStep("Creating inspection record...");
                const inspection = await apiRequest("/inspections", {
                    method: "POST",
                    body: JSON.stringify({
                        asset_id: Number(selectedAssetId),
                        scheduled_date: inspectionDate || null,
                        notes: notes.trim(),
                    }),
                });
                targetInspectionId = inspection.id;
            }

            setStatusStep("Uploading image & running quality checks...");
            const formData = new FormData();
            formData.append("file", file);
            if (latitude !== "") formData.append("latitude", String(parseFloat(latitude)));
            if (longitude !== "") formData.append("longitude", String(parseFloat(longitude)));

            const uploadedImage = await apiRequest(`/inspections/${targetInspectionId}/images`, {
                method: "POST",
                body: formData,
            });

            setStatusStep("Queueing AI analysis in background...");
            let started = null;
            let completedAnalysis = null;
            try {
                started = await apiRequest(`/inspections/${targetInspectionId}/analyze`, {
                    method: "POST",
                    body: JSON.stringify({ image_ids: [uploadedImage.id], force: false }),
                });
                setStatusStep("Running ResNet50, YOLOv8 & U-Net models (~4s)...");
                completedAnalysis = await pollInspectionResult(targetInspectionId, uploadedImage.id);
            } catch (analysisErr) {
                // Image upload succeeded; analysis can still be triggered from the inspection report modal
            }

            setResult({
                mode: "inspection",
                inspection_id: targetInspectionId,
                image: uploadedImage,
                started,
                analysis: completedAnalysis,
            });
        } catch (err) {
            setError(err.message || "Image upload failed. Please check the backend connection.");
        } finally {
            setIsProcessing(false);
            setStatusStep("");
        }
    };

    const previewOverlayUrl = (() => {
        if (!result) return previewUrl;
        if (result.mode === "quick") {
            return (
                resolveFileUrl(result.quick?.segmentation?.overlay_path) ||
                resolveFileUrl(result.quick?.detection?.annotated_image_path) ||
                resolveFileUrl(result.quick?.classification?.heatmap_path) ||
                previewUrl
            );
        }
        const aiRes = result.analysis?.result;
        return (
            resolveFileUrl(aiRes?.segmentation?.overlay_path) ||
            resolveFileUrl(aiRes?.detection?.annotated_image_path) ||
            resolveFileUrl(aiRes?.classification?.heatmap_path) ||
            resolveFileUrl(result.image?.url) ||
            previewUrl
        );
    })();

    const activeAiSummary = result?.mode === "quick" ? result.quick : result?.analysis?.result;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900 mb-1">
                        Site Image Upload & AI Inspection Pipeline
                    </h2>
                    <p className="text-xs text-slate-500">
                        Upload JPG/PNG photos (max 20 MB) to run quality checks, ResNet50 classification, YOLOv8 detection, and U-Net segmentation.
                    </p>
                </div>

                <div className="inline-flex rounded-lg bg-slate-100 p-1 self-start">
                    <button
                        type="button"
                        onClick={() => {
                            setMode("inspection");
                            setResult(null);
                            setError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            mode === "inspection" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <FolderCheck className="w-3.5 h-3.5 text-cyan-700" /> Save to Inspection
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode("quick");
                            setResult(null);
                            setError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            mode === "quick" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        <Zap className="w-3.5 h-3.5 text-amber-600" /> Quick Scan (/api/analyze)
                    </button>
                </div>
            </div>

            {mode === "inspection" && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Inspection Target</label>
                            <select
                                value={inspectionChoice}
                                onChange={(e) => setInspectionChoice(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                            >
                                <option value="new">+ Create New Inspection</option>
                                {existingInspections.map((ins) => (
                                    <option key={ins.id} value={ins.id}>
                                        Inspection #{ins.id} — {ins.asset_name} ({ins.status})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {inspectionChoice === "new" && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                        Target Infrastructure Asset *
                                    </label>
                                    <select
                                        value={selectedAssetId}
                                        onChange={(e) => setSelectedAssetId(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                        {assets.map((asset) => (
                                            <option key={asset.id} value={asset.id}>
                                                {asset.assetCode || asset.id} — {asset.name} ({asset.type})
                                            </option>
                                        ))}
                                    </select>
                                    {assets.length === 0 && (
                                        <p className="text-[11px] text-amber-700 mt-1">
                                            No assets found. Register an asset in the Assets tab first.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Date</label>
                                    <input
                                        type="date"
                                        value={inspectionDate}
                                        onChange={(e) => setInspectionDate(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {inspectionChoice === "new" && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Field Notes (Optional)</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g., North abutment soffit close-up"
                                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Photo Latitude (Optional)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min={-90}
                                max={90}
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                placeholder="e.g., 26.9124"
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Photo Longitude (Optional)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min={-180}
                                max={180}
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                placeholder="e.g., 75.7873"
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                            />
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-md p-3 flex items-center gap-2 text-xs text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {!previewUrl ? (
                <label
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition ${
                        isDragging
                            ? "border-cyan-600 bg-cyan-50/50"
                            : "border-slate-300 hover:border-cyan-500 bg-slate-50/50"
                    }`}
                >
                    <UploadCloud className="w-10 h-10 text-cyan-600 mb-3" />
                    <span className="text-sm font-medium text-slate-700">
                        Drag and drop site photo here, or click to browse
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                        Supports PNG, JPG, JPEG (Min 224px side, Max 20 MB)
                    </span>
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        className="hidden"
                    />
                </label>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Original Site Image
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">{file?.name}</span>
                            </div>
                            <div className="h-64 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                                <img src={previewUrl} alt="Original site upload" className="max-h-full object-contain" />
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Preprocessing & AI Detection Output
                            </span>
                            <div className="h-64 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center relative">
                                {isProcessing ? (
                                    <div className="text-center text-slate-300 space-y-2 px-4">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                                        <p className="text-xs">{statusStep || "Processing image..."}</p>
                                    </div>
                                ) : result ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img
                                            src={previewOverlayUrl}
                                            alt="AI detection overlay"
                                            className="max-h-full object-contain"
                                        />
                                        <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 border border-cyan-500/40 rounded-lg p-3 text-left space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-cyan-300 font-semibold">
                                                    {result.mode === "quick"
                                                        ? `Quick Analysis Complete (${result.quick.status})`
                                                        : `Inspection #${result.inspection_id} — ${
                                                              result.analysis?.status === "ok"
                                                                  ? "Analysis Complete"
                                                                  : "Image Uploaded & Queued"
                                                          }`}
                                                </span>
                                                {activeAiSummary?.severity && (
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                                                        {activeAiSummary.severity.category} ({activeAiSummary.severity.score}/100)
                                                    </span>
                                                )}
                                            </div>
                                            {activeAiSummary && (
                                                <p className="text-[11px] text-slate-300">
                                                    Crack detected: <strong>{activeAiSummary.crack_detected ? "Yes" : "No"}</strong>
                                                    {activeAiSummary.damage_types?.length > 0 &&
                                                        ` • Types: ${activeAiSummary.damage_types.join(", ")}`}
                                                    {activeAiSummary.segmentation?.geometry &&
                                                        ` • Length: ${activeAiSummary.segmentation.geometry.length} px, Max Width: ${activeAiSummary.segmentation.geometry.max_width} px`}
                                                </p>
                                            )}
                                            {(result.image?.warnings?.length > 0 || activeAiSummary?.warnings?.length > 0) && (
                                                <p className="text-[10px] text-amber-300">
                                                    Warnings:{" "}
                                                    {[...(result.image?.warnings || []), ...(activeAiSummary?.warnings || [])].join("; ")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 text-xs px-4 flex flex-col items-center gap-2">
                                        <ImageIcon className="w-6 h-6 text-slate-500" />
                                        <span>Click &quot;Submit to Pipeline&quot; to analyze this image.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                        <button
                            onClick={() => {
                                setFile(null);
                                setPreviewUrl(null);
                                setResult(null);
                                setError(null);
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                        >
                            Choose a different image
                        </button>

                        <div className="flex items-center gap-3">
                            {result?.mode === "inspection" && onOpenInspection && (
                                <button
                                    type="button"
                                    onClick={() => onOpenInspection(result.inspection_id)}
                                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-xs font-medium transition"
                                >
                                    Open Full Inspection Report <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            )}

                            <button
                                onClick={handleSubmitPipeline}
                                disabled={isProcessing || Boolean(result)}
                                className="bg-[#0e7490] hover:bg-[#155e75] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 shadow-sm"
                            >
                                {result ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />{" "}
                                        {result.mode === "inspection"
                                            ? `Saved to Inspection #${result.inspection_id}`
                                            : "Analyzed"}
                                    </>
                                ) : (
                                    <>
                                        <Sliders className="w-4 h-4" />{" "}
                                        {isProcessing ? "Processing..." : "Submit to Pipeline"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
