import { Navigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";

const Index = () => {
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/" replace />;
};

export default Index;
