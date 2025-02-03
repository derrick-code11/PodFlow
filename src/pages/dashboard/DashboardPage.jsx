import { Link } from "react-router-dom";
import {
  Clock,
  BarChart3,
  ArrowRight,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { cn } from "../../lib/utils";

const stats = [
  {
    name: "Total Episodes",
    value: "12",
    icon: FileText,
    change: "+2",
    changeType: "increase",
  },
  {
    name: "Processing Time",
    value: "1.2m",
    icon: Clock,
    change: "-10s",
    changeType: "decrease",
  },
  {
    name: "Words Generated",
    value: "15.3k",
    icon: BarChart3,
    change: "+2.3k",
    changeType: "increase",
  },
];

const recentEpisodes = [
  {
    id: 1,
    title: "The Future of AI in Content Creation",
    date: "2024-03-15",
    duration: "45:22",
    status: "completed",
  },
  {
    id: 2,
    title: "Building Successful Remote Teams",
    date: "2024-03-14",
    duration: "38:15",
    status: "completed",
  },
  {
    id: 3,
    title: "Marketing Strategies for 2024",
    date: "2024-03-12",
    duration: "52:08",
    status: "completed",
  },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">
            Here's what's happening with your podcast episodes
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="rounded-xl border border-border/40 bg-card p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.name}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-2.5">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                    stat.changeType === "increase"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  {stat.change}
                </span>
                <span className="text-sm text-muted-foreground">
                  from last month
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Upload New Episode</h2>
            <p className="mt-2 text-muted-foreground">
              Upload your latest podcast episode and let us handle the rest
            </p>
            <Link
              to="/dashboard/episodes/new"
              className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">View Analytics</h2>
            <p className="mt-2 text-muted-foreground">
              Check detailed statistics about your podcast episodes
            </p>
            <Link
              to="/dashboard/analytics"
              className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary/90"
            >
              View analytics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Recent Episodes */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Episodes</h2>
            <Link
              to="/dashboard/episodes"
              className="text-sm text-primary hover:text-primary/90"
            >
              View all
            </Link>
          </div>
          <div className="rounded-xl border border-border/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {recentEpisodes.map((episode) => (
                    <tr key={episode.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">
                          {episode.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {episode.date}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {episode.duration}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          {episode.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
