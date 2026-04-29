import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { AuthUser } from "../types";

interface PrivateRouteProps {
  requiredRole?: (user: AuthUser) => boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ requiredRole }) => {
  const savedUser = localStorage.getItem("flyvisa_user");
  const currentUser: AuthUser | null = savedUser ? JSON.parse(savedUser) : null;
  const isTeacherDeptUser =
    currentUser?.department?.toLowerCase().includes("giáo viên") ?? false;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole(currentUser)) {
    return <Navigate to={isTeacherDeptUser ? "/hr" : "/dashboard"} replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
