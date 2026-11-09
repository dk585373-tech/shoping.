'use strict';

/*
 * SHOPNEST — Vanilla JavaScript SPA
 * Product source: DummyJSON public API + Open Library public API.
 * No local products.json file is used.
 */

const API = {
  products: 'https://dummyjson.com/products?limit=100',
  books: 'https://openlibrary.org/search.json?q=subject:fiction&limit=12'
};
const CART_STORAGE_KEY = 'shopnest-cart-v1';
const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Footwear', 'Books'];

let products = [];
let activeCategory = 'All';
let searchTerm = '';
let cart = loadCart();

// DOM elements
const elements = {
  productGrid: document.querySelector('#product-grid'),
  searchInput: document.querySelector('#search-input'),
  categoryFilters: document.querySelector('#category-filters'),
  emptyState: document.querySelector('#empty-state'),
  loadingState: document.querySelector('#loading-state'),
  errorState: document.querySelector('#error-state'),
  resultsCount: document.querySelector('#results-count'),
  cartCount: document.querySelector('#cart-count'),
  cartDrawer: document.querySelector('#cart-drawer'),
  cartOverlay: document.querySelector('#cart-overlay'),
  cartItems: document.querySelector('#cart-items'),
  cartEmpty: document.querySelector('#cart-empty'),
  cartFooter: document.querySelector('#cart-footer'),
  cartTotal: document.querySelector('#cart-total'),
  drawerCount: document.querySelector('#drawer-count')
};

// ---------- PUBLIC API AND DATA NORMALIZATION ----------

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function mapProductCategory(apiCategory) {
  const category = String(apiCategory || '').toLowerCase();

  if (/shoe|footwear|sandal|boot|sneaker/.test(category)) return 'Footwear';
  if (/shirt|dress|top|fashion|clothing|mens-wear|womens-wear/.test(category)) return 'Clothing';
  if (/laptop|smartphone|mobile|tablet|computer|electronics|camera|monitor/.test(category)) {
    return 'Electronics';
  }

  // Exclude unrelated products instead of incorrectly labelling them.
  // Books are loaded separately from Open Library below.
  return null;
}

function normalizeShopProduct(item) {
  const priceUSD = Number(item.price) || 0;
  const discount = Number(item.discountPercentage) || 0;
  const priceINR = Math.round(priceUSD * 83);
  const originalPriceINR = Math.max(priceINR, Math.round(priceINR * (1 + discount / 100)));

  return {
    id: Number(item.id),
    name: String(item.title || 'Unnamed product'),
    category: mapProductCategory(item.category),
    price: priceINR,
    originalPrice: originalPriceINR,
    rating: Number(item.rating) || 0,
    imageUrl: item.thumbnail || item.images?.[0] || fallbackImage('Product')
  };
}

function normalizeBook(book, index) {
  const coverUrl = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
    : fallbackImage('Book');

  // Open Library search is a bibliographic API, not a retail catalog.
  // These are sample prices/ratings for the demo storefront only.
  const samplePrice = 299 + (index % 6) * 50;

  return {
    id: 10000 + index,
    name: String(book.title || 'Untitled book'),
    category: 'Books',
    price: samplePrice,
    originalPrice: samplePrice + 150,
    rating: Number((4.1 + (index % 8) * 0.1).toFixed(1)),
    imageUrl: coverUrl
  };
}

function fallbackImage(label) {
  return `https://placehold.co/600x600/f0f1e9/315c43?text=${encodeURIComponent(label)}`;
}

async function loadProducts() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  elements.productGrid.replaceChildren();
  elements.resultsCount.textContent = 'Loading products…';

  try {
    // Products are essential. Books are optional: if Open Library is unavailable,
    // the shop products still load and the app remains usable.
    const shopData = await fetchJSON(API.products);

    if (!Array.isArray(shopData.products)) {
      throw new Error('The products API returned an unexpected response.');
    }

    const shopProducts = shopData.products
      .map(normalizeShopProduct)
      .filter(product => product.category !== null);

    let bookProducts = [];
    try {
      const booksData = await fetchJSON(API.books);
      bookProducts = (booksData.docs || []).slice(0, 12).map(normalizeBook);
    } catch (bookError) {
      console.warn('Book API is unavailable; continuing with shop products only.', bookError);
    }

    products = [...shopProducts, ...bookProducts];
    renderProducts();
    renderCart();
  } catch (error) {
    console.error('ShopNest could not load products:', error);
    elements.errorState.hidden = false;
    elements.resultsCount.textContent = 'Products unavailable';
  } finally {
    elements.loadingState.hidden = true;
  }
}

// ---------- PRODUCT SEARCH, FILTER AND RENDER ----------

function getFilteredProducts() {
  return products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'product-image-wrap';

  const image = document.createElement('img');
  image.className = 'product-image';
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = 'lazy';
  image.onerror = () => {
    image.onerror = null;
    image.src = fallbackImage('ShopNest');
  };
  imageWrap.append(image);

  const discountPercent = product.originalPrice > 0
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  if (discountPercent > 0) {
    const discount = document.createElement('span');
    discount.className = 'discount-tag';
    discount.textContent = `${discountPercent}% OFF`;
    imageWrap.append(discount);
  }

  const info = document.createElement('div');
  info.className = 'product-info';

  const category = document.createElement('span');
  category.className = 'product-category';
  category.textContent = product.category;

  const name = document.createElement('h3');
  name.className = 'product-name';
  name.textContent = product.name;

  const rating = document.createElement('div');
  rating.className = 'rating';
  const star = document.createElement('span');
  star.textContent = '★';
  rating.append(star, document.createTextNode(` ${product.rating.toFixed(1)} / 5`));

  const priceRow = document.createElement('div');
  priceRow.className = 'price-row';

  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = formatCurrency(product.price);

  const originalPrice = document.createElement('span');
  originalPrice.className = 'original-price';
  originalPrice.textContent = formatCurrency(product.originalPrice);
  priceRow.append(price, originalPrice);

  const addButton = document.createElement('button');
  addButton.className = 'add-button';
  addButton.type = 'button';
  addButton.textContent = '＋ Add to Cart';
  addButton.addEventListener('click', () => addToCart(product.id));

  info.append(category, name, rating, priceRow, addButton);
  card.append(imageWrap, info);
  return card;
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();
  const cards = filteredProducts.map(createProductCard);

  elements.productGrid.replaceChildren(...cards);
  elements.emptyState.hidden = filteredProducts.length > 0;

  const count = filteredProducts.length;
  elements.resultsCount.textContent = `${count} ${count === 1 ? 'product' : 'products'} found`;
}

function setActiveCategory(category) {
  if (!CATEGORIES.includes(category)) return;

  activeCategory = category;

  elements.categoryFilters.querySelectorAll('[data-category]').forEach(button => {
    const selected = button.dataset.category === activeCategory;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  renderProducts();
}

function clearFilters() {
  elements.searchInput.value = '';
  searchTerm = '';
  setActiveCategory('All');
}

// ---------- CART AND LOCAL STORAGE ----------

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];

    return saved
      .filter(item =>
        Number.isInteger(item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      )
      .map(item => ({ id: item.id, quantity: item.quantity }));
  } catch (error) {
    console.warn('Could not read saved cart. Starting with an empty cart.', error);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Could not save cart to localStorage:', error);
  }
}

function addToCart(productId) {
  const productExists = products.some(product => product.id === productId);
  if (!productExists) return;

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id: productId, quantity: 1 });
  }

  updateCart();
}

function changeQuantity(productId, amount) {
  const item = cart.find(cartItem => cartItem.id === productId);
  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  updateCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCart();
}

function updateCart() {
  saveCart();
  renderCart();
}

function renderCart() {
  // Once API data is loaded, discard cart IDs that no longer exist in the catalog.
  if (products.length > 0) {
    cart = cart.filter(item => products.some(product => product.id === item.id));
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find(entry => entry.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  elements.cartCount.textContent = String(totalItems);
  elements.drawerCount.textContent = `(${totalItems})`;
  elements.cartTotal.textContent = formatCurrency(subtotal);
  elements.cartItems.replaceChildren();

  const isEmpty = cart.length === 0;
  elements.cartEmpty.hidden = !isEmpty;
  elements.cartFooter.hidden = isEmpty;

  cart.forEach(item => {
    const product = products.find(entry => entry.id === item.id);
    if (!product) return;

    const line = document.createElement('article');
    line.className = 'cart-line';

    const image = document.createElement('img');
    image.src = product.imageUrl;
    image.alt = product.name;
    image.onerror = () => {
      image.onerror = null;
      image.src = fallbackImage('Product');
    };

    const details = document.createElement('div');

    const name = document.createElement('h3');
    name.textContent = product.name;

    const linePrice = document.createElement('div');
    linePrice.className = 'line-price';
    linePrice.textContent = formatCurrency(product.price * item.quantity);

    const quantityControl = document.createElement('div');
    quantityControl.className = 'quantity-control';

    const decreaseButton = document.createElement('button');
    decreaseButton.type = 'button';
    decreaseButton.textContent = '−';
    decreaseButton.setAttribute('aria-label', `Decrease ${product.name} quantity`);
    decreaseButton.addEventListener('click', () => changeQuantity(product.id, -1));

    const quantity = document.createElement('span');
    quantity.textContent = String(item.quantity);

    const increaseButton = document.createElement('button');
    increaseButton.type = 'button';
    increaseButton.textContent = '+';
    increaseButton.setAttribute('aria-label', `Increase ${product.name} quantity`);
    increaseButton.addEventListener('click', () => changeQuantity(product.id, 1));

    quantityControl.append(decreaseButton, quantity, increaseButton);
    details.append(name, linePrice, quantityControl);

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => removeFromCart(product.id));

    line.append(image, details, removeButton);
    elements.cartItems.append(line);
  });

  saveCart();
}

// ---------- CART DRAWER, HELPERS AND EVENTS ----------

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function openCart() {
  elements.cartDrawer.classList.add('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  elements.cartOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#close-cart').focus();
}

function closeCart() {
  elements.cartDrawer.classList.remove('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  elements.cartOverlay.hidden = true;
  document.body.style.overflow = '';
  document.querySelector('#cart-toggle').focus();
}

// Search uses the input event so results update as the user types.
elements.searchInput.addEventListener('input', event => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderProducts();
});

// Event delegation for category buttons.
elements.categoryFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  setActiveCategory(button.dataset.category);
});

document.querySelector('#clear-filters').addEventListener('click', clearFilters);
document.querySelector('#retry-button').addEventListener('click', loadProducts);
document.querySelector('#cart-toggle').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
elements.cartOverlay.addEventListener('click', closeCart);
document.querySelector('#checkout-button').addEventListener('click', closeCart);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && elements.cartDrawer.classList.contains('open')) {
    closeCart();
  }
});

document.querySelector('#year').textContent = String(new Date().getFullYear());

// Load the product catalog when the page starts.
loadProducts();
