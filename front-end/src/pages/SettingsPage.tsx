import React, { useState } from "react";
import SettingsDashboard from "../components/settings/SettingsDashboard";
import type { AuthUser } from "../types";

const SettingsPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser>(() =>
    JSON.parse(localStorage.getItem("flyvisa_user")!),
  );
  return (
    <SettingsDashboard
      currentUser={currentUser}
      onUserRefresh={(u) => {
        setCurrentUser(u);
      }}
    />
  );
};

export default SettingsPage;
