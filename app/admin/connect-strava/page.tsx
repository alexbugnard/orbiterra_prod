import { buildStravaAuthUrl } from '@/lib/strava'

export default function ConnectStravaPage() {
  const callbackUrl =
    process.env.NEXTAUTH_URL + '/api/strava/callback'
  const authUrl = buildStravaAuthUrl(callbackUrl)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Connect Strava</h1>
      <p className="mb-4 text-gray-600">
        This one-time step authorizes the app to read your Strava activities automatically.
      </p>
      <a
        href={authUrl}
        className="inline-block bg-orange-500 text-white px-6 py-3 rounded font-semibold hover:bg-orange-600"
      >
        Authorize with Strava
      </a>
    </div>
  )
}
