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
} from "lucide-react";
import { apiRequest } from "../api/client";

export interface BoundingBox {
    id: string;
    label: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface InspectionDetail {
    id: string;
    asset_id?: string;
    asset: string;
    type: string;
    inspector: string;
    date: string;
    severity: "Critical" | "Moderate" | "Safe" | string;
    status: string;
    image_url: string;
    mask_url?: string;
    gradcam_url?: string;
    crack_type: string;
    max_width_mm: number;
    length_cm: number;
    area_cm2: number;
    yolo_boxes: BoundingBox[];
    engineer_notes?: string;
}

interface InspectionReportModalProps {
    inspectionId: string;
    fallbackSummary: {
        id: string;
        asset: string;
        type: string;
        inspector: string;
        severity: string;
        status: string;
        date: string;
    };
    onClose: () => void;
    onStatusChange?: (id: string, newStatus: string) => void;
}

const SAMPLE_CRACK_IMAGE =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#475569"/>
    <g stroke="#334155" stroke-width="2" opacity="0.45">
      <line x1="0" y1="120" x2="800" y2="120"/>
      <line x1="0" y1="260" x2="800" y2="260"/>
      <line x1="0" y1="400" x2="800" y2="400"/>
      <line x1="250" y1="0" x2="250" y2="500"/>
      <line x1="560" y1="0" x2="560" y2="500"/>
    </g>
    <path d="M 190 95 L 245 148 L 285 170 L 340 230 L 395 255 L 460 320 L 535 375 L 590 410"
          fill="none" stroke="#0f172a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 340 230 L 375 295 L 405 335"
          fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
  </svg>
`);

export default function InspectionReportModal({
    inspectionId,
    fallbackSummary,
    onClose,
    onStatusChange,
}: InspectionReportModalProps) {
    const [detail, setDetail] = useState<InspectionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showYolo, setShowYolo] = useState(true);
    const [showMask, setShowMask] = useState(true);
    const [showGradCam, setShowGradCam] = useState(false);
    const [overlayOpacity, setOverlayOpacity] = useState(60);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiRequest<InspectionDetail>(`/inspections/${inspectionId}/report`)
            .then((data) => setDetail(data))
            .catch(() => {
                setDetail({
                    ...fallbackSummary,
                    image_url: SAMPLE_CRACK_IMAGE,
                    crack_type:
                        fallbackSummary.severity === "Critical"
                            ? "Diagonal Shear & Longitudinal Crack"
                            : fallbackSummary.severity === "Moderate"
                                ? "Transverse Surface Crack"
                                : "Minor Hairline Crazing",
                    max_width_mm:
                        fallbackSummary.severity === "Critical"
                            ? 2.4
                            : fallbackSummary.severity === "Moderate"
                                ? 0.9
                                : 0.2,
                    length_cm:
                        fallbackSummary.severity === "Critical"
                            ? 48.6
                            : fallbackSummary.severity === "Moderate"
                                ? 19.2
                                : 6.5,
                    area_cm2:
                        fallbackSummary.severity === "Critical"
                            ? 11.66
                            : fallbackSummary.severity === "Moderate"
                                ? 1.73
                                : 0.13,
                    yolo_boxes: [
                        {
                            id: "box-1",
                            label: "Shear Crack",
                            confidence: 0.96,
                            x: 22,
                            y: 17,
                            width: 54,
                            height: 68,
                        },
                        {
                            id: "box-2",
                            label: "Branch Spall",
                            confidence: 0.84,
                            x: 41,
                            y: 44,
                            width: 14,
                            height: 25,
                        },
                    ],
                    engineer_notes:
                        "Detected along primary load-bearing concrete face. Grad-CAM activation confirms model attention is focused directly on fracture propagation rather than surface shadow.",
                });
            })
            .finally(() => setLoading(false));
    }, [inspectionId, fallbackSummary]);

    const handleAuditAction = async (newStatus: "Approved" | "Needs Review") => {
        if (!detail) return;
        setUpdatingStatus(true);
        try {
            await apiRequest(`/inspections/${detail.id}`, {
                method: "PUT",
                body: JSON.stringify({ status: newStatus }),
            }).catch(() => { });

            setDetail({ ...detail, status: newStatus });
            onStatusChange?.(detail.id, newStatus);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleExportSingleCsv = () => {
        if (!detail) return;
        const rows = [
            ["Field", "Value"],
            ["Inspection ID", detail.id],
            ["Asset Name", detail.asset],
            ["Category", detail.type],
            ["Inspector", detail.inspector],
            ["Inspection Date", detail.date],
            ["Severity", detail.severity],
            ["Audit Status", detail.status],
            ["AI Crack Classification", detail.crack_type],
            ["Max Width (mm)", String(detail.max_width_mm)],
            ["Total Length (cm)", String(detail.length_cm)],
            ["Crack Area (cm2)", String(detail.area_cm2)],
            ["Engineer Notes", detail.engineer_notes || ""],
        ];
        const csv = "data:text/csv;charset=utf-8," + rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `${detail.id}_automated_report.csv`;
        link.click();
    };

    const handleExportSingleExcel = () => {
        if (!detail) return;
        const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
        <h2>InfraScan Automated Structural Inspection Report</h2>
        <table border="1">
          <tr><th>Parameter</th><th>Measurement / Value</th></tr>
          <tr><td>Inspection ID</td><td>${detail.id}</td></tr>
          <tr><td>Asset Name</td><td>${detail.asset}</td></tr>
          <tr><td>Infrastructure Type</td><td>${detail.type}</td></tr>
          <tr><td>Inspector</td><td>${detail.inspector}</td></tr>
          <tr><td>Date</td><td>${detail.date}</td></tr>
          <tr><td>Severity Rating</td><td>${detail.severity}</td></tr>
          <tr><td>Audit Status</td><td>${detail.status}</td></tr>
          <tr><td>AI Classification</td><td>${detail.crack_type}</td></tr>
          <tr><td>Max Crack Width (mm)</td><td>${detail.max_width_mm}</td></tr>
          <tr><td>Total Crack Length (cm)</td><td>${detail.length_cm}</td></tr>
          <tr><td>Crack Surface Area (cm²)</td><td>${detail.area_cm2}</td></tr>
          <tr><td>Engineering Assessment</td><td>${detail.engineer_notes || ""}</td></tr>
        </table>
      </body></html>`;
        const blob = new Blob([htmlTable], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${detail.id}_automated_report.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handlePrintFormalReport = () => {
        if (!detail) return;
        const win = window.open("", "_blank", "width=850,height=900");
        if (!win) return;
        win.document.write(`
      <html>
        <head>
          <title>InfraScan Report - ${detail.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 36px; color: #0f172a; }
            .header { border-bottom: 2px solid #0e7490; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .badge { padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; background: #fee2e2; color: #b91c1c; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f1f5f9; width: 35%; }
            .footer { margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0;font-size:20px;">InfraScan — Automated Structural Inspection Report</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#475569;">AI-Powered Crack & Damage Assessment System</p>
            </div>
            <div><span class="badge">${detail.severity} Severity</span></div>
          </div>
          <table>
            <tr><th>Inspection ID</th><td>${detail.id}</td></tr>
            <tr><th>Infrastructure Asset</th><td>${detail.asset} (${detail.type})</td></tr>
            <tr><th>Assigned Inspector</th><td>${detail.inspector}</td></tr>
            <tr><th>Inspection Date</th><td>${detail.date}</td></tr>
            <tr><th>Audit Verification Status</th><td>${detail.status}</td></tr>
            <tr><th>AI Crack Classification</th><td>${detail.crack_type}</td></tr>
            <tr><th>Maximum Crack Width</th><td>${detail.max_width_mm} mm</td></tr>
            <tr><th>Total Crack Length</th><td>${detail.length_cm} cm</td></tr>
            <tr><th>Affected Crack Area</th><td>${detail.area_cm2} cm²</td></tr>
            <tr><th>Engineering Assessment Note</th><td>${detail.engineer_notes || "N/A"}</td></tr>
          </table>
          <div class="footer">
            Generated automatically by InfraScan Platform • AI results support — not replace — engineering judgement.
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
        win.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden my-auto">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                {fallbackSummary.id}
                            </span>
                            <h2 className="text-base font-bold text-slate-900">{fallbackSummary.asset}</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Category: {fallbackSummary.type} • Inspector: {fallbackSummary.inspector} • Date: {fallbackSummary.date}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportSingleCsv}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                            title="Export CSV"
                        >
                            <FileText className="w-3.5 h-3.5 text-cyan-700" /> CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportSingleExcel}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                            title="Export Excel"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
                        </button>
                        <button
                            type="button"
                            onClick={handlePrintFormalReport}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white transition"
                            title="Generate Printable PDF Report"
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

                {loading || !detail ? (
                    <div className="p-16 text-center text-sm text-slate-500">
                        Loading AI detection layers, Grad-CAM heatmap, and geometry metrics...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3">
                        <div className="lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 space-y-4 bg-slate-950 text-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowYolo(!showYolo)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${showYolo ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Box className="w-3.5 h-3.5" /> YOLO Boxes
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowMask(!showMask)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${showMask ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Layers className="w-3.5 h-3.5" /> U-Net Mask
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowGradCam(!showGradCam)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${showGradCam ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                                            }`}
                                    >
                                        <Flame className="w-3.5 h-3.5" /> Grad-CAM XAI
                                    </button>
                                </div>

                                {(showMask || showGradCam) && (
                                    <div className="flex items-center gap-2 text-xs text-slate-300">
                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Opacity:</span>
                                        <input
                                            type="range"
                                            min={15}
                                            max={95}
                                            value={overlayOpacity}
                                            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                                            className="w-20 accent-amber-500 cursor-pointer"
                                        />
                                        <span className="font-mono text-[11px] w-8">{overlayOpacity}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="relative w-full aspect-16/10 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                                <img src={detail.image_url} alt={detail.asset} className="w-full h-full object-cover" />

                                {showGradCam && (
                                    detail.gradcam_url ? (
                                        <img
                                            src={detail.gradcam_url}
                                            alt="Grad-CAM explanation heatmap"
                                            style={{ opacity: overlayOpacity / 100 }}
                                            className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen"
                                        />
                                    ) : (
                                        <svg
                                            viewBox="0 0 800 500"
                                            style={{ opacity: overlayOpacity / 100 }}
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                        >
                                            <defs>
                                                <radialGradient id="gradcam-hot1" cx="42%" cy="46%" r="28%">
                                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                                                    <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.75" />
                                                    <stop offset="75%" stopColor="#10b981" stopOpacity="0.35" />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                </radialGradient>
                                                <radialGradient id="gradcam-hot2" cx="62%" cy="68%" r="22%">
                                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                                                    <stop offset="50%" stopColor="#facc15" stopOpacity="0.65" />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                </radialGradient>
                                            </defs>
                                            <rect width="800" height="500" fill="url(#gradcam-hot1)" />
                                            <rect width="800" height="500" fill="url(#gradcam-hot2)" />
                                        </svg>
                                    )
                                )}

                                {showMask && (
                                    detail.mask_url ? (
                                        <img
                                            src={detail.mask_url}
                                            alt="U-Net segmentation mask"
                                            style={{ opacity: overlayOpacity / 100 }}
                                            className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen"
                                        />
                                    ) : (
                                        <svg
                                            viewBox="0 0 800 500"
                                            style={{ opacity: overlayOpacity / 100 }}
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                        >
                                            <path
                                                d="M 190 95 L 245 148 L 285 170 L 340 230 L 395 255 L 460 320 L 535 375 L 590 410"
                                                fill="none"
                                                stroke="#f43f5e"
                                                strokeWidth="14"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            <path
                                                d="M 340 230 L 375 295 L 405 335"
                                                fill="none"
                                                stroke="#fb7185"
                                                strokeWidth="10"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )
                                )}

                                {showYolo &&
                                    detail.yolo_boxes.map((box) => (
                                        <div
                                            key={box.id}
                                            style={{
                                                left: `${box.x}%`,
                                                top: `${box.y}%`,
                                                width: `${box.width}%`,
                                                height: `${box.height}%`,
                                            }}
                                            className="absolute border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none rounded-xs"
                                        >
                                            <span className="absolute -top-5 left-0 bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-t-xs whitespace-nowrap">
                                                {box.label} {(box.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}

                                {showGradCam && (
                                    <div className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-700 rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[10px] font-mono">
                                        <span className="text-blue-300">Low</span>
                                        <div className="w-20 h-2 rounded-full bg-linear-to-r from-blue-500 via-emerald-400 via-amber-400 to-rose-600" />
                                        <span className="text-rose-300">High Attention</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 flex flex-col justify-between space-y-6 bg-white">
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${detail.severity === "Critical"
                                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                : detail.severity === "Moderate"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            }`}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" /> {detail.severity} Severity
                                    </span>

                                    <span className="text-xs font-medium text-slate-500">
                                        Status: <strong className="text-slate-800">{detail.status}</strong>
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        AI Crack Classification
                                    </span>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{detail.crack_type}</p>
                                </div>

                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2.5">
                                        <Ruler className="w-3.5 h-3.5 text-cyan-600" />
                                        <span>Extracted Crack Geometry</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2.5">
                                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">Max Width</span>
                                            <span className="block text-base font-bold text-slate-900 mt-0.5 font-mono">
                                                {detail.max_width_mm} <span className="text-xs font-normal">mm</span>
                                            </span>
                                        </div>

                                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">Total Length</span>
                                            <span className="block text-base font-bold text-slate-900 mt-0.5 font-mono">
                                                {detail.length_cm} <span className="text-xs font-normal">cm</span>
                                            </span>
                                        </div>

                                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                                            <span className="block text-[10px] uppercase text-slate-500 font-medium">Crack Area</span>
                                            <span className="block text-base font-bold text-slate-900 mt-0.5 font-mono">
                                                {detail.area_cm2} <span className="text-xs font-normal">cm²</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {detail.engineer_notes && (
                                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                                        <span className="font-semibold mb-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Engineering & XAI Note
                                        </span>
                                        {detail.engineer_notes}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex items-center gap-2.5">
                                <button
                                    type="button"
                                    disabled={updatingStatus}
                                    onClick={() => handleAuditAction("Approved")}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Approve Audit
                                </button>
                                <button
                                    type="button"
                                    disabled={updatingStatus}
                                    onClick={() => handleAuditAction("Needs Review")}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                                >
                                    Flag for Review
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}