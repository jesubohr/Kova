const reasons = [
  { stat: "5s", label: "Finality", detail: "Transactions confirm in ~5 seconds on Stellar mainnet." },
  { stat: "~$0", label: "Fees", detail: "Network fees are fractions of a cent — never eat into micropayments." },
  { stat: "99.9%", label: "Uptime", detail: "Stellar has operated without downtime since 2015." },
  { stat: "USDC", label: "Native stablecoin", detail: "Pay and receive in Circle's USDC directly on-chain." },
]

export function WhyStellar() {
  return (
    <section id="why-stellar" className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">Why Stellar</h2>
        <p className="text-white/50 text-center mb-16 max-w-xl mx-auto">
          Not all blockchains are equal for payments. Stellar was built for this.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {reasons.map((r) => (
            <div key={r.label} className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-400 mb-1">{r.stat}</div>
              <div className="text-white font-medium mb-2">{r.label}</div>
              <p className="text-white/40 text-xs leading-relaxed">{r.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
