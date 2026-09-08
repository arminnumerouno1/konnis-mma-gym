import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { introReveal, scrollProgress } from '../store'

gsap.registerPlugin(ScrollTrigger)

export function useScrollExperience(reducedMotion: boolean, ready: boolean): void {
  useEffect(() => {
    if (reducedMotion) {
      scrollProgress.current = 0.1
      introReveal.value = 1
      return
    }

    const revealTween = gsap.to(introReveal, {
      value: 1,
      duration: 3.1,
      delay: 0.35,
      ease: 'power2.inOut',
    })

    const coarse = window.matchMedia('(pointer: coarse)').matches
    let lenis: Lenis | null = null
    let ticker: ((time: number) => void) | null = null

    if (!coarse) {
      lenis = new Lenis({
        lerp: 0.076,
        wheelMultiplier: 0.8,
        smoothWheel: true,
        autoRaf: false,
        syncTouch: false,
      })
      lenis.on('scroll', ScrollTrigger.update)
      ticker = (time: number) => {
        lenis?.raf(time * 1000)
      }
      gsap.ticker.add(ticker)
      gsap.ticker.lagSmoothing(0)
    }

    const trigger = ScrollTrigger.create({
      trigger: '#scroll-track',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scrollProgress.current = self.progress
      },
    })

    const onNativeScroll = () => {
      if (lenis) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollProgress.current = max > 0 ? window.scrollY / max : 0
    }

    if (!lenis) {
      window.addEventListener('scroll', onNativeScroll, { passive: true })
      onNativeScroll()
    }

    const onResize = () => {
      ScrollTrigger.refresh()
    }
    window.addEventListener('resize', onResize)

    return () => {
      revealTween.kill()
      trigger.kill()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onNativeScroll)
      if (ticker) gsap.ticker.remove(ticker)
      lenis?.destroy()
    }
  }, [reducedMotion])

  useEffect(() => {
    if (ready) ScrollTrigger.refresh()
  }, [ready])
}
