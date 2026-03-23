import { FileQuestion } from 'lucide-react'

export default function EmptyState({ icon: Icon = FileQuestion, title = 'No data', description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Icon className="w-12 h-12 text-gray-700" />
      <h3 className="text-lg font-medium text-gray-400">{title}</h3>
      {description && <p className="text-sm text-gray-600 max-w-md">{description}</p>}
    </div>
  )
}
