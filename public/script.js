
/* ==========================================
   ShopEase - Products, Search, Cart & Auth
   ========================================== */

let products = [];
let activeCategory = "All";
let cart = [];
let toastTimer;

let shopEaseSupabaseClient = null;
let currentShopEaseUser = null;

const getElement = (id) => document.getElementById(id);

const productGrid = getElement("productGrid");
const searchInput = getElement("searchInput");
const productCount = getElement("productCount");
const emptyState = getElement("emptyState");

const cartButton = getElement("cartButton");
const cartDrawer = getElement("cartDrawer");
const overlay = getElement("overlay");
const closeCart = getElement("closeCart");
const continueShopping = getElement("continueShopping");
const cartItems = getElement("cartItems");
const cartCount = getElement("cartCount");
const drawerCount = getElement("drawerCount");
const cartSubtotal = getElement("cartSubtotal");
const checkoutButton = getElement("checkoutButton");
const toast = getElement("toast");

const formatPrice = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

function showToast(message) {
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* ==========================================
   Load products from the Express API
   ========================================== */

async function loadProducts() {
  if (!productGrid || !emptyState || !productCount) {
    console.error(
      "ShopEase product HTML is missing. Check productGrid, emptyState and productCount IDs."
    );
    return;
  }

  productGrid.hidden = false;
  productGrid.innerHTML = `
    <p style="padding:24px;text-align:center;">
      Loading products...
    </p>
  `;

  emptyState.hidden = true;

  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error(`Products request failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.products)) {
      throw new Error("Invalid products response.");
    }

    products = result.products.map((product) => ({
      ...product,
      id: Number(product.id),
      price: Number(product.price),
      stock: Number(product.stock),
      image: product.image_url || ""
    }));

    renderProducts();
    renderCart();
  } catch (error) {
    console.error("Could not load ShopEase products:", error);

    productGrid.innerHTML = "";
    productGrid.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent =
      "Products could not be loaded. Please refresh and try again.";

    productCount.textContent = "Products unavailable";
  }
}

/* ==========================================
   Render products and filter results
   ========================================== */

function renderProducts() {
  if (!productGrid || !searchInput || !productCount || !emptyState) {
    return;
  }

  const searchTerm = searchInput.value.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      activeCategory === "All" ||
      product.category === activeCategory;

    const matchesSearch =
      (product.name || "").toLowerCase().includes(searchTerm) ||
      (product.category || "").toLowerCase().includes(searchTerm) ||
      (product.description || "").toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  productCount.textContent =
    `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;

  // Build product cards using DOM methods to avoid inserting
  // database-provided text as raw HTML.
  productGrid.replaceChildren();

  filteredProducts.forEach((product) => {
    const article = document.createElement("article");
    article.className = "product-card";
article.style.cursor = "pointer";
article.tabIndex = 0;
article.setAttribute("role", "link");
article.setAttribute(
  "aria-label",
  `View details for ${product.name}`
);

article.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  openProductDetails(product.id);
});

article.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target === article
  ) {
    event.preventDefault();
    openProductDetails(product.id);
  }
});
    const img = document.createElement("img");
    img.className = "product-image";
    img.alt = product.name || "Product";
    img.loading = "lazy";

    if (product.image) {
      img.src = product.image;
    }

    const info = document.createElement("div");
    info.className = "product-info";

    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = product.category || "";

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name || "";

    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.description || "";

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";

    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.dataset.add = String(product.id);
    addButton.type = "button";
    addButton.disabled = product.stock <= 0;
    addButton.textContent =
      product.stock <= 0 ? "Out of stock" : "+ Add";

    bottom.append(price, addButton);
    info.append(category, name, description, bottom);
    article.append(img, info);
    productGrid.append(article);
  });

  emptyState.hidden = filteredProducts.length > 0;
  productGrid.hidden = filteredProducts.length === 0;

  if (filteredProducts.length === 0) {
    emptyState.textContent = products.length === 0
      ? "No products available."
      : "No products found. Try another search or category.";
  }
}

/* ==========================================
   Shopping cart
   ========================================== */

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product) return;

  const existingItem = cart.find((item) => item.id === productId);
  const currentQuantity = existingItem ? existingItem.quantity : 0;

  if (currentQuantity >= product.stock) {
    showToast("Sorry, no more stock is available.");
    return;
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  renderCart();
  showToast("Added to your cart!");
}

function updateQuantity(productId, change) {
  const item = cart.find((product) => product.id === productId);

  if (!item) return;

  if (change > 0 && item.quantity >= item.stock) {
    showToast("Sorry, no more stock is available.");
    return;
  }

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter((product) => product.id !== productId);
  }

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);

  renderCart();
  showToast("Item removed from cart.");
}

function renderCart() {
  if (!cartItems || !cartCount || !drawerCount || !cartSubtotal) {
    return;
  }

  const totalQuantity = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  cartCount.textContent = String(totalQuantity);
  drawerCount.textContent = `(${totalQuantity})`;
  cartSubtotal.textContent = formatPrice(subtotal);

  cartItems.replaceChildren();

  if (cart.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cart-empty";

    const emoji = document.createElement("span");
    emoji.textContent = "🛒";

    const heading = document.createElement("h3");
    heading.textContent = "Your cart is waiting";

    const paragraph = document.createElement("p");
    paragraph.textContent = "Add something you love to get started.";

    empty.append(emoji, heading, paragraph);
    cartItems.append(empty);
    return;
  }

  cart.forEach((item) => {
    const article = document.createElement("article");
    article.className = "cart-item";

    const img = document.createElement("img");
    img.alt = item.name || "Product";

    if (item.image) img.src = item.image;

    const details = document.createElement("div");

    const heading = document.createElement("h4");
    heading.textContent = item.name || "";

    const price = document.createElement("p");
    price.textContent = formatPrice(item.price * item.quantity);

    const quantityControl = document.createElement("div");
    quantityControl.className = "quantity-control";

    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.dataset.decrease = String(item.id);
    decrease.setAttribute("aria-label", "Decrease quantity");
    decrease.textContent = "−";

    const quantity = document.createElement("span");
    quantity.textContent = String(item.quantity);

    const increase = document.createElement("button");
    increase.type = "button";
    increase.dataset.increase = String(item.id);
    increase.setAttribute("aria-label", "Increase quantity");
    increase.textContent = "+";

    quantityControl.append(decrease, quantity, increase);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.dataset.remove = String(item.id);
    remove.textContent = "Remove";

    details.append(heading, price, quantityControl, remove);
    article.append(img, details);
    cartItems.append(article);
  });
}

function openCart() {
  if (!cartDrawer || !overlay) return;

  cartDrawer.classList.add("open");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  if (closeCart) closeCart.focus();
}

function hideCart() {
  if (cartDrawer) cartDrawer.classList.remove("open");
  if (overlay) overlay.classList.remove("open");

  document.body.style.overflow = "";

  if (cartButton) cartButton.focus();
}

/* ==========================================
   Safe event listeners
   ========================================== */

const categoriesElement = getElement("categories");

if (categoriesElement) {
  categoriesElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    activeCategory = button.dataset.category;

    document.querySelectorAll(".category").forEach((categoryButton) => {
      categoryButton.classList.toggle(
        "active",
        categoryButton === button
      );
    });

    renderProducts();
  });
} else {
  console.warn("ShopEase: #categories element was not found.");
}

if (searchInput) {
  searchInput.addEventListener("input", renderProducts);
} else {
  console.warn("ShopEase: #searchInput element was not found.");
}

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");

    if (button && !button.disabled) {
      addToCart(Number(button.dataset.add));
    }
  });
}

if (cartItems) {
  cartItems.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    if (button.dataset.increase) {
      updateQuantity(Number(button.dataset.increase), 1);
    } else if (button.dataset.decrease) {
      updateQuantity(Number(button.dataset.decrease), -1);
    } else if (button.dataset.remove) {
      removeFromCart(Number(button.dataset.remove));
    }
  });
}

if (cartButton) cartButton.addEventListener("click", openCart);
if (closeCart) closeCart.addEventListener("click", hideCart);
if (continueShopping) continueShopping.addEventListener("click", hideCart);
if (overlay) overlay.addEventListener("click", hideCart);

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    cartDrawer &&
    cartDrawer.classList.contains("open")
  ) {
    hideCart();
  }
});


/* ==========================================
   Secure Cash on Delivery Checkout
   ========================================== */

const checkoutModal = getElement("checkoutModal");
const checkoutClose = getElement("checkoutClose");
const checkoutForm = getElement("checkoutForm");
const checkoutName = getElement("checkoutName");
const checkoutPhone = getElement("checkoutPhone");
const checkoutAddress = getElement("checkoutAddress");
const checkoutSummary = getElement("checkoutSummary");
const checkoutMessage = getElement("checkoutMessage");
const placeOrderButton = getElement("placeOrderButton");

function closeCheckout() {
  if (checkoutModal) checkoutModal.hidden = true;
}

if (checkoutButton) {
  checkoutButton.addEventListener("click", async () => {
    if (cart.length === 0) {
      showToast("Your cart is empty. Add a product first.");
      return;
    }

    if (!checkoutModal || !checkoutForm) {
      showToast("Checkout form is missing from index.html.");
      return;
    }

    if (!shopEaseSupabaseClient) {
      showToast("Authentication is not ready. Refresh the page.");
      return;
    }

    const { data, error } =
      await shopEaseSupabaseClient.auth.getSession();

    if (error || !data.session) {
      showToast("Please log in before placing your order.");
      getElement("authModal")?.removeAttribute("hidden");
      getElement("authEmail")?.focus();
      return;
    }

    checkoutForm.reset();
    checkoutMessage.textContent = "";
    checkoutSummary.textContent =
      `Order subtotal: ${formatPrice(
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      )}`;

    checkoutName.value =
      data.session.user.user_metadata?.full_name || "";

    checkoutModal.hidden = false;
    checkoutName.focus();
  });
}

if (checkoutClose) {
  checkoutClose.addEventListener("click", closeCheckout);
}

if (checkoutModal) {
  checkoutModal.addEventListener("click", (event) => {
    if (event.target === checkoutModal) closeCheckout();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && checkoutModal &&
      !checkoutModal.hidden) {
    closeCheckout();
  }
});

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (cart.length === 0) {
      checkoutMessage.textContent = "Your cart is empty.";
      return;
    }

    if (!shopEaseSupabaseClient) {
      checkoutMessage.textContent =
        "Authentication is unavailable. Please refresh the page.";
      return;
    }

    const customerName = checkoutName.value.trim();
    const phone = checkoutPhone.value.trim();
    const address = checkoutAddress.value.trim();

    if (!customerName || !phone || !address) {
      checkoutMessage.textContent =
        "Please complete all delivery details.";
      return;
    }

    const originalButtonText = placeOrderButton.textContent;
    placeOrderButton.disabled = true;
    placeOrderButton.textContent = "Placing order...";
    checkoutMessage.textContent = "Please wait...";

    try {
      const { data: sessionData, error: sessionError } =
        await shopEaseSupabaseClient.auth.getSession();

      if (sessionError) throw sessionError;

      const session = sessionData.session;

      if (!session) {
        throw new Error("Your session expired. Please log in again.");
      }

      // Snapshot the cart so the submitted order stays consistent.
      const orderItems = cart.map((item) => ({
        product_id: Number(item.id),
        quantity: Number(item.quantity)
      }));

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          customerName,
          phone,
          address,
          items: orderItems
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not place your order."
        );
      }

      const order = result.order || result.data || result;

      // Clear the cart only after the server confirms success.
      cart = [];
      renderCart();

      checkoutMessage.textContent =
        `Order placed successfully! Order number: ${
          order.order_number || "Confirmed"
        }. Payment: Cash on Delivery.`;

      checkoutSummary.textContent =
        `Confirmed total: ${formatPrice(order.subtotal ?? 0)}`;

      showToast("Your COD order has been placed!");

      // Refresh product stock from the database.
      await loadProducts();

      // Keep the confirmation visible before closing.
      placeOrderButton.textContent = "Order placed!";
      checkoutForm.reset();

      setTimeout(() => {
        closeCheckout();
        placeOrderButton.disabled = false;
        placeOrderButton.textContent = originalButtonText;
      }, 3500);

    } catch (error) {
      console.error("ShopEase checkout failed:", error);

      checkoutMessage.textContent =
        error.message || "Order failed. Please try again.";

      placeOrderButton.disabled = false;
      placeOrderButton.textContent = originalButtonText;
    }
  });
}


/* ==========================================
   Supabase Authentication
   ========================================== */

async function initShopEaseAuth() {
  const modal = getElement("authModal");
  const authButton = getElement("authButton");
  const closeButton = getElement("authClose");
  const form = getElement("authForm");
  const title = getElement("authTitle");
  const subtitle = getElement("authSubtitle");
  const nameInput = getElement("authName");
  const nameLabel = getElement("nameLabel");
  const emailInput = getElement("authEmail");
  const passwordInput = getElement("authPassword");
  const submitButton = getElement("authSubmit");
  const toggleButton = getElement("authToggle");
  const logoutButton = getElement("authLogout");
  const message = getElement("authMessage");

  // Missing authentication markup must not break the store.
  if (
    !modal || !authButton || !closeButton || !form ||
    !title || !subtitle || !nameInput || !nameLabel ||
    !emailInput || !passwordInput || !submitButton ||
    !toggleButton || !logoutButton || !message
  ) {
    console.error(
      "ShopEase auth HTML is incomplete. Check authButton, authModal and the auth form IDs in index.html."
    );
    return;
  }

  let supabaseClient;
  let isSignup = false;
  let currentUser = null;

  function showMessage(text) {
    message.textContent = text;
  }

  function openModal() {
    modal.hidden = false;
    showMessage("");
    updateFormMode();
  }

  function closeModal() {
    modal.hidden = true;
  }

  function updateFormMode() {
    title.textContent = isSignup
      ? "Create your ShopEase account"
      : "Welcome to ShopEase";

    subtitle.textContent = isSignup
      ? "Sign up with your name, email and password."
      : "Log in to your account.";

    nameInput.hidden = !isSignup;
    nameLabel.hidden = !isSignup;
    nameInput.required = isSignup;

    passwordInput.autocomplete = isSignup
      ? "new-password"
      : "current-password";

    submitButton.textContent = isSignup ? "Create account" : "Login";

    toggleButton.textContent = isSignup
      ? "Already registered? Login"
      : "New here? Create an account";

    logoutButton.hidden = !currentUser;
    form.hidden = Boolean(currentUser);
    toggleButton.hidden = Boolean(currentUser);
  }

  function updateUser(user) {
  currentUser = user;
  currentShopEaseUser = user;

    authButton.textContent = user
      ? `Account: ${user.user_metadata?.full_name || user.email}`
      : "Login / Sign up";

    updateFormMode();
  }

  authButton.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  toggleButton.addEventListener("click", () => {
    isSignup = !isSignup;
    form.reset();
    showMessage("");
    updateFormMode();
  });

  try {
    const configResponse = await fetch("/api/auth-config");
    const config = await configResponse.json();

    if (!configResponse.ok || !config.success) {
      throw new Error(
        config.message || "Could not load authentication settings."
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase library did not load. Check the script tags in index.html."
      );
    }

    supabaseClient = window.supabase.createClient(config.url, config.key);

shopEaseSupabaseClient = supabaseClient;
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    updateUser(data.session?.user || null);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user || null);
    });
  } catch (error) {
    console.error("ShopEase authentication setup failed:", error);

    authButton.textContent = "Authentication unavailable";
    authButton.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    showMessage("Please wait...");

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (isSignup) {
        const fullName = nameInput.value.trim();

        if (!fullName) {
          throw new Error("Please enter your full name.");
        }

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (error) throw error;

        form.reset();

        if (data.session) {
          updateUser(data.session.user);
          showMessage("Account created successfully!");
        } else {
          showMessage(
            "Registration submitted. Check your email and click the confirmation link before logging in."
          );
        }
      } else {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        updateUser(data.user);
        showMessage("Login successful!");

        setTimeout(closeModal, 800);
      }
    } catch (error) {
      showMessage(
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) throw error;

      updateUser(null);
      isSignup = false;
      form.reset();
      showMessage("You have logged out successfully.");
    } catch (error) {
      showMessage(error.message || "Logout failed. Please try again.");
    } finally {
      logoutButton.disabled = false;
    }
  });
}

/* ==========================================
   Start the application
   ========================================== */

renderCart();
loadProducts();
initShopEaseAuth();

/* ==========================================
   Product Details Page
   ========================================== */

let selectedDetailsProduct = null;
let detailsQuantity = 1;

const detailsSection = getElement("productDetails");
const productsSection = getElement("products");
const backToProducts = getElement("backToProducts");
const detailsImage = getElement("detailsImage");
const detailsCategory = getElement("detailsCategory");
const detailsName = getElement("detailsName");
const detailsPrice = getElement("detailsPrice");
const detailsDescription = getElement("detailsDescription");
const detailsStock = getElement("detailsStock");
const detailsQuantityText = getElement("detailsQuantity");
const detailsDecrease = getElement("detailsDecrease");
const detailsIncrease = getElement("detailsIncrease");
const detailsAddToCart = getElement("detailsAddToCart");

function openProductDetails(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product || !detailsSection || !productsSection) return;

  selectedDetailsProduct = product;
  detailsQuantity = 1;

  detailsImage.src = product.image || "";
  detailsImage.alt = product.name || "Product image";
  detailsCategory.textContent = product.category || "";
  detailsName.textContent = product.name || "";
  detailsPrice.textContent = formatPrice(product.price);
  detailsDescription.textContent =
    product.description || "No additional description available.";
  detailsStock.textContent =
    product.stock > 0
      ? `${product.stock} items available`
      : "Out of stock";

  detailsQuantityText.textContent = String(detailsQuantity);
  detailsDecrease.disabled = true;
  detailsIncrease.disabled = product.stock <= 1;
  detailsAddToCart.disabled = product.stock <= 0;
  detailsAddToCart.textContent =
    product.stock > 0 ? "Add to Cart" : "Out of stock";

  productsSection.hidden = true;
  detailsSection.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}


function closeProductDetails() {
  if (!detailsSection || !productsSection) return;

  detailsSection.hidden = true;
  productsSection.hidden = false;
  selectedDetailsProduct = null;

  // Return to the main shopping page
  window.scrollTo({ top: 0, behavior: "smooth" });
}


if (backToProducts) {
  backToProducts.addEventListener("click", closeProductDetails);
}

if (detailsDecrease) {
  detailsDecrease.addEventListener("click", () => {
    if (detailsQuantity > 1) {
      detailsQuantity--;
      detailsQuantityText.textContent = String(detailsQuantity);
      detailsDecrease.disabled = detailsQuantity === 1;
      detailsIncrease.disabled =
        detailsQuantity >= selectedDetailsProduct.stock;
    }
  });
}

if (detailsIncrease) {
  detailsIncrease.addEventListener("click", () => {
    if (
      selectedDetailsProduct &&
      detailsQuantity < selectedDetailsProduct.stock
    ) {
      detailsQuantity++;
      detailsQuantityText.textContent = String(detailsQuantity);
      detailsDecrease.disabled = detailsQuantity === 1;
      detailsIncrease.disabled =
        detailsQuantity >= selectedDetailsProduct.stock;
    }
  });
}

if (detailsAddToCart) {
  detailsAddToCart.addEventListener("click", () => {
    if (!selectedDetailsProduct) return;

    const product = selectedDetailsProduct;
    const existing = cart.find((item) => item.id === product.id);
    const currentQuantity = existing ? existing.quantity : 0;

    if (currentQuantity + detailsQuantity > product.stock) {
      showToast("Sorry, not enough stock is available.");
      return;
    }

    if (existing) {
      existing.quantity += detailsQuantity;
    } else {
      cart.push({ ...product, quantity: detailsQuantity });
    }

    renderCart();
    showToast("Added to your cart!");
  });
}
