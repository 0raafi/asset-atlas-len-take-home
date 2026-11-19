import { Building2, Radio, Truck } from 'lucide-react'
import type { AssetType } from './assets'

const icons = { device: Radio, vehicle: Truck, facility: Building2 }

export function AssetIcon({ type }: { type: AssetType }) {
  const Icon = icons[type]
  return (
    <span className={`asset-icon asset-icon--${type}`} aria-hidden="true">
      <Icon size={19} strokeWidth={1.8} />
    </span>
  )
}
