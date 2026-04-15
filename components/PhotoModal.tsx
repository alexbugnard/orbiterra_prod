'use client'

interface PhotoModalProps {
  imageUrl: string
  title: string
  onClose: () => void
}

export function PhotoModal({ imageUrl, title, onClose }: PhotoModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg overflow-hidden max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={imageUrl} alt={title} className="w-full object-contain max-h-[70vh]" />
        <div className="p-4 flex justify-between items-center">
          <p className="font-medium text-gray-800">{title}</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
      </div>
    </div>
  )
}
