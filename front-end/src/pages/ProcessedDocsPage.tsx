import React from "react";
import ProcessedDocDashboard from "../components/documents/ProcessedDocDashboard";
import type { AuthUser } from "../types";

const ProcessedDocsPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return <ProcessedDocDashboard currentUser={currentUser} />;
};

export default ProcessedDocsPage;
