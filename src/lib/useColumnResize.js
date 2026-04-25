import { useState, useCallback, useRef, useEffect } from 'react'

export function useColumnResize(initialWidths) {
  const [widths, setWidths] = useState(initialWidths)
  const widthsRef = useRef(widths)

  useEffect(() => { widthsRef.current = widths }, [widths])

  const startResize = useCallback((index, e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = widthsRef.current[index]

    const onMouseMove = (e) => {
      const newWidth = Math.max(60, startWidth + e.clientX - startX)
      setWidths(prev => { const next = [...prev]; next[index] = newWidth; return next })
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return { widths, startResize }
}
