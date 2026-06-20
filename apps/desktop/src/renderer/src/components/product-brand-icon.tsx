import { rendererPublicUrl } from '../lib/renderer-public-url'
import { cn } from './ui/cn'

/** Same asset as renderer `index.html` favicon (`public/favicon.svg`). */
const PRODUCT_FAVICON_SRC = rendererPublicUrl('favicon.svg')

interface ProductBrandIconProps {
  className?: string
}

export function ProductBrandIcon({ className }: ProductBrandIconProps) {
  return (
    <img
      src={PRODUCT_FAVICON_SRC}
      alt=""
      width={28}
      height={28}
      draggable={false}
      className={cn('h-8 w-8 shrink-0 rounded-xl object-contain', className)}
    />
  )
}
