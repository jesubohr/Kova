export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* TODO: Navbar */}
      <main>{children}</main>
      {/* TODO: Footer */}
    </div>
  )
}
