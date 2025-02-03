import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Upload,
  Library,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { cn } from "../../lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: Home },
  { name: "Episodes", href: "/dashboard/episodes", icon: Library },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr]">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-[280px] transform bg-card border-r border-border transition-transform duration-200 ease-in-out lg:translate-x-0 lg:relative",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <Link to="/dashboard" className="text-2xl font-bold text-primary">
              PodFlow
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* New Episode Button */}
          <div className="px-4 py-4">
            <Link
              to="/dashboard/episodes/new"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus className="h-5 w-5" />
              New Episode
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center rounded-md px-2 py-2 text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sign out button */}
          <div className="mt-auto border-t border-border p-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 items-center gap-x-4 border-b border-border bg-card px-4 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="-mx-2.5 p-2.5"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="text-xl font-bold text-primary">PodFlow</div>
        </div>

        {/* Main content area */}
        <main className="flex-1 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
