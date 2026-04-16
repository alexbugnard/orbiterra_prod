export interface YoutubeVideo {
  youtube_id: string
  title: string
  published_at: string
}

function parseRssFeed(xml: string): YoutubeVideo[] {
  const videos: YoutubeVideo[] = []
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? []

  for (const entry of entries) {
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)

    if (idMatch && titleMatch && publishedMatch) {
      videos.push({
        youtube_id: idMatch[1],
        title: titleMatch[1],
        published_at: publishedMatch[1],
      })
    }
  }

  return videos
}

export async function fetchChannelVideos(channelId: string): Promise<YoutubeVideo[]> {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  )
  if (!res.ok) throw new Error(`YouTube RSS feed failed: ${res.status}`)
  return parseRssFeed(await res.text())
}
