
import { apiRequest } from "./client";

// Register new user
export async function registerUser(userData) {
    return apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
        }),
    });
}

// Login user
export async function loginUser(credentials) {
    const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
        }),
    });

    // Store JWT access token
    if (!response.access_token) {
        throw new Error("Authentication token was not returned by server");
    }

    localStorage.setItem(
        "infrascan_token",
        response.access_token
    );

    return {
        access_token: response.access_token,
        token_type: response.token_type,
        user: response.user,
    };
}

// Logout user
export function logoutUser() {
    localStorage.removeItem("infrascan_token");

    window.dispatchEvent(
        new Event("infrascan:unauthorized")
    );
}

// Check whether a token exists
export function isAuthenticated() {
    return Boolean(
        localStorage.getItem("infrascan_token")
    );
}

// Get stored token
export function getAuthToken() {
    return localStorage.getItem("infrascan_token");
}
