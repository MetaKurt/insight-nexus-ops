import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  Users,
  PlayCircle,
  Globe2,
  Inbox,
  AlertTriangle,
  Settings,
  Radar,
  Rocket,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Records", url: "/records", icon: Database },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Runs", url: "/runs", icon: PlayCircle },
  { title: "Sources", url: "/sources", icon: Globe2 },
];

const opsNav = [
  { title: "Control Center", url: "/control-center", icon: Rocket },
  { title: "Review Queue", url: "/review", icon: Inbox },
  { title: "Errors", url: "/errors", icon: AlertTriangle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderItem = (item: (typeof mainNav)[number]) => {
    const active =
      item.end ? location.pathname === item.url : location.pathname.startsWith(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild tooltip={item.title}>
          <NavLink
            to={item.url}
            end={item.end}
            className={cn(
              "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {!collapsed && <span className="truncate">{item.title}</span>}
            {active && !collapsed && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("flex items-center gap-2 px-2 py-2", collapsed && "justify-center")}>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md gradient-primary shadow-glow">
            <Radar className="h-4 w-4 text-primary-foreground" />
            <span className="absolute inset-0 rounded-md animate-pulse-glow" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">SignalHub</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ops Intelligence</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{mainNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          {!collapsed && <SidebarGroupLabel>Operations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{opsNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed ? (
          <div className="rounded-md bg-sidebar-accent/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Backend not connected</p>
            <p className="mt-0.5">Showing mock data. Connect Lovable Cloud in Settings.</p>
          </div>
        ) : (
          <div className="mx-auto h-2 w-2 rounded-full bg-warning" title="Backend not connected" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
