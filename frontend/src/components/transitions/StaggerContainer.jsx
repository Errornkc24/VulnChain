import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '../../lib/animations'

export function StaggerContainer({ children, className }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}
