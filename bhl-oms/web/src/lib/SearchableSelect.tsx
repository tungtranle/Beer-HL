'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'

interface Option {
  value: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Highlight matched words in text
function highlightWords(text: string, words: string[]): React.ReactNode {
  if (words.length === 0) return text
  // Build regex that matches any of the search words
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  if (parts.length <= 1) return text
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm px-0.5">{part}</mark>
      : part
  )
}

// Multi-word AND search with relevance scoring
function scoreMatch(option: Option, words: string[]): number {
  const label = option.label.toLowerCase()
  const sublabel = (option.sublabel || '').toLowerCase()
  const combined = label + ' ' + sublabel

  // All words must appear somewhere in label+sublabel
  for (const w of words) {
    if (!combined.includes(w)) return -1
  }

  let score = 0
  for (const w of words) {
    if (label === w) {
      score += 100                              // exact full match
    } else if (label.startsWith(w)) {
      score += 50                               // starts with word
    } else if (label.includes(w)) {
      // Bonus if word starts at a word boundary (after space, dash, etc.)
      const idx = label.indexOf(w)
      if (idx === 0 || /[\s\-—_/().]/.test(label[idx - 1])) {
        score += 30                             // word-boundary match
      } else {
        score += 15                             // substring match
      }
    } else if (sublabel.includes(w)) {
      score += 5                                // only in sublabel
    }
  }
  // More words matched in label = better
  return score
}

export default function SearchableSelect({ options, value, onChange, placeholder = '-- Chọn --', className = '' }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return options

    const scored: { option: Option; score: number }[] = []
    for (const o of options) {
      const s = scoreMatch(o, words)
      if (s >= 0) scored.push({ option: o, score: s })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.map(s => s.option)
  }, [search, options])

  const handleSelect = useCallback((val: string) => {
    onChange(val)
    setSearch('')
    setOpen(false)
  }, [onChange])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border rounded-lg px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 flex items-center justify-between"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 flex flex-col">
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc tên..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 border-b"
              >
                ✕ Bỏ chọn
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Không tìm thấy</div>
            ) : (
              filtered.map(o => {
                const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => handleSelect(o.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-amber-50 transition ${
                      o.value === value ? 'bg-amber-100 font-medium' : ''
                    }`}
                  >
                    <div>{highlightWords(o.label, words)}</div>
                    {o.sublabel && <div className="text-xs text-gray-400">{highlightWords(o.sublabel, words)}</div>}
                  </button>
                )
              })
            )}
          </div>
          <div className="px-3 py-1.5 border-t bg-gray-50 text-xs text-gray-400">
            {filtered.length}/{options.length} kết quả
          </div>
        </div>
      )}
    </div>
  )
}
