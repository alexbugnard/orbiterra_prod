import { buildStravaAuthUrl } from '@/lib/strava'

export default function ConnectStravaPage() {
  const callbackUrl =
    process.env.NEXTAUTH_URL + '/api/strava/callback'
  const { url: authUrl } = buildStravaAuthUrl(callbackUrl)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Connect Strava</h1>
      <p className="text-slate-400 mb-8">
        This one-time step authorizes the app to read your Strava activities automatically.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-xl">
            🚴
          </div>
          <div>
            <div className="text-sm font-medium text-white">Strava Authorization</div>
            <div className="text-xs text-slate-500">Read-only access to activities</div>
          </div>
        </div>
        <a
          href={authUrl}
          className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Authorize with Strava →
        </a>
      </div>
    </div>
  )
}
