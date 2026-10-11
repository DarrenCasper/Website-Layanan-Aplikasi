// Mock catalog reproducing the Figma "Explore Page" (25:2) and
// "ProductDescription" (43:107) frames.
//
// The backend Product model only stores name, price, stock, description and
// tags, so the images, ratings, sold counts and GPU variants the designs show
// live here instead. The Explore page falls back to this list whenever the API
// returns nothing or cannot be reached.

import type { CatalogProduct } from './catalog'

import product01 from '../assets/catalog/product-01.png'
import product02 from '../assets/catalog/product-02.png'
import product03 from '../assets/catalog/product-03.png'
import product04 from '../assets/catalog/product-04.png'
import product05 from '../assets/catalog/product-05.png'
import product06 from '../assets/catalog/product-06.png'
import product07 from '../assets/catalog/product-07.png'
import product08 from '../assets/catalog/product-08.png'
import product09 from '../assets/catalog/product-09.png'
import product10 from '../assets/catalog/product-10.png'
import product11 from '../assets/catalog/product-11.png'
import product12 from '../assets/catalog/product-12.png'
import product13 from '../assets/catalog/product-13.png'
import product14 from '../assets/catalog/product-14.png'
import product15 from '../assets/catalog/product-15.png'
import product16 from '../assets/catalog/product-16.png'
import product17 from '../assets/catalog/product-17.png'
import product18 from '../assets/catalog/product-18.png'
import product19 from '../assets/catalog/product-19.png'
import product20 from '../assets/catalog/product-20.png'
import productDetailMain from '../assets/catalog/product-detail-main.png'

/** Every card image from the design, in the order the Explore frame uses them. */
export const productImages: string[] = [
  product01,
  product02,
  product03,
  product04,
  product05,
  product06,
  product07,
  product08,
  product09,
  product10,
  product11,
  product12,
  product13,
  product14,
  product15,
  product16,
  product17,
  product18,
  product19,
  product20,
]

/** High resolution render used as the hero on the Product Description frame. */
export const productDetailMainImage = productDetailMain

export const DEPARTMENT_SECTION = 'Barang dari Departemen Teknik Komputer'
export const FTEIC_SECTION = 'Barang dari FTEIC'

const DEFAULT_CITY = 'Kota Surabaya'

// The five paragraphs the Figma detail frame shows for the featured PC build.
const FEATURED_DESCRIPTION = [
  'Nikmati performa maksimal dengan PC Gaming Rakitan ini, yang dilengkapi dengan prosesor Ryzen 7 7800XD dan kartu grafis RTX 5090. Kombinasi ini menjamin pengalaman bermain game terbaru yang mulus dan tanpa gangguan.',
  'Spesifikasi lengkapnya mencakup 256GB RAM dan penyimpanan NVME 4TB, memberikan kecepatan akses data yang sangat cepat serta ruang yang cukup untuk semua game dan aplikasi favorit Anda.',
  'Dilengkapi dengan fitur tambahan seperti port USB 3.2, HDMI 2.1, dan dukungan NVME, Anda akan mendapatkan konektivitas terbaik untuk semua perangkat Anda. Rasakan pengalaman gaming yang lebih mendalam dengan dukungan resolusi tinggi dan refresh rate yang cepat.',
  'Sebagai pembeli yang bijak, pastikan untuk memeriksa semua spesifikasi dan fitur sebelum melakukan pembelian. Jangan ragu untuk bertanya jika ada yang kurang jelas.',
  'Harap dicatat, semua unit akan dikemas dengan aman menggunakan packingan kayu untuk memastikan keamanan selama pengiriman.',
].join('\n\n')

const FEATURED_VARIANTS = ['RTX 5090', 'RTX 4090', 'RTX 3090', 'RX 6600', 'RX 6900', 'RX 7700']

function genericDescription(name: string, merchantName: string): string {
  return [
    `${name} dijual oleh ${merchantName} dalam kondisi baik dan siap digunakan.`,
    'Barang dapat dilihat langsung sebelum dibeli. Silakan hubungi penjual untuk menanyakan spesifikasi lengkap, kelengkapan unit, dan ketersediaan stok terbaru.',
  ].join('\n\n')
}

type CatalogSeed = {
  id: string
  name: string
  price: number
  image: string
  rating: number
  sold: number
  stock: number
  merchantName: string
  tags: string[]
  variants?: string[]
  description?: string
}

// The 20 cards the Explore frame lays out under
// "Barang dari Departemen Teknik Komputer". The last six repeat the artwork of
// earlier cards, which is exactly how the design fills its lower rows.
const departmentSeeds: CatalogSeed[] = [
  {
    id: 'mock-1',
    name: 'PC Rakitan Gaming | Ryzen 7 7800XD',
    price: 64000000,
    image: productDetailMain,
    rating: 4.5,
    sold: 80,
    stock: 128,
    merchantName: 'PC Jaya Komputer',
    tags: ['pc rakitan', 'gaming', 'ryzen'],
    variants: FEATURED_VARIANTS,
    description: FEATURED_DESCRIPTION,
  },
  {
    id: 'mock-2',
    name: 'Kucing bandelll',
    price: 305000,
    image: product02,
    rating: 5.0,
    sold: 6,
    stock: 9,
    merchantName: 'Pet Corner Surabaya',
    tags: ['kucing', 'hewan'],
  },
  {
    id: 'mock-3',
    name: 'V-COLOR 2x32GB DDR6 6000MTs',
    price: 128000000,
    image: product03,
    rating: 4.3,
    sold: 54,
    stock: 24,
    merchantName: 'PC Jaya Komputer',
    tags: ['ram', 'memory', 'ddr6'],
  },
  {
    id: 'mock-4',
    name: 'The design is very human',
    price: 17000000,
    image: product04,
    rating: 4.5,
    sold: 80,
    stock: 15,
    merchantName: 'Studio Desain Manusiawi',
    tags: ['desain', 'jasa'],
  },
  {
    id: 'mock-5',
    name: 'Tukang parkir rewel gembosin ban gua',
    price: 99000,
    image: product05,
    rating: 4.5,
    sold: 80,
    stock: 40,
    merchantName: 'Toko Serba Ada',
    tags: ['parkir', 'jasa'],
  },
  {
    id: 'mock-6',
    name: 'Kucing oyen awawuuu',
    price: 4000000,
    image: product06,
    rating: 4.0,
    sold: 3,
    stock: 4,
    merchantName: 'Pet Corner Surabaya',
    tags: ['kucing', 'oyen', 'hewan'],
  },
  {
    id: 'mock-7',
    name: 'Silakan naik bosss',
    price: 44400000,
    image: product07,
    rating: 0.0,
    sold: 0,
    stock: 12,
    merchantName: 'Bengkel Las Mandiri',
    tags: ['tangga', 'perkakas'],
  },
  {
    id: 'mock-8',
    name: 'Bukan motor gua',
    price: 160000000,
    image: product08,
    rating: 4.9,
    sold: 1,
    stock: 1,
    merchantName: 'Motor Antik Surabaya',
    tags: ['motor', 'klasik'],
  },
  {
    id: 'mock-9',
    name: 'Alat tambang ilegal obral murah',
    price: 120000000,
    image: product09,
    rating: 4.4,
    sold: 18,
    stock: 6,
    merchantName: 'Alat Berat Nusantara',
    tags: ['alat berat', 'tambang'],
  },
  {
    id: 'mock-10',
    name: 'NVIDIA RTX 3090 8x Array 24GB VRAM',
    price: 32000000,
    image: product10,
    rating: 4.3,
    sold: 7,
    stock: 8,
    merchantName: 'PC Jaya Komputer',
    tags: ['gpu', 'nvidia', 'rtx 3090'],
  },
  {
    id: 'mock-11',
    name: 'Alat dari gacoan 16x bisa buat manggil anjing',
    price: 8900000,
    image: product11,
    rating: 4.0,
    sold: 12,
    stock: 20,
    merchantName: 'Toko Serba Ada',
    tags: ['perkakas', 'unik'],
  },
  {
    id: 'mock-12',
    name: 'Meong kacamata matcha',
    price: 6540000,
    image: product12,
    rating: 4.8,
    sold: 12,
    stock: 7,
    merchantName: 'Pet Corner Surabaya',
    tags: ['kucing', 'kacamata', 'hewan'],
  },
  {
    id: 'mock-13',
    name: 'Server dari lab B201 dah gadipake',
    price: 32000000,
    image: product13,
    rating: 5.0,
    sold: 1,
    stock: 2,
    merchantName: 'PC Jaya Komputer',
    tags: ['server', 'rak server'],
  },
  {
    id: 'mock-14',
    name: 'PHOTOOLEX B320S sRGB 1600Hz',
    price: 618624,
    image: product14,
    rating: 4.4,
    sold: 16,
    stock: 30,
    merchantName: 'Gadget Surabaya',
    tags: ['monitor', 'display'],
  },
  {
    id: 'mock-15',
    name: 'Silakan naik bosss',
    price: 44400000,
    image: product07,
    rating: 0.0,
    sold: 0,
    stock: 12,
    merchantName: 'Bengkel Las Mandiri',
    tags: ['tangga', 'perkakas'],
  },
  {
    id: 'mock-16',
    name: 'Bukan motor gua',
    price: 160000000,
    image: product08,
    rating: 4.9,
    sold: 1,
    stock: 1,
    merchantName: 'Motor Antik Surabaya',
    tags: ['motor', 'klasik'],
  },
  {
    id: 'mock-17',
    name: 'Alat tambang ilegal obral murah',
    price: 120000000,
    image: product09,
    rating: 4.4,
    sold: 18,
    stock: 6,
    merchantName: 'Alat Berat Nusantara',
    tags: ['alat berat', 'tambang'],
  },
  {
    id: 'mock-18',
    name: 'NVIDIA RTX 3090 8x Array 24GB VRAM',
    price: 32000000,
    image: product10,
    rating: 4.3,
    sold: 7,
    stock: 8,
    merchantName: 'PC Jaya Komputer',
    tags: ['gpu', 'nvidia', 'rtx 3090'],
  },
  {
    id: 'mock-19',
    name: 'Alat dari gacoan 16x bisa buat manggil anjing',
    price: 8900000,
    image: product11,
    rating: 4.0,
    sold: 12,
    stock: 20,
    merchantName: 'Toko Serba Ada',
    tags: ['perkakas', 'unik'],
  },
  {
    id: 'mock-20',
    name: 'Meong kacamata matcha',
    price: 6540000,
    image: product12,
    rating: 4.8,
    sold: 12,
    stock: 7,
    merchantName: 'Pet Corner Surabaya',
    tags: ['kucing', 'kacamata', 'hewan'],
  },
]

// The seven cards the Explore frame lays out under "Barang dari FTEIC". Every
// one of them reuses the same PC build, so the names and figures repeat.
const fteicImages = [product15, product16, product17, product18, product19, product20, product12]

const fteicSeeds: CatalogSeed[] = fteicImages.map((image, index) => ({
  id: `fteic-${index + 1}`,
  name: 'PC Rakitan Gaming | Ryzen 9700',
  price: 64000000,
  image,
  rating: 4.5,
  sold: 80,
  stock: 32,
  merchantName: 'PC Jaya Komputer',
  tags: ['pc rakitan', 'gaming', 'ryzen'],
}))

function toProduct(seed: CatalogSeed, section: string): CatalogProduct {
  return {
    id: seed.id,
    name: seed.name,
    price: seed.price,
    image: seed.image,
    rating: seed.rating,
    sold: seed.sold,
    stock: seed.stock,
    description: seed.description ?? genericDescription(seed.name, seed.merchantName),
    merchantName: seed.merchantName,
    merchantCity: DEFAULT_CITY,
    variants: seed.variants ?? [],
    tags: seed.tags,
    section,
  }
}

/** The full mock catalog, ordered exactly as the Explore frame lists it. */
export const mockProducts: CatalogProduct[] = [
  ...departmentSeeds.map((seed) => toProduct(seed, DEPARTMENT_SECTION)),
  ...fteicSeeds.map((seed) => toProduct(seed, FTEIC_SECTION)),
]

/** Looks a mock product up by id, used when the API has nothing to offer. */
export function findMockProduct(id: string): CatalogProduct | undefined {
  return mockProducts.find((product) => product.id === id)
}
