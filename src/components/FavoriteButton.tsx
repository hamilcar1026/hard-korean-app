'use client'

interface Props {
  active: boolean
  onToggle?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export default function FavoriteButton({ active, onToggle, disabled, size = 'sm' }: Props) {
  const cls =
    size === 'md'
      ? 'p-2 rounded-xl transition-colors disabled:opacity-40'
      : 'p-1.5 rounded-lg transition-colors disabled:opacity-40'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle?.()
      }}
      disabled={disabled || !onToggle}
      title={active ? 'Remove favorite' : 'Add favorite'}
      aria-label={active ? 'Remove favorite' : 'Add favorite'}
      className={`${cls} ${
        active
          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
          : 'bg-card-surface text-text-faint hover:bg-border hover:text-amber-500'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.291c.3.922-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.291a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z"
        />
      </svg>
    </button>
  )
}
