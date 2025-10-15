"use client"

import { useEffect, useMemo, useState } from "react"

export default function InlineRemarks({ initial, onSave }: { initial?: string; onSave: (value: string) => Promise<any> }) {
  const [value, setValue] = useState(initial || "")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(initial || "")
    setDirty(false)
  }, [initial])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(value)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initial || "")
    setDirty(false)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded px-2 py-1 text-sm w-48 bg-white"
        value={value}
        onChange={(e) => { setValue(e.target.value); setDirty(true) }}
        placeholder="Add remarks"
      />
      {dirty && (
        <>
          <button onClick={handleSave} disabled={saving} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={handleCancel} disabled={saving} className="text-xs px-2 py-1 border rounded">Cancel</button>
        </>
      )}
    </div>
  )
}
