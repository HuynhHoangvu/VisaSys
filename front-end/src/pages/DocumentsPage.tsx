import React from "react";
import DocumentDashboard from "../components/documents/DocumentDashboard";
import type { AuthUser } from "../types";

const DocumentsPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return <DocumentDashboard currentUser={currentUser} />;
};

export default DocumentsPage;
