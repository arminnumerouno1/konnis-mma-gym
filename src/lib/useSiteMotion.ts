import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { prefersReducedMotion } from './motion'

export function useSiteMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return

    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.092,
      wheelMultiplier: 0.92,
    })

    const onTicker = (time: number) => {
      lenis.raf(time * 1000)
    }
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(onTicker)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 48, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          },
        )
      })

      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
        gsap.to(el, {
          yPercent: Number(el.dataset.parallax || -12),
          ease: 'none',
          scrollTrigger: { trigger: el.closest('section') ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
        })
      })

      gsap.utils.toArray<HTMLElement>('[data-scale]').forEach((el) => {
        gsap.fromTo(
          el,
          { scale: 0.92, opacity: 0.4 },
          {
            scale: 1,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 40%', scrub: true },
          },
        )
      })

      document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count || '0')
        const obj = { n: 0 }
        gsap.to(obj, {
          n: end,
          duration: 1.4,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.n))
          },
        })
      })
    })

    const onResize = () => ScrollTrigger.refresh()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      ctx.revert()
      gsap.ticker.remove(onTicker)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [enabled])
}
