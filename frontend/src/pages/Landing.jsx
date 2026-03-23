import MatrixBackground from '../components/landing/MatrixBackground'
import HeroSection from '../components/landing/HeroSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import StatsSection from '../components/landing/StatsSection'
import HowItWorks from '../components/landing/HowItWorks'
import CTASection from '../components/landing/CTASection'
import Footer from '../components/landing/Footer'

export default function Landing() {
  return (
    <div className="relative">
      <MatrixBackground />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <HowItWorks />
      <CTASection />
      <Footer />
    </div>
  )
}
