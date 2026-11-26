import { useState, useEffect } from "react";
import { Users, Shield, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { apiRequest } from "../api/client";

const ROLES = [
    { value: "inspector", label: "Infrastructure Inspector" },
    { value: "civil_engineer", label: "Civil Engineer" },
    { value: "maintenance_engineer", label: "Maintenance Engineer" },
    { value: "manager", label: "Infrastructure Manager" },
    { value: "admin", label: "Administrator" },
];

export default function AdminUsersView({ currentUserId }) {
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);

    const loadAdminData = async () => {
        setLoading(true);
        try {
            const [usersRes, logsRes] = await Promise.all([
                apiRequest("/users"),
                apiRequest("/audit-logs?limit=50"),
            ]);
            setUsers(Array.isArray(usersRes) ? usersRes : []);
            setLogs(Array.isArray(logsRes) ? logsRes : []);
        } catch (err) {
            setNotice({ type: "error", text: err.message || "Failed to load admin records." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAdminData();
    }, []);

    const handleUserUpdate = async (userId, payload) => {
        setNotice(null);
        try {
            const updated = await apiRequest(`/users/${userId}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
            setNotice({ type: "success", text: `Updated ${updated.email}.` });
        } catch (err) {
            setNotice({ type: "error", text: err.message || "Update failed." });
        }
    };

    return (
        <div className="space-y-6">
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

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                            <Users className="w-4 h-4 text-cyan-700" /> User Roles & Access Control
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Assign roles (Civil Engineer, Inspector, Maintenance Engineer, Manager, Admin) and manage account status.
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                                <th className="py-3 px-6">ID</th>
                                <th className="py-3 px-6">Name & Email</th>
                                <th className="py-3 px-6">Role</th>
                                <th className="py-3 px-6">Account Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => {
                                    const isSelf = u.id === currentUserId;
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="py-3.5 px-6 font-mono text-xs text-slate-500">#{u.id}</td>
                                            <td className="py-3.5 px-6">
                                                <span className="font-medium text-slate-900 block">{u.full_name}</span>
                                                <span className="text-xs text-slate-500">{u.email}</span>
                                            </td>
                                            <td className="py-3.5 px-6">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <Shield className="w-3.5 h-3.5 text-cyan-700" />
                                                    <select
                                                        disabled={isSelf}
                                                        value={u.role}
                                                        onChange={(e) =>
                                                            handleUserUpdate(u.id, { role: e.target.value })
                                                        }
                                                        className="border border-slate-200 rounded-md px-2.5 py-1 text-xs bg-white text-slate-800 disabled:bg-slate-100"
                                                    >
                                                        {ROLES.map((r) => (
                                                            <option key={r.value} value={r.value}>
                                                                {r.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-6">
                                                <button
                                                    type="button"
                                                    disabled={isSelf}
                                                    onClick={() =>
                                                        handleUserUpdate(u.id, { is_active: !u.is_active })
                                                    }
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition disabled:opacity-50 ${
                                                        u.is_active
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                                    }`}
                                                >
                                                    {u.is_active ? "Active" : "Disabled"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200">
                    <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-700" /> Recent Audit Logs
                    </h2>
                </div>
                <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                                <th className="py-2.5 px-6">Time (UTC)</th>
                                <th className="py-2.5 px-6">User ID</th>
                                <th className="py-2.5 px-6">Action</th>
                                <th className="py-2.5 px-6">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-6 text-slate-500">
                                        {String(log.created_at || "").replace("T", " ").slice(0, 19)}
                                    </td>
                                    <td className="py-2.5 px-6 text-slate-700">{log.user_id ?? "—"}</td>
                                    <td className="py-2.5 px-6 font-semibold text-cyan-800">{log.action}</td>
                                    <td className="py-2.5 px-6 text-slate-600">{log.detail || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
