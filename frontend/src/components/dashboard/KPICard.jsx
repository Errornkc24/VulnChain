import { motion } from 'framer-motion'

export default function KPICard({ icon: Icon, label, value, color = 'text-cyan-400', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-surface border border-gray-800 rounded-xl p-5 flex items-center gap-4"
    >
      <div className={`${color} bg-gray-800/50 p-3 rounded-lg`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-100">{value}</p>
      </div>
    </motion.div>
  )
}
