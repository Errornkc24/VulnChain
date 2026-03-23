import { motion } from 'framer-motion'
import { Shield, Link as LinkIcon, Vote, BarChart3, Lock, History } from 'lucide-react'
import { staggerContainer, staggerItem } from '../../lib/animations'

const features = [
  { icon: Shield, title: 'CVE Lifecycle', desc: 'Full state-machine management from draft to published with role-based transitions.' },
  { icon: LinkIcon, title: 'Blockchain Backed', desc: 'Every record anchored on Hyperledger Fabric — immutable and verifiable.' },
  { icon: Vote, title: 'Weighted Governance', desc: 'Multi-org voting with configurable quorums and approval thresholds.' },
  { icon: Lock, title: 'Embargo Control', desc: 'Time-locked vulnerability disclosure with automated countdown tracking.' },
  { icon: History, title: 'Audit Trail', desc: 'Complete history of every state change, vote, and action on the ledger.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Real-time dashboards for severity trends, org activity, and CVE status.' },
]

export default function FeaturesSection() {
  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-gray-100 mb-4">Why VulnChain?</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Enterprise-grade vulnerability management with the trust of decentralization.</p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={staggerItem}
              className="bg-surface border border-gray-800 rounded-xl p-6 hover:border-matrix/30 transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-lg bg-matrix/10 border border-matrix/20 flex items-center justify-center mb-4 group-hover:glow-green-sm transition-shadow">
                <Icon size={20} className="text-matrix" />
              </div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
