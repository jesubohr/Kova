const steps = [
  {
    number: "01",
    title: "Protect",
    description: "Register routes with prices in your server. One plugin — Fastify or Express.",
    color: "from-blue-500 to-blue-600",
  },
  {
    number: "02",
    title: "Pay",
    description: "AI agents detect the 402 response and auto-pay via Stellar USDC in milliseconds.",
    color: "from-cyan-500 to-cyan-600",
  },
  {
    number: "03",
    title: "Earn",
    description: "Payments land in your Stellar wallet. No middlemen. Near-zero fees.",
    color: "from-emerald-500 to-emerald-600",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">How it works</h2>
        <p className="text-white/50 text-center mb-16 max-w-xl mx-auto">
          From zero to paid API in minutes. No billing infrastructure needed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${step.color} mb-4`}>
                <span className="text-lg font-bold text-white">{step.number}</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
