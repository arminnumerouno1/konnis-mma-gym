import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { wantsSmoothScroll } from './motion'

export function useSiteMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !wantsSmoothScroll()) return

    gsap.registerPlugin(ScrollTrigger)
    ScrollTrigger.config({ ignoreMobileResize: true })

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.092,
      wheelMultiplier: 0.92,
      syncTouch: false,
      allowNestedScroll: true,
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
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
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
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.n))
          },
        })
      })
    })

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 180)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      ctx.revert()
      gsap.ticker.remove(onTicker)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [enabled])
}
