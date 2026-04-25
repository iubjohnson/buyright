import { useState, useRef } from 'react'

function FileZone({ label, description, file, onFile }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
        dragging
          ? 'border-indigo-500 bg-indigo-50'
          : file
          ? 'border-green-400 bg-green-50'
          : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <>
          <svg className="h-8 w-8 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-700">{file.name}</p>
          <p className="text-xs text-green-600 mt-1">Click to replace</p>
        </>
      ) : (
        <>
          <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-500 mt-1 text-center">{description}</p>
          <p className="text-xs text-gray-400 mt-2">Click or drag & drop .csv</p>
        </>
      )}
    </div>
  )
}

export default function UploadStep({ onProcess, isProcessing }) {
  const [salesFile, setSalesFile] = useState(null)
  const [productFile, setProductFile] = useState(null)
  const [error, setError] = useState(null)

  const canProcess = salesFile && productFile && !isProcessing

  const handleProcess = async () => {
    setError(null)
    try {
      await onProcess(salesFile, productFile)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Upload your data</h2>
        <p className="text-sm text-gray-500 mb-8">
          Upload your sales history and product master to generate an AI-powered buy list.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">File 1 — Sales History</p>
            <FileZone
              label="Sales History CSV"
              description="SKU · Product Name · Sales Date · Qty Sold"
              file={salesFile}
              onFile={setSalesFile}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">File 2 — Product Master</p>
            <FileZone
              label="Product Master CSV"
              description="SKU · Product Name · On Hand Qty · Vendor"
              file={productFile}
              onFile={setProductFile}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            'Generate Buy List'
          )}
        </button>
      </div>
    </div>
  )
}
