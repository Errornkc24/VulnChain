import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Button from '../ui/Button'

export default function CTASection() {
  return (
    <section className="py-24 px-6 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center bg-surface border border-gray-800 rounded-2xl p-12"
      >
        <h2 className="text-3xl font-bold text-gray-100 mb-4">Ready to Get Started?</h2>
        <p className="text-gray-500 mb-8 max-w-lg mx-auto">
          Join the decentralized vulnerability management network. Submit, review, and govern CVEs with full blockchain transparency.
        </p>
        <Link to="/register">
          <Button size="lg">
            Create Your Account
            <ArrowRight size={16} />
          </Button>
        </Link>
      </motion.div>
    </section>
  )
}
