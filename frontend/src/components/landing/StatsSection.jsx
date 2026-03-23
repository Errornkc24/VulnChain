import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '../../lib/animations'

const stats = [
  { value: '100%', label: 'On-Chain Integrity' },
  { value: 'Multi-Org', label: 'Governance Model' },
  { value: 'Real-Time', label: 'CVE Tracking' },
  { value: 'Auditable', label: 'Full History' },
]

export default function StatsSection() {
  return (
    <section className="py-20 px-6 relative z-10 border-y border-gray-800/50">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8"
      >
        {stats.map(({ value, label }) => (
          <motion.div key={label} variants={staggerItem} className="text-center">
            <div className="text-3xl font-bold text-matrix font-mono mb-1">{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
