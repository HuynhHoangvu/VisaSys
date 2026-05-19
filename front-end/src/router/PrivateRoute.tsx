import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { AuthUser } from "../types";
import { defaultHomePath, hasPermission, P } from "../utils/access";

interface PrivateRouteProps {
  /** @deprecated Dùng requiredAccess */
  requiredRole?: (user: AuthUser) => boolean;
  requiredAccess?: (user: AuthUser) => boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({
  requiredRole,
  requiredAccess,
}) => {
  const savedUser = localStorage.getItem("flyvisa_user");
  const currentUser: AuthUser | null = savedUser ? JSON.parse(savedUser) : null;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const gate = requiredAccess ?? requiredRole;
  if (gate && !gate(currentUser)) {
    return <Navigate to={defaultHomePath(currentUser)} replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;

export const accessMainApp = (user: AuthUser) => hasPermission(user, P.navDashboard);
export const accessBossReport = (user: AuthUser) => hasPermission(user, P.navBoss);
export const accessProcessingModule = (user: AuthUser) =>
  hasPermission(user, P.navProcessing);
