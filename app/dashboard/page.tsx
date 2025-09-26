export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Welcome to AimHarder Dashboard
        </h1>
        <p className="text-muted-foreground text-lg">
          Your CrossFit class reservations will be managed here.
        </p>
        <div className="mt-8 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Coming Soon</h2>
          <p className="text-muted-foreground">
            - Automatic class reservation system
            <br />
            - Class schedule management
            <br />
            - Progress tracking
            <br />
            - Notification settings
          </p>
        </div>
      </div>
    </div>
  )
}