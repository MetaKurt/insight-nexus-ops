import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-md gradient-primary shadow-glow">
          <Radar className="h-6 w-6 text-primary-foreground" />
        </div>
        <p className="text-xs uppercase tracking-wider text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Signal lost</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page <span className="font-mono text-foreground">{location.pathname}</span> doesn't exist.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
