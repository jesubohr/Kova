const features = [
  { title: "Pay per request", description: "Charge $0.001 or less per call. Agents pay exactly what they use — no wasted budget." },
  { title: "No subscription overhead", description: "Skip billing systems, credit cards, and churn management. Every request self-settles." },
  { title: "Sub-cent precision", description: "Stellar supports 7 decimal places. Price your API at fractions of a cent with no rounding loss." },
  { title: "Instant settlement", description: "USDC lands in your wallet in ~5 seconds. No payment processor delays or holds." },
]

export function RevenueModel() {
  return (
    <section className="py-24 px-4 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">Built for the agent economy</h2>
        <p className="text-white/50 text-center mb-16 max-w-xl mx-auto">
          AI agents make thousands of API calls. Traditional billing doesn&apos;t scale. Kova does.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
