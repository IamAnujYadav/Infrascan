const RAW_API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

/**
 * Convert a backend file URL (e.g. "/files/inspections/1/abc.jpg") into an absolute URL.
 */
export function resolveFileUrl(path) {
    if (!path) return null;
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${BACKEND_ORIGIN}${normalized}`;
}

export const ROLE_DISPLAY_LABELS = {
    civil_engineer: "Civil Engineer",
    inspector: "Infrastructure Inspector",
    maintenance_engineer: "Maintenance Engineer",
    manager: "Infrastructure Manager",
    admin: "Administrator",
};

export function formatRoleLabel(role) {
    if (!role) return "User";
    return ROLE_DISPLAY_LABELS[role] || String(role).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem("infrascan_token");
    const isFormData = options.body instanceof FormData;

    const headers = {
        ...(!isFormData && !(options.body instanceof URLSearchParams)
            ? { "Content-Type": "application/json" }
            : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const url = endpoint.startsWith("http")
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        window.dispatchEvent(new Event("infrascan:unauthorized"));
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        if (typeof data === "string" && data) {
            message = data;
        } else if (Array.isArray(data?.detail)) {
            message = data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
        } else if (data?.detail) {
            message = data.detail;
        } else if (data?.message) {
            message = data.message;
        }
        throw new Error(message);
    }

    return data;
}

export function unwrapItems(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

export function normalizeAsset(asset = {}) {
    const rawType = asset.asset_type ?? asset.type ?? "unknown";
    return {
        ...asset,
        assetCode: asset.asset_code ?? asset.assetCode ?? String(asset.id ?? ""),
        rawType,
        type: String(rawType)
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        name: asset.name ?? "Unnamed asset",
        location: asset.location ?? "",
        latitude: asset.latitude ?? null,
        longitude: asset.longitude ?? null,
        lastInspected: asset.updated_at
            ? String(asset.updated_at).split("T")[0]
            : asset.created_at
            ? String(asset.created_at).split("T")[0]
            : "—",
        risk: asset.risk ?? asset.severity ?? (asset.is_active === false ? "Archived" : "Active"),
    };
}
