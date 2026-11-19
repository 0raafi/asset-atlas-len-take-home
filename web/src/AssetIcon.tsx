import { Building03Icon, TruckIcon, Wifi01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { AssetType } from './assets'

const icons = { device: Wifi01Icon, vehicle: TruckIcon, facility: Building03Icon }

export function AssetIcon({ type }: { type: AssetType }) {
  return (
    <span className={`asset-icon asset-icon--${type}`} aria-hidden="true">
      <HugeiconsIcon icon={icons[type]} size={18} strokeWidth={1.7} />
    </span>
  )
}
