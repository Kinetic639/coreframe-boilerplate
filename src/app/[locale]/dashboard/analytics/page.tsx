import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/activities/ActivityFeed";
import { ActivityTimeline } from "@/components/activities/ActivityTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ActivityIcon, TrendingUpIcon, UsersIcon, AlertTriangleIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Analytics Dashboard",
  description: "Activity analytics and insights for your organization",
};

export default function AnalyticsPage() {
  // Mock data for the summary cards
  const summaryStats = [
    {
      title: "Total Activities",
      value: "2,847",
      change: "+12.5%",
      icon: ActivityIcon,
      trend: "up",
    },
    {
      title: "Active Users",
      value: "234",
      change: "+8.2%",
      icon: UsersIcon,
      trend: "up",
    },
    {
      title: "Daily Average",
      value: "127",
      change: "-2.1%",
      icon: TrendingUpIcon,
      trend: "down",
    },
    {
      title: "Errors",
      value: "12",
      change: "-45.3%",
      icon: AlertTriangleIcon,
      trend: "down",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor activity patterns, user engagement, and system performance
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Badge variant={stat.trend === "up" ? "default" : "secondary"} className="text-xs">
                  {stat.change}
                </Badge>
                <span className="ml-2">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="modules">By Module</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>Latest activities across all modules</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityFeed
                  showFilters={false}
                  compact={true}
                  limit={10}
                  maxHeight="400px"
                  autoRefresh={true}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Activities by module this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { module: "Warehouse", count: 156, color: "#10b981" },
                    { module: "Organization", count: 89, color: "#6366f1" },
                    { module: "Teams", count: 45, color: "#8b5cf6" },
                    { module: "Support", count: 23, color: "#f59e0b" },
                  ].map((item) => (
                    <div key={item.module} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium">{item.module}</span>
                      </div>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <ActivityTimeline
            activities={[]} // This would be populated with real data
            title="Activity Timeline"
            maxHeight="600px"
            showGrouping={true}
          />
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <ActivityFeed
            title="Module Activities"
            description="Filter activities by specific modules"
            showFilters={true}
            limit={20}
            maxHeight="600px"
            autoRefresh={false}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>User Activity Feed</CardTitle>
                <CardDescription>Activities filtered by user</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityFeed
                  showFilters={true}
                  compact={false}
                  limit={15}
                  maxHeight="500px"
                  autoRefresh={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Active Users</CardTitle>
                <CardDescription>Most active users this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "John Doe", email: "john@example.com", count: 89 },
                    { name: "Jane Smith", email: "jane@example.com", count: 67 },
                    { name: "Mike Johnson", email: "mike@example.com", count: 45 },
                    { name: "Sarah Wilson", email: "sarah@example.com", count: 34 },
                  ].map((user, index) => (
                    <div key={user.email} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{user.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
