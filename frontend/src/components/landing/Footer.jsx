import Logo from '../brand/Logo'

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 py-8 px-6 relative z-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo size="sm" />
        <p className="text-xs text-gray-600">
          VulnChain — Decentralized CVE Management on Hyperledger Fabric
        </p>
      </div>
    </footer>
  )
}
