
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import {
    loginUser,
    registerUser,
    logoutUser,
    getAuthToken,
} from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restore token presence after page refresh
    useEffect(() => {
        const token = getAuthToken();

        if (token) {
            // User details will be restored after profile API integration
            setUser(null);
        }

        setLoading(false);
    }, []);

    // Login
    const login = async (credentials) => {
        const response = await loginUser(credentials);
        setUser(response.user);
        return response;
    };

    // Register
    const register = async (userData) => {
        return await registerUser(userData);
    };

    // Logout
    const logout = () => {
        logoutUser();
        setUser(null);
    };

    const value = {
        user,
        loading,
        isAuthenticated: Boolean(getAuthToken()),
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook
export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
}
