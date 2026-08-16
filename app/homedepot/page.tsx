'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomeDepotPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(false)
  const [cart, setCart] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [orderTotal, setOrderTotal] = useState(0)

  const categories = [
    'All', 'Roofing', 'Siding', 'Windows', 'Doors', 'Gutters', 
    'Decking', 'Insulation', 'Fasteners', 'Tools', 'Paint', 'Lumber'
  ]

  // Simulated Home Depot product database
  const productDatabase = {
    'Roofing': [
      { id: 1, name: 'GAF Timberline HDZ Shingles', brand: 'GAF', price: 42.97, unit: 'bundle', sku: '1003-636-340', inStock: true, image: '🏠' },
      { id: 2, name: 'Owens Corning Oakridge Shingles', brand: 'Owens Corning', price: 39.97, unit: 'bundle', sku: '1003-636-341', inStock: true, image: '🏠' },
      { id: 3, name: 'CertainTeed Landmark Shingles', brand: 'CertainTeed', price: 44.97, unit: 'bundle', sku: '1003-636-342', inStock: true, image: '🏠' },
      { id: 4, name: 'GAF StormGuard Underlayment', brand: 'GAF', price: 89.97, unit: 'roll', sku: '1003-636-343', inStock: true, image: '📋' },
      { id: 5, name: 'Roofing Nails 1-1/4"', brand: 'Grip-Rite', price: 12.97, unit: 'lb', sku: '1003-636-344', inStock: true, image: '🔨' },
      { id: 6, name: 'Ice & Water Shield', brand: 'GAF', price: 129.97, unit: 'roll', sku: '1003-636-345', inStock: true, image: '🧊' },
    ],
    'Siding': [
      { id: 7, name: 'HardiePlank Lap Siding', brand: 'James Hardie', price: 2.97, unit: 'sq ft', sku: '1003-636-350', inStock: true, image: '🏠' },
      { id: 8, name: 'Vinyl Siding - White', brand: 'CertainTeed', price: 1.97, unit: 'sq ft', sku: '1003-636-351', inStock: true, image: '🏠' },
      { id: 9, name: 'Vinyl Siding - Gray', brand: 'CertainTeed', price: 2.17, unit: 'sq ft', sku: '1003-636-352', inStock: true, image: '🏠' },
      { id: 10, name: 'Siding J-Channel', brand: 'Fypon', price: 4.97, unit: 'each', sku: '1003-636-353', inStock: true, image: '🔧' },
      { id: 11, name: 'Corner Posts for Siding', brand: 'Fypon', price: 12.97, unit: 'each', sku: '1003-636-354', inStock: true, image: '🔧' },
      { id: 12, name: 'House Wrap', brand: 'Tyvek', price: 89.97, unit: 'roll', sku: '1003-636-355', inStock: true, image: '📋' },
    ],
    'Windows': [
      { id: 13, name: 'Double Hung Window - 36x54', brand: 'JELD-WEN', price: 299.97, unit: 'each', sku: '1003-636-360', inStock: true, image: '🪟' },
      { id: 14, name: 'Casement Window - 30x48', brand: 'Andersen', price: 449.97, unit: 'each', sku: '1003-636-361', inStock: true, image: '🪟' },
      { id: 15, name: 'Sliding Window - 48x48', brand: 'Pella', price: 399.97, unit: 'each', sku: '1003-636-362', inStock: true, image: '🪟' },
      { id: 16, name: 'Window Installation Kit', brand: 'DAP', price: 24.97, unit: 'kit', sku: '1003-636-363', inStock: true, image: '🔧' },
    ],
    'Doors': [
      { id: 17, name: 'Steel Entry Door - 36x80', brand: 'Masonite', price: 499.97, unit: 'each', sku: '1003-636-370', inStock: true, image: '🚪' },
      { id: 18, name: 'French Door - 36x80', brand: 'JELD-WEN', price: 799.97, unit: 'each', sku: '1003-636-371', inStock: true, image: '🚪' },
      { id: 19, name: 'Sliding Patio Door - 72x80', brand: 'Andersen', price: 1299.97, unit: 'each', sku: '1003-636-372', inStock: true, image: '🚪' },
    ],
    'Gutters': [
      { id: 20, name: '5" Seamless Gutters - White', brand: 'Amerimax', price: 6.97, unit: 'ft', sku: '1003-636-380', inStock: true, image: '🌧️' },
      { id: 21, name: '6" Seamless Gutters - Brown', brand: 'Amerimax', price: 8.97, unit: 'ft', sku: '1003-636-381', inStock: true, image: '🌧️' },
      { id: 22, name: 'Gutter Guards', brand: 'Amerimax', price: 4.97, unit: 'ft', sku: '1003-636-382', inStock: true, image: '🛡️' },
      { id: 23, name: 'Downspout - 4"', brand: 'Amerimax', price: 14.97, unit: 'each', sku: '1003-636-383', inStock: true, image: '📐' },
    ],
    'Decking': [
      { id: 24, name: 'Composite Decking - Gray', brand: 'Trex', price: 2.97, unit: 'sq ft', sku: '1003-636-390', inStock: true, image: '🪵' },
      { id: 25, name: 'Composite Decking - Brown', brand: 'TimberTech', price: 3.17, unit: 'sq ft', sku: '1003-636-391', inStock: true, image: '🪵' },
      { id: 26, name: 'Deck Screws', brand: 'Grip-Rite', price: 24.97, unit: 'box', sku: '1003-636-392', inStock: true, image: '🔨' },
    ],
    'Insulation': [
      { id: 27, name: 'R-38 Attic Insulation', brand: 'Owens Corning', price: 49.97, unit: 'roll', sku: '1003-636-400', inStock: true, image: '🧊' },
      { id: 28, name: 'R-13 Wall Insulation', brand: 'Johns Manville', price: 29.97, unit: 'roll', sku: '1003-636-401', inStock: true, image: '🧊' },
    ],
    'Fasteners': [
      { id: 29, name: 'Roofing Nails 1-1/4"', brand: 'Grip-Rite', price: 12.97, unit: 'lb', sku: '1003-636-410', inStock: true, image: '🔨' },
      { id: 30, name: 'Siding Nails 2"', brand: 'Grip-Rite', price: 14.97, unit: 'lb', sku: '1003-636-411', inStock: true, image: '🔨' },
      { id: 31, name: 'Deck Screws 3"', brand: 'Grip-Rite', price: 24.97, unit: 'box', sku: '1003-636-412', inStock: true, image: '🔨' },
    ],
    'Tools': [
      { id: 32, name: 'Roofing Shovel', brand: 'Bully Tools', price: 34.97, unit: 'each', sku: '1003-636-420', inStock: true, image: '🔧' },
      { id: 33, name: 'Nail Gun - Roofing', brand: 'DEWALT', price: 299.97, unit: 'each', sku: '1003-636-421', inStock: true, image: '🔧' },
      { id: 34, name: 'Ladder 32ft', brand: 'Werner', price: 399.97, unit: 'each', sku: '1003-636-422', inStock: true, image: '🏗️' },
    ],
    'Paint': [
      { id: 35, name: 'Exterior Paint - White', brand: 'BEHR', price: 39.97, unit: 'gallon', sku: '1003-636-430', inStock: true, image: '🎨' },
      { id: 36, name: 'Exterior Paint - Gray', brand: 'BEHR', price: 39.97, unit: 'gallon', sku: '1003-636-431', inStock: true, image: '🎨' },
    ],
    'Lumber': [
      { id: 37, name: '2x4 Pressure Treated - 8ft', brand: 'GP', price: 5.97, unit: 'each', sku: '1003-636-440', inStock: true, image: '🪵' },
      { id: 38, name: '4x8 Plywood 1/2"', brand: 'GP', price: 34.97, unit: 'sheet', sku: '1003-636-441', inStock: true, image: '🪵' },
      { id: 39, name: '4x8 OSB 7/16"', brand: 'GP', price: 24.97, unit: 'sheet', sku: '1003-636-442', inStock: true, image: '🪵' },
    ],
  }

  const searchProducts = () => {
    setLoading(true)
    setTimeout(() => {
      let products: any[] = []
      
      if (search.trim()) {
        // Search all categories
        Object.values(productDatabase).forEach((items: any) => {
          items.forEach((item: any) => {
            if (item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.brand.toLowerCase().includes(search.toLowerCase())) {
              products.push(item)
            }
          })
        })
      } else if (category !== 'All') {
        products = productDatabase[category as keyof typeof productDatabase] || []
      } else {
        // Show all products
        Object.values(productDatabase).forEach((items: any) => {
          products = [...products, ...items]
        })
      }
      
      setResults(products.slice(0, 20))
      setLoading(false)
    }, 800)
  }

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? {...item, quantity: (item.quantity || 1) + 1} : item
      ))
    } else {
      setCart([...cart, {...product, quantity: 1}])
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
    setOrderTotal(total)
  }

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id))
    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
    setOrderTotal(total)
  }

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
  }

  const checkout = () => {
    if (cart.length === 0) {
      alert('Your cart is empty!')
      return
    }
    alert(`✅ Order placed successfully!\n\nTotal: $${getTotal().toFixed(2)}\nItems: ${cart.length}\n\nYour order will be ready for pickup at your local Home Depot.`)
    setCart([])
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🏪 Home Depot Direct</h1>
          <span className="ml-2 bg-yellow-400 text-black text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        {/* Search */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-orange-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="flex-1 p-2 border rounded-lg text-sm"
              onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
            />
            <button
              onClick={searchProducts}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              🔍 Search
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setSearch(''); setTimeout(searchProducts, 100) }}
                className={`text-xs px-3 py-1 rounded-full ${
                  category === cat ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">{cart.length} items in cart</p>
                <p className="text-2xl font-bold text-orange-600">${getTotal().toFixed(2)}</p>
              </div>
              <button
                onClick={checkout}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
              >
                🛒 Checkout
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-2">⏳</span>
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{results.length} products found</p>
            {results.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{product.image}</span>
                      <div>
                        <p className="font-semibold text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.brand}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">SKU: {product.sku}</span>
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">✓ In Stock</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">${product.price}</p>
                    <p className="text-xs text-gray-400">/ {product.unit}</p>
                    <button
                      onClick={() => addToCart(product)}
                      className="mt-1 bg-orange-600 text-white text-xs px-3 py-1 rounded"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <span className="text-4xl block mb-2">🏪</span>
            <p className="text-gray-500">Search for products or select a category</p>
            <p className="text-xs text-gray-400 mt-1">Direct pricing from Home Depot</p>
          </div>
        )}

        {/* Cart Items */}
        {cart.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4 border border-orange-200">
            <h3 className="font-semibold text-sm mb-3">🛒 Cart</h3>
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.quantity} × ${item.price}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="mt-3 pt-2 border-t flex justify-between font-bold">
              <span>Total</span>
              <span className="text-orange-600">${getTotal().toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Quick Add from Estimate */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">💡 Quick tip: Use the Estimate Templates to create a material list, then add all items to cart!</p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/homedepot')} className="flex flex-col items-center text-orange-600">
          <span className="text-xl">🏪</span>
          <span className="text-xs">HD</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/upsell')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Upsell</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
