import { useEffect } from 'react'
import { GYM } from '../brand/gym'

const EMBED_SRC = 'https://www.instagram.com/embed.js'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

function processEmbed() {
  window.instgrm?.Embeds.process()
}

export function InstagramEmbed() {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${EMBED_SRC}"]`)
    if (window.instgrm) {
      processEmbed()
      return
    }
    if (existing) {
      existing.addEventListener('load', processEmbed)
      return () => existing.removeEventListener('load', processEmbed)
    }
    const script = document.createElement('script')
    script.src = EMBED_SRC
    script.async = true
    script.onload = processEmbed
    document.body.appendChild(script)
  }, [])

  return (
    <div className="ig-embed">
      <blockquote className="instagram-media" data-instgrm-permalink={GYM.instagram} data-instgrm-version="14">
        <a href={GYM.instagram} target="_blank" rel="noreferrer">
          {GYM.instagramHandle} auf Instagram
        </a>
      </blockquote>
    </div>
  )
}
