import Groq from '@lobehub/icons/es/Groq/components/Mono'
import LmStudio from '@lobehub/icons/es/LmStudio/components/Mono'
import OpenRouter from '@lobehub/icons/es/OpenRouter/components/Mono'
import { SlidersHorizontal } from '../lib/icons'
import aiHordeIcon from '../../assets/providers/ai-horde.png'

const BRAND_ICONS = {
  groq: { Icon: Groq, color: '#F55036' },
  'lm-studio': { Icon: LmStudio, color: '#4338CA' },
  openrouter: { Icon: OpenRouter, color: '#6566F1' },
}

export default function ProviderIcon({ providerId, size = 24, className = '' }) {
  const brand = BRAND_ICONS[providerId]
  if (brand) {
    const { Icon, color } = brand
    return <Icon size={size} style={{ color }} className={className} />
  }
  if (providerId === 'ai-horde') {
    return <img src={aiHordeIcon} width={size} height={size} alt="AI Horde" className={className} />
  }
  return <SlidersHorizontal size={size} className={`text-primary ${className}`} />
}
