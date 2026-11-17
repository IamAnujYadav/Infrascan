import { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(localStorage.getItem("infrascan_token"));
  });

  const [userRole, setUserRole] = useState<string>(() => {
    return localStorage.getItem("infrascan_role") || "Civil Engineer";
  });

  const handleLogin = (role: string) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("infrascan_token");
    localStorage.removeItem("infrascan_role");
    localStorage.removeItem("infrascan_user_name");
    setIsLoggedIn(false);
  };

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener("infrascan:unauthorized", onUnauthorized);
    return () => window.removeEventListener("infrascan:unauthorized", onUnauthorized);
  }, []);

  return (
    <>
      {isLoggedIn ? (
        <DashboardPage userRole={userRole} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </>
  );
}