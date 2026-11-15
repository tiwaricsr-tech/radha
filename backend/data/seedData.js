const crypto = require('crypto');

const makeId = () => crypto.randomBytes(12).toString('hex');

const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString();
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();

function createSeedData() {
  const products = [
    {
      _id: makeId(),
      name: 'Royal Silver Kaju Katli',
      category: 'Sweets',
      description: 'Silky pure Goan cashew fudge slow-cooked in organic sugar syrup and adorned with edible silver varq.',
      image: '/uploads/images/kaju-katli.jpg',
      badge: 'Bestseller',
      inStock: true,
      isVeg: true,
      prepTimeMins: 10,
      prices: { piece: 22, full: null, half: null, '250g': 240, '500g': 460, '1kg': 900 },
      portionNotes: { piece: '1 Diamond Piece', full: '', half: '' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Crispy Punjabi Samosa',
      category: 'Hot Snacks',
      description: 'Flaky golden pastry stuffed with spiced masala potatoes, green peas & roasted coriander seeds. Served hot with mint & imli chutneys.',
      image: '/uploads/images/punjabi-samosa.jpg',
      badge: 'Hot & Fresh',
      inStock: true,
      isVeg: true,
      prepTimeMins: 12,
      prices: { piece: 22, full: 80, half: 45, '250g': null, '500g': null, '1kg': null },
      portionNotes: { piece: '1 Hot Samosa + Chutney', full: 'Full Plate (4 pcs)', half: 'Half Plate (2 pcs)' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Pure Ghee Motichoor Ladoo',
      category: 'Sweets',
      description: 'Melt-in-mouth tiny pearls of gram flour fried in pure A2 cow ghee, steeped in Kashmiri saffron syrup with pistachios & melon seeds.',
      image: '/uploads/images/motichoor-ladoo.jpg',
      badge: 'Festive Favourite',
      inStock: true,
      isVeg: true,
      prepTimeMins: 10,
      prices: { piece: 25, full: null, half: null, '250g': 180, '500g': 350, '1kg': 670 },
      portionNotes: { piece: '1 Fresh Ladoo', full: '', half: '' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(28),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Desi Ghee Gulab Jamun',
      category: 'Bengali & Dairy Sweets',
      description: 'Warm, soft khoya & paneer dumplings soaked in fragrant rose-water and green cardamom sugar syrup.',
      image: '/uploads/images/gulab-jamun.jpg',
      badge: 'Served Warm',
      inStock: true,
      isVeg: true,
      prepTimeMins: 10,
      prices: { piece: 20, full: 90, half: 50, '250g': 140, '500g': 270, '1kg': 520 },
      portionNotes: { piece: '1 Warm Piece in Syrup', full: 'Full (6 pcs)', half: 'Half (3 pcs)' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(2)
    },
    {
      _id: makeId(),
      name: 'Shahi Kesar Rasmalai',
      category: 'Bengali & Dairy Sweets',
      description: 'Delicate artisanal chhena patties chilled in rich saffron-pistachio rabri milk.',
      image: '/uploads/images/rasmalai.jpg',
      badge: 'Chef Special',
      inStock: true,
      isVeg: true,
      prepTimeMins: 10,
      prices: { piece: 40, full: 140, half: 75, '250g': null, '500g': 320, '1kg': 620 },
      portionNotes: { piece: '1 Pc in Kesar Rabri', full: 'Full Bowl (4 pcs)', half: 'Half Bowl (2 pcs)' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(22),
      updatedAt: daysAgo(2)
    },
    {
      _id: makeId(),
      name: 'Royal Khasta Raj Kachori Chaat',
      category: 'Hot Snacks',
      description: 'Crisp puffed kachori filled with sprouted moong, chilled sweetened curd, mint & imli chutneys, pomegranate & fine sev.',
      image: '/uploads/images/raj-kachori.jpg',
      badge: 'Street Royalty',
      inStock: true,
      isVeg: true,
      prepTimeMins: 12,
      prices: { piece: 70, full: 130, half: 70, '250g': null, '500g': null, '1kg': null },
      portionNotes: { piece: '1 Jumbo Raj Kachori', full: 'Full (2 Kachoris)', half: 'Half (1 Kachori)' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Crispy Kesar Desi Ghee Jalebi',
      category: 'Sweets',
      description: 'Piping hot fermented-batter spirals fried golden crisp in pure ghee and dipped in saffron-lemon syrup.',
      image: '/uploads/images/kesar-jalebi.jpg',
      badge: 'Made Live',
      inStock: true,
      isVeg: true,
      prepTimeMins: 15,
      prices: { piece: 18, full: 95, half: 55, '250g': 150, '500g': 290, '1kg': 560 },
      portionNotes: { piece: '1 Crisp Coil', full: 'Full Plate', half: 'Half Plate' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(18),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Mathura Kesar Mawa Peda',
      category: 'Sweets',
      description: 'Slow-caramelized rich milk khoya medallions infused with nutmeg, green cardamom, and Kashmiri saffron threads.',
      image: '/uploads/images/kesar-peda.jpg',
      badge: 'Temple Classic',
      inStock: true,
      isVeg: true,
      prepTimeMins: 8,
      prices: { piece: 20, full: null, half: null, '250g': 170, '500g': 330, '1kg': 640 },
      portionNotes: { piece: '1 Kesar Peda', full: '', half: '' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      name: 'Bikaneri Navratan Bhujia & Mixture',
      category: 'Namkeen & Savory',
      description: 'Crunchy moth-bean & besan sev tossed with roasted cashews, peanuts, curry leaves & signature Marwari spice blend.',
      image: '/uploads/images/bikaneri-bhujia.jpg',
      badge: 'Tea-Time Crunch',
      inStock: true,
      isVeg: true,
      prepTimeMins: 5,
      prices: { piece: null, full: null, half: null, '250g': 110, '500g': 210, '1kg': 400 },
      portionNotes: { piece: '', full: '', half: '' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(3)
    },
    {
      _id: makeId(),
      name: 'Shahi Assorted Mithai Gift Box',
      category: 'Festive Gift Boxes',
      description: 'Luxury maroon & gold keepsake box filled with Kaju Katli, Pistachio Roll, Kesar Peda & Motichoor Ladoo.',
      image: '/uploads/images/festive-gift-box.jpg',
      badge: 'Luxury Gifting',
      inStock: true,
      isVeg: true,
      prepTimeMins: 15,
      prices: { piece: 550, full: null, half: null, '250g': null, '500g': 550, '1kg': 1050 },
      portionNotes: { piece: '1 Gift Box (16 Assorted Pcs)', full: '', half: '' },
      rating: 5.0,
      reviewCount: 0,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(1)
    }
  ];

  const coupons = [
    {
      _id: makeId(),
      code: 'FESTIVE20',
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 500,
      maxDiscount: 250,
      description: '20% OFF on festive sweet & snack orders above ₹500 (up to ₹250)',
      validUntil: daysFromNow(30),
      isActive: true,
      usageCount: 0,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1)
    },
    {
      _id: makeId(),
      code: 'FIRST50',
      discountType: 'flat',
      discountValue: 50,
      minOrderAmount: 250,
      maxDiscount: 50,
      description: 'Flat ₹50 OFF on orders above ₹250 • Great for first-time customers',
      validUntil: daysFromNow(45),
      isActive: true,
      usageCount: 0,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(2)
    },
    {
      _id: makeId(),
      code: 'ROYAL150',
      discountType: 'flat',
      discountValue: 150,
      minOrderAmount: 1200,
      maxDiscount: 150,
      description: 'Flat ₹150 OFF on family & bulk festive boxes above ₹1,200',
      validUntil: daysFromNow(20),
      isActive: true,
      usageCount: 0,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1)
    }
  ];

  const deliveryConfig = {
    _id: makeId(),
    shopName: 'Radha Swami',
    shopAddress: 'Station Road, Civil Lines, Main Market',
    isStoreOpen: true,
    cashOnDeliveryEnabled: true,
    baseDistanceKm: 2,
    baseFee: 25,
    perKmFee: 8,
    freeDeliveryEnabled: true,
    freeDeliveryMinOrder: 999,
    maxDeliveryDistanceKm: 20,
    packagingCharge: 0,
    updatedAt: new Date().toISOString()
  };

  return {
    products,
    coupons,
    orders: [],
    reviews: [],
    deliveryConfig,
    users: [],
    lastOrderSeq: 10000,
    schemaVersion: 2
  };
}

module.exports = { createSeedData, makeId };
