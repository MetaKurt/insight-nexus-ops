import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthPage from "./pages/Auth";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Records from "./pages/Records";
import RecordDetail from "./pages/RecordDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Runs from "./pages/Runs";
import RunDetail from "./pages/RunDetail";
import Sources from "./pages/Sources";
import ReviewQueue from "./pages/ReviewQueue";
import Errors from "./pages/Errors";
import SettingsPage from "./pages/Settings";
import ControlCenter from "./pages/ControlCenter";
import JobDetail from "./pages/JobDetail";
import Missions from "./pages/Missions";
import MissionBuilder from "./pages/MissionBuilder";
import MissionDetail from "./pages/MissionDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/records" element={<Records />} />
                  <Route path="/records/:id" element={<RecordDetail />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/contacts/:id" element={<ContactDetail />} />
                  <Route path="/runs" element={<Runs />} />
                  <Route path="/runs/:id" element={<RunDetail />} />
                  <Route path="/sources" element={<Sources />} />
                  <Route path="/review" element={<ReviewQueue />} />
                  <Route path="/errors" element={<Errors />} />
                  <Route path="/control-center" element={<ControlCenter />} />
                  <Route path="/control-center/jobs/:id" element={<JobDetail />} />
                  <Route path="/missions" element={<Missions />} />
                  <Route path="/missions/new" element={<MissionBuilder />} />
                  <Route path="/missions/:id" element={<MissionDetail />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
