import { motion } from 'framer-motion'
import { pageTransition } from '../../lib/animations'

export default function PageTransition({ children }) {
  return (
    <motion.div {...pageTransition}>
      {children}
    </motion.div>
  )
}
