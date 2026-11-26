import { useState, useEffect } from "react";
import {
    X,
    Eye,
    Layers,
    Box,
    Flame,
    Ruler,
    AlertTriangle,
    CheckCircle2,
    ShieldAlert,
    FileSpreadsheet,
    FileText,
    Printer,
    RefreshCw,
    Play,
    XCircle,
    Edit3,
    Trash2,
} from "lucide-react";
import { apiRequest, resolveFileUrl } from "../api/client";

const SEVERITY_OPTIONS = [
    "No Visible Damage",
    "Minor Damage",
    "Moderate Damage",
    "Severe Damage",
    "Critical / Requires Urgent Engineering Review",
];

function severityBadgeStyle(sev) {
    const s = String(sev || "").toLowerCase();
    if (s.includes("critical") || s.includes("severe")) {
        return "bg-rose-50 text-rose-700 border border-rose-200";
    }
    if (s.includes("moderate") || s.includes("minor")) {
        return "bg-amber-50 text-amber-700 border border-amber-200";
    }
    if (s.includes("no visible") || s.includes("safe")) {
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    }
    return "bg-slate-50 text-slate-600 border border-slate-200";
}

export default function InspectionReportModal({
    inspectionId,
    fallbackSummary,
    userRole,
    onClose,
    onStatusChange,
    onDeleted,
}) {
    const normalizedRole = String(userRole || "").toLowerCase();
    const canReview = ["civil_engineer", "manager", "admin", "civil engineer", "infrastructure manager", "administrator"].includes(normalizedRole);

    const [inspectionDetail, setInspectionDetail] = useState(null);
    const [resultsData, setResultsData] = useState(null);
    const [selectedImageIdx, setSelectedImageIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Visual layer toggles (backend generates separate rendered images)
    const [viewMode, setViewMode] = useState("overlay"); // "original" | "overlay" | "mask" | "boxes" | "gradcam"

    // Engineer review form
    const [reviewDecision, setReviewDecision] = useState("confirmed");
    const [finalSeverity, setFinalSeverity] = useState("Moderate Damage");
    const [reviewComment, setReviewComment] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);
    const [startingAnalysis, setStartingAnalysis] = useState(false);
    const [completingInspection, setCompletingInspection] = useState(false);
    const [deletingInspection, setDeletingInspection] = useState(false);

    const loadAll = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [detailRes, resultsRes] = await Promise.all([
                apiRequest(`/inspections/${inspectionId}`),
                apiRequest(`/inspections/${inspectionId}/results`).catch(() => null),
            ]);
            setInspectionDetail(detailRes);
            setResultsData(resultsRes);
        } catch (err) {
            setError(err.message || "Could not load inspection details.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedImageIdx(0);
        loadAll(false);
    }, [inspectionId]);

    // Auto-poll while any photo is queued or running
    useEffect(() => {
        const inQueue = resultsData?.summary?.in_queue ?? 0;
        if (inQueue <= 0) return;
        const timer = setInterval(() => {
            loadAll(true);
        }, 2500);
        return () => clearInterval(timer);
    }, [resultsData?.summary?.in_queue, inspectionId]);

    const items = resultsData?.items || [];
    const currentItem = items[selectedImageIdx] || null;
    const currentImage = currentItem?.image || inspectionDetail?.images?.[selectedImageIdx] || null;
    const currentAnalysis = currentItem?.analysis || null;
    const aiResult = currentAnalysis?.result || null;

    useEffect(() => {
        if (currentAnalysis) {
            setFinalSeverity(currentAnalysis.effective_severity || currentAnalysis.severity_category || "Moderate Damage");
            setReviewComment(currentAnalysis.review_comment || "");
            if (["confirmed", "modified", "rejected"].includes(currentAnalysis.review_status)) {
                setReviewDecision(currentAnalysis.review_status);
            } else {
                setReviewDecision("confirmed");
            }
        }
    }, [selectedImageIdx, currentAnalysis?.id, currentAnalysis?.review_status]);

    const handleTriggerAnalysis = async (force = false) => {
        setStartingAnalysis(true);
        setError(null);
        try {
            await apiRequest(`/inspections/${inspectionId}/analyze`, {
                method: "POST",
                body: JSON.stringify({ force }),
            });
            await loadAll(true);
        } catch (err) {
            setError(err.message || "Could not start AI analysis.");
        } finally {
            setStartingAnalysis(false);
        }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!currentImage) return;
        setSubmittingReview(true);
        setError(null);
        try {
            await apiRequest(`/inspections/${inspectionId}/images/${currentImage.id}/review`, {
                method: "PUT",
                body: JSON.stringify({
                    decision: reviewDecision,
                    ...(reviewDecision === "modified" ? { final_severity: finalSeverity } : {}),
                    comment: reviewComment.trim(),
                }),
            });
            await loadAll(true);
        } catch (err) {
            setError(err.message || "Failed to submit engineer review.");
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleCompleteInspection = async () => {
        setCompletingInspection(true);
        setError(null);
        try {
            const updated = await apiRequest(`/inspections/${inspectionId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "completed" }),
            });
            setInspectionDetail((prev) => ({ ...prev, ...updated }));
            onStatusChange?.(inspectionId, updated.status);
        } catch (err) {
            setError(err.message || "Could not mark inspection as completed.");
        } finally {
            setCompletingInspection(false);
        }
    };

    const handleDeleteInspection = async () => {
        if (!window.confirm(`Permanently delete Inspection #${inspectionId} and all uploaded images?`)) {
            return;
        }
        setDeletingInspection(true);
        setError(null);
        try {
            await apiRequest(`/inspections/${inspectionId}`, { method: "DELETE" });
            onDeleted?.(inspectionId);
        } catch (err) {
            setError(err.message || "Could not delete inspection.");
        } finally {
            setDeletingInspection(false);
        }
    };

    // Determine active image URL for viewer
    const originalUrl = resolveFileUrl(currentImage?.url);
    const overlayUrl = resolveFileUrl(aiResult?.segmentation?.overlay_path);
    const maskUrl = resolveFileUrl(aiResult?.segmentation?.mask_path);
    const boxesUrl = resolveFileUrl(aiResult?.detection?.annotated_image_path);
    const gradcamUrl = resolveFileUrl(aiResult?.classification?.heatmap_path);

    const activeDisplayUrl =
        (viewMode === "overlay" && overlayUrl) ||
        (viewMode === "mask" && maskUrl) ||
        (viewMode === "boxes" && boxesUrl) ||
        (viewMode === "gradcam" && gradcamUrl) ||
        originalUrl;

    const geometry = aiResult?.segmentation?.geometry || null;
    const summary = resultsData?.summary || null;

    const reportMeta = {
        id: inspectionId,
        asset: inspectionDetail?.asset_name || fallbackSummary?.asset || `Asset #${inspectionDetail?.asset_id ?? ""}`,
        assetCode: inspectionDetail?.asset_code || "",
        inspector: inspectionDetail?.assigned_to_name || fallbackSummary?.inspector || "Unassigned",
        date:
            inspectionDetail?.inspection_date ||
            inspectionDetail?.scheduled_date ||
            fallbackSummary?.date ||
            "—",
        status: inspectionDetail?.status || fallbackSummary?.status || "planned",
        overallSeverity: summary?.overall_severity || fallbackSummary?.severity || "Not assessed",
        overallPriority: summary?.overall_priority || "—",
    };

    const handleExportSingleCsv = async () => {

        try {
            const token = localStorage.getItem("infrascan_token");
            const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, "");
            const resp = await fetch(`${apiBase}/inspections/${inspectionId}/report.csv`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (resp.ok) {
                const csvText = await resp.text();
                const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `inspection_${inspectionId}_report.csv`;
                link.click();
                URL.revokeObjectURL(url);
                return;
            }
        } catch {
            // fallback to client-side CSV below
        }
        const rows = [
            ["Field", "Value"],
            ["Inspection ID", reportMeta.id],
            ["Asset Code", reportMeta.assetCode],
            ["Asset Name", reportMeta.asset],
            ["Inspector", reportMeta.inspector],
            ["Inspection Date", reportMeta.date],
            ["Inspection Status", reportMeta.status],
            ["Overall Severity", reportMeta.overallSeverity],
            ["Overall Priority", reportMeta.overallPriority],
            ["Selected Image", currentImage?.original_name || "N/A"],
            ["Classification", aiResult?.classification ? `${aiResult.classification.label} (${(aiResult.classification.crack_probability * 100).toFixed(1)}%)` : "N/A"],
            ["Detected Damage Types", (aiResult?.damage_types || []).join("; ") || "None"],
            ["Crack Length (px)", geometry ? String(geometry.length) : "N/A"],
            ["Average Width (px)", geometry ? String(geometry.average_width) : "N/A"],
            ["Max Width (px)", geometry ? String(geometry.max_width) : "N/A"],
            ["Crack Area (px²)", geometry ? String(geometry.area) : "N/A"],
            ["Crack Density (%)", geometry ? String(geometry.density_percent) : "N/A"],
            ["Engineer Review Status", currentAnalysis?.review_status || "N/A"],
            ["Engineer Comment", currentAnalysis?.review_comment || ""],
            ["Disclaimer", aiResult?.disclaimer || "AI-based assessment for inspection support only. A qualified engineer must review the findings."],
        ];
        const csv = "data:text/csv;charset=utf-8," + rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `inspection_${reportMeta.id}_report.csv`;
        link.click();
    };

    const handleExportSingleExcel = () => {
        const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
        <h2>InfraScan Structural Inspection Report (#${reportMeta.id})</h2>
        <table border="1">
          <tr><th>Parameter</th><th>Value</th></tr>
          <tr><td>Inspection ID</td><td>${reportMeta.id}</td></tr>
          <tr><td>Asset</td><td>${reportMeta.assetCode} — ${reportMeta.asset}</td></tr>
          <tr><td>Inspector</td><td>${reportMeta.inspector}</td></tr>
          <tr><td>Date</td><td>${reportMeta.date}</td></tr>
          <tr><td>Status</td><td>${reportMeta.status}</td></tr>
          <tr><td>Overall Severity</td><td>${reportMeta.overallSeverity}</td></tr>
          <tr><td>Overall Priority</td><td>${reportMeta.overallPriority}</td></tr>
          <tr><td>Detected Damage Types</td><td>${(aiResult?.damage_types || []).join(", ") || "None"}</td></tr>
          <tr><td>Crack Length (px)</td><td>${geometry?.length ?? "N/A"}</td></tr>
          <tr><td>Max Width (px)</td><td>${geometry?.max_width ?? "N/A"}</td></tr>
          <tr><td>Crack Area (px²)</td><td>${geometry?.area ?? "N/A"}</td></tr>
          <tr><td>Crack Density (%)</td><td>${geometry?.density_percent ?? "N/A"}</td></tr>
          <tr><td>Engineer Review</td><td>${currentAnalysis?.review_status || "pending"} (${currentAnalysis?.review_comment || ""})</td></tr>
        </table>
      </body></html>`;
        const blob = new Blob([htmlTable], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `inspection_${reportMeta.id}_report.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handlePrintFormalReport = () => {
        const win = window.open("", "_blank", "width=850,height=900");
        if (!win) return;
        win.document.write(`
      <html>
        <head>
          <title>InfraScan Report - #${reportMeta.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 36px; color: #0f172a; }
            .header { border-bottom: 2px solid #0e7490; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .badge { padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; background: #e0f2fe; color: #0369a1; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f1f5f9; width: 35%; }
            .footer { margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0;font-size:20px;">InfraScan — Structural Inspection Report</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#475569;">AI-Powered Crack & Damage Assessment System</p>
            </div>
            <div><span class="badge">${reportMeta.overallSeverity}</span></div>
          </div>
          <table>
            <tr><th>Inspection ID</th><td>#${reportMeta.id}</td></tr>
            <tr><th>Infrastructure Asset</th><td>${reportMeta.assetCode} — ${reportMeta.asset}</td></tr>
            <tr><th>Assigned Inspector</th><td>${reportMeta.inspector}</td></tr>
            <tr><th>Inspection Date</th><td>${reportMeta.date}</td></tr>
            <tr><th>Inspection Status</th><td>${reportMeta.status}</td></tr>
            <tr><th>Overall Priority</th><td>${reportMeta.overallPriority}</td></tr>
            <tr><th>Detected Damage Types</th><td>${(aiResult?.damage_types || []).join(", ") || "None"}</td></tr>
            <tr><th>Crack Length (pixels)</th><td>${geometry?.length ?? "N/A"}</td></tr>
            <tr><th>Max Crack Width (pixels)</th><td>${geometry?.max_width ?? "N/A"}</td></tr>
            <tr><th>Affected Crack Area (pixels²)</th><td>${geometry?.area ?? "N/A"}</td></tr>
            <tr><th>Engineer Review</th><td>${currentAnalysis?.review_status || "pending"} — ${currentAnalysis?.review_comment || "No comment"}</td></tr>
          </table>
          <div class="footer">
            ${aiResult?.disclaimer || "AI-based assessment for inspection support only. It is not a structural safety evaluation. A qualified engineer must review the findings."}
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
        win.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto">
                {/* Top Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                #{reportMeta.id}
                            </span>
                            {reportMeta.assetCode && (
                                <span className="font-mono text-xs text-cyan-700 font-semibold">
                                    {reportMeta.assetCode}
                                </span>
                            )}
                            <h2 className="text-base font-bold text-slate-900">{reportMeta.asset}</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Inspector: {reportMeta.inspector} • Date: {reportMeta.date} • Status:{" "}
                            <span className="font-semibold capitalize">{reportMeta.status.replaceAll("_", " ")}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportSingleCsv}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                        >
                            <FileText className="w-3.5 h-3.5 text-cyan-700" /> CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportSingleExcel}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
                        </button>
                        <button
                            type="button"
                            onClick={handlePrintFormalReport}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white transition"
                        >
                            <Printer className="w-3.5 h-3.5" /> PDF Report
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {loading ? (
                    <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-cyan-600" />
                        <span>Loading inspection images, AI layers, and geometry metrics...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3">
                        {/* Left 2 Columns: Image & AI Layer Viewer */}
                        <div className="lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 space-y-4 bg-slate-950 text-white">
                            {/* Photo selector strip if multiple photos */}
                            {items.length > 1 && (
                                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                    {items.map((it, idx) => (
                                        <button
                                            key={it.image.id}
                                            type="button"
                                            onClick={() => setSelectedImageIdx(idx)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap border transition ${
                                                idx === selectedImageIdx
                                                    ? "bg-cyan-600 border-cyan-400 text-white"
                                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                            }`}
                                        >
                                            Photo #{idx + 1}: {it.image.original_name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Layer Switcher */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("original")}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                                            viewMode === "original"
                                                ? "bg-slate-700 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Original
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!overlayUrl}
                                        onClick={() => setViewMode("overlay")}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-40 ${
                                            viewMode === "overlay"
                                                ? "bg-rose-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Layers className="w-3.5 h-3.5" /> U-Net Overlay
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!maskUrl}
                                        onClick={() => setViewMode("mask")}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-40 ${
                                            viewMode === "mask"
                                                ? "bg-rose-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Layers className="w-3.5 h-3.5" /> Binary Mask
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!boxesUrl}
                                        onClick={() => setViewMode("boxes")}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-40 ${
                                            viewMode === "boxes"
                                                ? "bg-cyan-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Box className="w-3.5 h-3.5" /> YOLOv8 Boxes
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!gradcamUrl}
                                        onClick={() => setViewMode("gradcam")}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-40 ${
                                            viewMode === "gradcam"
                                                ? "bg-amber-600 text-white"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <Flame className="w-3.5 h-3.5" /> Grad-CAM XAI
                                    </button>
                                </div>

                                {currentImage && (
                                    <button
                                        type="button"
                                        disabled={startingAnalysis}
                                        onClick={() => handleTriggerAnalysis(Boolean(currentAnalysis))}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium transition disabled:opacity-50"
                                    >
                                        <Play className="w-3 h-3" />
                                        {startingAnalysis
                                            ? "Queueing..."
                                            : currentAnalysis
                                            ? "Re-run AI"
                                            : "Run AI Analysis"}
                                    </button>
                                )}
                            </div>

                            {/* Image Viewport */}
                            <div className="relative w-full aspect-16/10 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                                {!currentImage ? (
                                    <p className="text-xs text-slate-400">
                                        No photos uploaded to this inspection yet. Upload photos from the Image Upload tab.
                                    </p>
                                ) : currentAnalysis && ["queued", "running"].includes(currentAnalysis.status) ? (
                                    <div className="text-center space-y-2 text-slate-300">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                                        <p className="text-xs">AI analysis is {currentAnalysis.status}... auto-refreshing</p>
                                    </div>
                                ) : activeDisplayUrl ? (
                                    <img
                                        src={activeDisplayUrl}
                                        alt={currentImage.original_name}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <p className="text-xs text-slate-400">Preview unavailable</p>
                                )}

                                {aiResult?.detection?.boxes?.length > 0 && (
                                    <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-700 rounded-md px-3 py-1.5 text-[11px] font-mono text-cyan-300">
                                        Detections:{" "}
                                        {aiResult.detection.boxes
                                            .map((b) => `${b.class_name} (${(b.confidence * 100).toFixed(0)}%)`)
                                            .join(", ")}
                                    </div>
                                )}
                            </div>

                            {/* Quality & Warnings */}
                            {currentImage && (
                                <div className="text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        File: <strong className="text-slate-200">{currentImage.original_name}</strong> (
                                        {currentImage.width}×{currentImage.height} px)
                                    </span>
                                    {aiResult?.processing_time_ms > 0 && (
                                        <span className="font-mono">
                                            Inference: {aiResult.processing_time_ms} ms • Pipeline v{aiResult.pipeline_version}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Metrics & Engineer Review */}
                        <div className="p-6 flex flex-col justify-between space-y-5 bg-white max-h-[82vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${severityBadgeStyle(
                                            currentAnalysis?.effective_severity || reportMeta.overallSeverity
                                        )}`}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        {currentAnalysis?.effective_severity || reportMeta.overallSeverity}
                                    </span>

                                    {currentAnalysis?.severity_score !== null &&
                                        currentAnalysis?.severity_score !== undefined && (
                                            <span className="font-mono text-xs font-bold text-slate-700">
                                                Score: {currentAnalysis.severity_score}/100
                                            </span>
                                        )}
                                </div>

                                {/* Classification & Damage Types */}
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        AI Assessment & Damage Types
                                    </span>
                                    {aiResult ? (
                                        <>
                                            <p className="text-sm font-bold text-slate-900">
                                                {aiResult.damage_types?.length > 0
                                                    ? aiResult.damage_types
                                                          .map((t) =>
                                                              t.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                                                          )
                                                          .join(", ")
                                                    : "No Visible Damage"}
                                            </p>
                                            {aiResult.classification && (
                                                <p className="text-xs text-slate-600">
                                                    ResNet50 Classifier: <strong>{aiResult.classification.label}</strong> (
                                                    {(aiResult.classification.crack_probability * 100).toFixed(1)}% probability)
                                                </p>
                                            )}
                                            {currentAnalysis?.effective_priority && (
                                                <p className="text-xs text-cyan-800 font-medium">
                                                    Priority: {currentAnalysis.effective_priority}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-500">
                                            {currentAnalysis?.status === "error"
                                                ? `Analysis error: ${currentAnalysis.error}`
                                                : "Not analyzed yet. Click 'Run AI Analysis' above."}
                                        </p>
                                    )}
                                </div>

                                {/* Extracted Crack Geometry (in Pixels) */}
                                <div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Ruler className="w-3.5 h-3.5 text-cyan-600" />
                                            <span>Extracted Crack Geometry</span>
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">Unit: pixels</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">
                                                Max Width
                                            </span>
                                            <span className="block text-sm font-bold text-slate-900 mt-0.5 font-mono">
                                                {geometry ? geometry.max_width : "—"}{" "}
                                                <span className="text-[11px] font-normal">px</span>
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">
                                                Total Length
                                            </span>
                                            <span className="block text-sm font-bold text-slate-900 mt-0.5 font-mono">
                                                {geometry ? geometry.length : "—"}{" "}
                                                <span className="text-[11px] font-normal">px</span>
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">
                                                Density
                                            </span>
                                            <span className="block text-sm font-bold text-slate-900 mt-0.5 font-mono">
                                                {geometry ? `${geometry.density_percent}%` : "—"}
                                            </span>
                                        </div>
                                    </div>
                                    {geometry && (
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Avg width: {geometry.average_width} px • Orientation:{" "}
                                            {geometry.orientation_label || "N/A"} ({geometry.orientation_deg ?? "—"}°) •
                                            Branches: {geometry.branch_points}
                                        </p>
                                    )}
                                </div>

                                {/* Severity Reasons */}
                                {aiResult?.severity?.reasons?.length > 0 && (
                                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1">
                                        <span className="font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Severity Factors
                                        </span>
                                        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                            {aiResult.severity.reasons.map((r, i) => (
                                                <li key={i}>{r}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Engineer Review Form (PUT /api/inspections/{id}/images/{imageId}/review) */}
                                {currentAnalysis?.status === "ok" && (
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Engineer Review</span>
                                            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                                {currentAnalysis.review_status}
                                            </span>
                                        </div>

                                        {canReview ? (
                                            <form onSubmit={handleSubmitReview} className="space-y-2.5">
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDecision("confirmed")}
                                                        className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1 border ${
                                                            reviewDecision === "confirmed"
                                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                                : "bg-white text-slate-700 border-slate-200"
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDecision("modified")}
                                                        className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1 border ${
                                                            reviewDecision === "modified"
                                                                ? "bg-amber-600 text-white border-amber-600"
                                                                : "bg-white text-slate-700 border-slate-200"
                                                        }`}
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" /> Modify
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDecision("rejected")}
                                                        className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1 border ${
                                                            reviewDecision === "rejected"
                                                                ? "bg-rose-600 text-white border-rose-600"
                                                                : "bg-white text-slate-700 border-slate-200"
                                                        }`}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                </div>

                                                {reviewDecision === "modified" && (
                                                    <select
                                                        value={finalSeverity}
                                                        onChange={(e) => setFinalSeverity(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800"
                                                    >
                                                        {SEVERITY_OPTIONS.map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}

                                                <input
                                                    type="text"
                                                    required={reviewDecision !== "confirmed"}
                                                    value={reviewComment}
                                                    onChange={(e) => setReviewComment(e.target.value)}
                                                    placeholder={
                                                        reviewDecision === "confirmed"
                                                            ? "Optional review comment..."
                                                            : "Required explanation (min 3 chars)..."
                                                    }
                                                    className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800"
                                                />

                                                <button
                                                    type="submit"
                                                    disabled={submittingReview}
                                                    className="w-full bg-[#0e7490] hover:bg-[#155e75] text-white py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50"
                                                >
                                                    {submittingReview ? "Saving Review..." : "Save Engineer Review"}
                                                </button>
                                            </form>
                                        ) : (
                                            <p className="text-[11px] text-slate-500">
                                                {currentAnalysis.review_comment ||
                                                    "Awaiting review by a Civil Engineer, Manager, or Administrator."}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bottom Inspection Status & Delete Actions */}
                            {(!["completed", "cancelled"].includes(reportMeta.status) || canReview) && (
                                <div className="pt-3 border-t border-slate-200 space-y-2">
                                    {!["completed", "cancelled"].includes(reportMeta.status) && (
                                        <button
                                            type="button"
                                            disabled={completingInspection || items.length === 0}
                                            onClick={handleCompleteInspection}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {completingInspection ? "Completing..." : "Mark Inspection Completed"}
                                        </button>
                                    )}
                                    {canReview && (
                                        <button
                                            type="button"
                                            disabled={deletingInspection}
                                            onClick={handleDeleteInspection}
                                            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {deletingInspection ? "Deleting..." : "Delete Inspection"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}