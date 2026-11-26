
import { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import { apiRequest } from "./api/client";

export default function App() {
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    // Restore user profile when the application starts
    useEffect(() => {
        let isMounted = true;

        const restoreSession = async () => {
            const token = localStorage.getItem("infrascan_token");

            if (!token) {
                if (isMounted) {
                    setUser(null);
                    setIsLoggedIn(false);
                    setLoading(false);
                }
                return;
            }

            try {
                // Fetch current authenticated user from backend
                const userData = await apiRequest("/users/me");

                if (isMounted) {
                    setUser(userData);
                    setIsLoggedIn(true);
                }
            } catch (error) {
                console.error("Session restoration failed:", error);

                localStorage.removeItem("infrascan_token");

                if (isMounted) {
                    setUser(null);
                    setIsLoggedIn(false);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        restoreSession();

        return () => {
            isMounted = false;
        };
    }, []);

    // Handle successful login
    const handleLogin = (userData) => {
        const token = localStorage.getItem("infrascan_token");

        if (!token) {
            setUser(null);
            setIsLoggedIn(false);
            return;
        }

        setUser(userData);
        setIsLoggedIn(true);
    };

    // Handle logout
    const handleLogout = () => {
        localStorage.removeItem("infrascan_token");

        setUser(null);
        setIsLoggedIn(false);
    };

    // Automatically logout when backend returns 401
    useEffect(() => {
        const handleUnauthorized = () => {
            handleLogout();
        };

        window.addEventListener(
            "infrascan:unauthorized",
            handleUnauthorized
        );

        return () => {
            window.removeEventListener(
                "infrascan:unauthorized",
                handleUnauthorized
            );
        };
    }, []);

    // Show loading screen while restoring session
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <p className="text-sm text-slate-500">
                    Loading InfraScan...
                </p>
            </div>
        );
    }

    return (
        <>
            {isLoggedIn ? (
                <DashboardPage
                    user={user}
                    userRole={user?.role}
                    onLogout={handleLogout}
                />
            ) : (
                <LoginPage onLogin={handleLogin} />
            )}
        </>
    );
}
