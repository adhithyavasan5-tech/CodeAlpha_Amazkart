import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "../public")));

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// Existing public client: product fetching and login-token verification.
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Private backend client: creating orders securely.
const adminSupabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Backend status
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "ShopEase backend is running!",
    databaseConfigured: Boolean(supabase),
    orderProcessingConfigured: Boolean(adminSupabase),
  });
});

// Fetch products
app.get("/api/products", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({
      success: false,
      message: "Supabase is not configured.",
    });
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, category, price, image_url, stock")
    .order("id", { ascending: true });

  if (error) {
    console.error("Products query failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load products from the database.",
    });
  }

  res.json({
    success: true,
    products: data,
  });
});

// Public Supabase browser configuration
app.get("/api/auth-config", (req, res) => {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      message: "Supabase authentication is not configured.",
    });
  }

  res.set("Cache-Control", "no-store");
  res.json({
    success: true,
    url: supabaseUrl,
    key: supabaseKey,
  });
});

// Place Cash on Delivery order
app.post("/api/orders", async (req, res) => {
  try {
    if (!supabase || !adminSupabase) {
      return res.status(503).json({
        error: "Order processing is not configured on the server.",
      });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please log in before placing an order.",
      });
    }

    // Verify the customer's real Supabase session.
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return res.status(401).json({
        error: "Your session is invalid. Please log in again.",
      });
    }

    const { customerName, phone, address, items } = req.body || {};

    if (
      typeof customerName !== "string" ||
      typeof phone !== "string" ||
      typeof address !== "string" ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 100
    ) {
      return res.status(400).json({
        error: "Please enter your delivery details and check your cart.",
      });
    }

    if (
      !customerName.trim() ||
      customerName.trim().length > 100 ||
      !/^[0-9+\-()\s]{7,20}$/.test(phone.trim()) ||
      !address.trim() ||
      address.trim().length > 1000
    ) {
      return res.status(400).json({
        error: "Enter a valid name, phone number and delivery address.",
      });
    }

    // Never accept prices or totals from the browser.
    const cleanItems = [];

    for (const item of items) {
      const productId = Number(item?.product_id);
      const quantity = Number(item?.quantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 100
      ) {
        return res.status(400).json({
          error: "Your cart contains an invalid product or quantity.",
        });
      }

      cleanItems.push({
        product_id: productId,
        quantity,
      });
    }

    const { data, error } = await adminSupabase.rpc(
      "place_cod_order",
      {
        p_user_id: userData.user.id,
        p_customer_name: customerName.trim(),
        p_phone: phone.trim(),
        p_address: address.trim(),
        p_items: cleanItems,
      }
    );

    if (error) {
      console.error("Order placement failed:", error.message);

      return res.status(400).json({
        error: error.message || "Could not place your order.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Your Cash on Delivery order was placed successfully.",
      order: data,
    });
  } catch (error) {
    console.error("Checkout error:", error.message);

    return res.status(500).json({
      error: "An unexpected error occurred while placing your order.",
    });
  }
});

// Start the server AFTER registering all routes.
app.listen(PORT, () => {
  console.log(`ShopEase running at http://localhost:${PORT}`);
});
