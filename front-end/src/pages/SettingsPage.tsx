import React from "react";
import SettingsDashboard from "../components/settings/SettingsDashboard";
import type { AuthUser } from "../types";

const SettingsPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return <SettingsDashboard currentUser={currentUser} />;
};

export default SettingsPage;
