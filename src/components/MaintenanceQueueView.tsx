import { useState } from "react";
import { Wrench, ArrowUpDown } from "lucide-react";
import { apiRequest } from "../api/client";

interface MaintenanceTask {
    id: string;
    assetId: string;
    assetName: string;
    category: string;
    riskScore: number;
    priority: "High" | "Medium" | "Low";
    repairStatus: "Pending" | "Scheduled" | "Repaired";
    recommendedAction: string;
}

const INITIAL_QUEUE: MaintenanceTask[] = [
    { id: "MNT-01", assetId: "AST-101", assetName: "Eastern Viaduct Pier 14", category: "Bridge", riskScore: 94, priority: "High", repairStatus: "Scheduled", recommendedAction: "Epoxy pressure injection & CFRP wrapping" },
    { id: "MNT-02", assetId: "AST-104", assetName: "Mumbai-Pune Expressway Tunnel", category: "Road", riskScore: 88, priority: "High", repairStatus: "Pending", recommendedAction: "Lining grout sealing & drainage relief" },
    { id: "MNT-03", assetId: "AST-102", assetName: "North Dam Spillway Gate B", category: "Dam", riskScore: 67, priority: "Medium", repairStatus: "Pending", recommendedAction: "Polyurethane crack sealing & sensor mount" },
    { id: "MNT-04", assetId: "AST-106", assetName: "Girna River Highway Bridge", category: "Bridge", riskScore: 58, priority: "Medium", repairStatus: "Scheduled", recommendedAction: "Surface mortar resurfacing" },
    { id: "MNT-05", assetId: "AST-103", assetName: "City Center Metro Overpass", category: "Bridge", riskScore: 22, priority: "Low", repairStatus: "Repaired", recommendedAction: "Routine visual monitoring" },
];

export default function MaintenanceQueueView() {
    const [tasks, setTasks] = useState<MaintenanceTask[]>(INITIAL_QUEUE);
    const [sortDesc, setSortDesc] = useState(true);

    const sortedTasks = [...tasks].sort((a, b) =>
        sortDesc ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
    );

    const updatePriority = async (id: string, priority: MaintenanceTask["priority"]) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
        await apiRequest(`/maintenance/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ priority }),
        }).catch(() => { });
    };

    const updateStatus = async (id: string, repairStatus: MaintenanceTask["repairStatus"]) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, repairStatus } : t)));
        await apiRequest(`/maintenance/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ repair_status: repairStatus }),
        }).catch(() => { });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-cyan-700" /> Maintenance Prioritization Queue
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Rank damaged infrastructure by AI risk score and assign repair priorities and field status.
                    </p>
                </div>

                <button
                    onClick={() => setSortDesc(!sortDesc)}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md text-xs font-medium transition self-start"
                >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sort by Risk Score ({sortDesc ? "Highest First" : "Lowest First"})
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                            <th className="py-3 px-6">Asset</th>
                            <th className="py-3 px-6">AI Risk Score</th>
                            <th className="py-3 px-6">Recommended Engineering Action</th>
                            <th className="py-3 px-6">Priority Level</th>
                            <th className="py-3 px-6">Repair Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedTasks.map((task) => (
                            <tr key={task.id} className="hover:bg-slate-50 transition">
                                <td className="py-4 px-6">
                                    <span className="font-medium text-slate-900 block">{task.assetName}</span>
                                    <span className="font-mono text-xs text-slate-400">
                                        {task.assetId} • {task.category}
                                    </span>
                                </td>

                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                style={{ width: `${task.riskScore}%` }}
                                                className={`h-full ${task.riskScore >= 80
                                                    ? "bg-rose-600"
                                                    : task.riskScore >= 50
                                                        ? "bg-amber-500"
                                                        : "bg-emerald-500"
                                                    }`}
                                            />
                                        </div>
                                        <span className="font-mono text-xs font-bold text-slate-800">
                                            {task.riskScore}/100
                                        </span>
                                    </div>
                                </td>

                                <td className="py-4 px-6 text-xs text-slate-600 max-w-xs">
                                    {task.recommendedAction}
                                </td>

                                <td className="py-4 px-6">
                                    <select
                                        value={task.priority}
                                        onChange={(e) =>
                                            updatePriority(task.id, e.target.value as MaintenanceTask["priority"])
                                        }
                                        className={`rounded-md px-2.5 py-1 text-xs font-semibold border cursor-pointer ${task.priority === "High"
                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                            : task.priority === "Medium"
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-slate-100 text-slate-700 border-slate-200"
                                            }`}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </td>

                                <td className="py-4 px-6">
                                    <select
                                        value={task.repairStatus}
                                        onChange={(e) =>
                                            updateStatus(task.id, e.target.value as MaintenanceTask["repairStatus"])
                                        }
                                        className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 cursor-pointer"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Repaired">Repaired</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}