import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

export function ScrollProgress() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setWidth(max > 0 ? (window.scrollY / max) * 100 : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className="scroll-progress" style={{ width: `${width}%` }} />
}
