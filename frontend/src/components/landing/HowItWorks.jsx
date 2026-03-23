import { motion } from 'framer-motion'

const steps = [
  { num: '01', title: 'Submit', desc: 'CNA members or researchers submit a new vulnerability report with CVSS scoring.' },
  { num: '02', title: 'Review', desc: 'The CVE moves through review, embargo, and publication stages with role-based approvals.' },
  { num: '03', title: 'Govern', desc: 'Policy changes go through weighted multi-org voting with quorum requirements.' },
  { num: '04', title: 'Audit', desc: 'Every action is recorded on Hyperledger Fabric — transparent and tamper-proof.' },
]

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-gray-100 text-center mb-16"
        >
          How It Works
        </motion.h2>

        <div className="space-y-8">
          {steps.map(({ num, title, desc }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-matrix/10 border border-matrix/30 flex items-center justify-center font-mono text-matrix font-bold">
                {num}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
