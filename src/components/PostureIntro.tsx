import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import sittingSrc from '../assets/sitting-figure.png'
import standingSrc from '../assets/standing-figure.png'
import { recolorSilhouette } from '../lib/recolorArt'
import { UI } from '../lib/palette'

function useRecolored(src: string, kind: 'sitting' | 'standing') {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setUrl(recolorSilhouette(img, kind))
    img.src = src
  }, [src, kind])
  return url
}

const ECG =
  'M 0 42 H 36 L 44 42 L 50 18 L 56 64 L 64 42 H 108 L 116 42 L 122 22 L 128 60 L 136 42 H 168 L 176 42 L 182 14 L 188 68 L 198 42 H 240 L 248 42 L 254 24 L 260 58 L 268 42 H 320'

type PostureIntroProps = {
  progress: number
}

export function PostureIntro({ progress }: PostureIntroProps) {
  const sitting = useRecolored(sittingSrc, 'sitting')
  const standing = useRecolored(standingSrc, 'standing')

  return (
    <div
      className="mx-auto grid w-full max-w-5xl items-end gap-2 md:grid-cols-[1fr_minmax(12rem,18rem)_1fr] md:gap-0"
      aria-hidden="false"
    >
      <figure className="relative mx-auto w-[min(100%,20rem)]">
        <p className="mb-2 text-center text-[11px] font-medium tracking-[0.22em] text-sage-deep uppercase">
          Sitting
        </p>
        <div className="relative">
          <svg
            viewBox="0 0 887 1024"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <ellipse cx="548" cy="78" rx="34" ry="34" fill="#ead5d0" />
            <ellipse cx="505" cy="195" rx="100" ry="108" fill="#ead5d0" opacity="0.9" />
          </svg>
          {sitting ? (
            <motion.img
              src={sitting}
              alt="Line drawing of a pregnant woman sitting, one hand on her belly"
              className="relative block w-full select-none"
              draggable={false}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          ) : (
            <div className="aspect-[887/1024] w-full" />
          )}
        </div>
      </figure>

      <div className="relative flex h-28 items-center px-1 md:mb-[28%] md:h-32">
        <svg
          viewBox="0 0 320 80"
          className="h-full w-full"
          role="img"
          aria-label="Heartbeat connecting sitting to standing"
        >
          <path
            d={ECG}
            fill="none"
            stroke={UI.blushDeep}
            strokeOpacity={0.28}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <motion.path
            d={ECG}
            fill="none"
            stroke={UI.blushDeep}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - progress}
          />
          <g transform="translate(160 40)">
            <motion.g
              animate={{ scale: [1, 1.08, 0.98, 1.05, 1] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.16, 0.32, 0.48, 1],
              }}
            >
              <path
                d="M0 14 C0 14 -18 2 -18 -6 C-18 -14 -10 -18 -5 -13 C-2 -10 0 -6 0 -2 C0 -6 2 -10 5 -13 C10 -18 18 -14 18 -6 C18 2 0 14 0 14 Z"
                fill={UI.blushDeep}
                fillOpacity={0.45}
                stroke={UI.blushDeep}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </motion.g>
          </g>
        </svg>
      </div>

      <figure className="relative mx-auto w-[min(100%,16rem)]">
        <p className="mb-2 text-center text-[11px] font-medium tracking-[0.22em] text-sage-deep uppercase">
          Standing
        </p>
        <div className="relative">
          <svg
            viewBox="0 0 565 1024"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <ellipse cx="225" cy="158" rx="82" ry="92" fill="#ead5d0" opacity="0.88" />
            <ellipse cx="195" cy="460" rx="118" ry="148" fill={UI.blushDeep} opacity="0.5" />
            <ellipse cx="295" cy="745" rx="100" ry="84" fill={UI.stone} opacity="0.42" />
          </svg>
          {standing ? (
            <motion.img
              src={standing}
              alt="Line drawing of a pregnant woman standing, one hand on her belly"
              className="relative block w-full select-none"
              draggable={false}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.12 }}
            />
          ) : (
            <div className="aspect-[565/1024] w-full" />
          )}
        </div>
      </figure>
    </div>
  )
}
