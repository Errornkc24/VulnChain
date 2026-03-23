import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield } from 'lucide-react'
import Logo from '../brand/Logo'
import Button from '../ui/Button'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-4xl"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <Logo size="xl" />
        </motion.div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
          <span className="text-gray-100">Decentralized </span>
          <span className="text-matrix text-glow">CVE Management</span>
          <br />
          <span className="text-gray-100">on Blockchain</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Transparent, tamper-proof vulnerability tracking powered by Hyperledger Fabric.
          Multi-org governance, weighted voting, and immutable audit trails.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login">
            <Button size="lg" className="w-full sm:w-auto">
              <Shield size={18} />
              Launch App
              <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Create Account
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  )
}
