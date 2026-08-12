import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Deliberately synchronous: `isMobile` starts `undefined` so SSR/first
    // paint always renders the non-mobile layout, then this effect computes
    // the real value once `window` exists client-side, mirroring the
    // mount-flag pattern in theme-toggle.tsx. Computing it eagerly here
    // (rather than only reacting to `change` events) is what keeps the
    // sidebar correct on a client whose initial viewport is already narrow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
