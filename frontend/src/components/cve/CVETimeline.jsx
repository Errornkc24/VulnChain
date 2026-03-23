import { Clock, ArrowRight } from 'lucide-react'

export default function CVETimeline({ history }) {
  if (!history?.length) return null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">History</h3>
      <div className="space-y-3">
        {history.map((entry, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-surface-lighter border border-gray-700 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-gray-500" />
              </div>
              {i < history.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-gray-300 font-medium">{entry.action?.replace(/_/g, ' ')}</p>
              {entry.oldValue && entry.newValue && (
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-gray-500">{entry.oldValue}</span>
                  <ArrowRight size={12} className="text-gray-600" />
                  <span className="text-matrix">{entry.newValue}</span>
                </div>
              )}
              {entry.notes && <p className="text-gray-500 text-xs mt-1">{entry.notes}</p>}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                <span>{entry.actorOrg}</span>
                <span>·</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
