// Wraps any route that requires a logged-in user. Redirects to /auth otherwise.
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
