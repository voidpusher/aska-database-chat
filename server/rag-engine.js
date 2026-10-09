import {
  executeReadOnlyQuery,
  getSchemaOverviewForConnection,
} from "./query-runtime.js";

const VECTOR_SIZE = 512;

function hashFeature(value) {
  let hash = 2166136261;

async function getEmbedder() {
  if (!_embedder) {
    const { pipeline } = await import("@xenova/transformers");
    _embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }

  return Math.abs(hash) % VECTOR_SIZE;
}

function addFeature(vector, feature, weight) {
  vector[hashFeature(feature)] += weight;
}

async function embed(text) {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(Boolean);
  const vector = new Array(VECTOR_SIZE).fill(0);

  tokens.forEach((token, index) => {
    addFeature(vector, `word:${token}`, 1);

    if (index < tokens.length - 1) {
      addFeature(vector, `pair:${token}:${tokens[index + 1]}`, 0.7);
    }

    if (token.length >= 3) {
      for (let offset = 0; offset <= token.length - 3; offset += 1) {
        addFeature(vector, `tri:${token.slice(offset, offset + 3)}`, 0.2);
      }
    }
  });

  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0),
  );

  return magnitude > 0
    ? vector.map((value) => value / magnitude)
    : vector;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---------------------------------------------------------------------------
// SQL dialect helpers
// ---------------------------------------------------------------------------

function getDialect(connection) {
  if (!connection || connection.databaseType === "sqlite") return "sqlite";
  return connection.databaseType;
}

function dateOnly(d, col) {
  return d === "sqlite" ? `date(${col})` : `DATE(${col})`;
}

function today(d) {
  return d === "sqlite" ? "date('now','localtime')" : "CURRENT_DATE";
}

function dateOffset(d, days) {
  if (d === "postgresql") return `CURRENT_DATE - INTERVAL '${days} day'`;
  if (d === "mysql")      return `CURRENT_DATE - INTERVAL ${days} DAY`;
  return `date('now','localtime','-${days} day')`;
}

function monthStart(d) {
  if (d === "postgresql") return "DATE_TRUNC('month', CURRENT_DATE)";
  if (d === "mysql")      return "DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')";
  return "date('now','localtime','start of month')";
}

function prevMonthStart(d) {
  if (d === "postgresql") return "DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')";
  if (d === "mysql")      return "DATE_FORMAT(CURRENT_DATE - INTERVAL 1 MONTH,'%Y-%m-01')";
  return "date('now','localtime','start of month','-1 month')";
}

function hourExpr(d, col) {
  if (d === "postgresql") return `EXTRACT(HOUR FROM ${col}::timestamp)`;
  if (d === "mysql")      return `HOUR(${col})`;
  return `CAST(strftime('%H', ${col}) AS INTEGER)`;
}

// ---------------------------------------------------------------------------
// Currency / number formatting
// ---------------------------------------------------------------------------

function Rs(value) {
  return `Rs ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function pct(current, previous) {
  if (!Number(previous)) return null;
  const delta = ((Number(current) - Number(previous)) / Number(previous)) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function trend(current, previous) {
  if (!Number(previous)) return "";
  const delta = Number(current) - Number(previous);
  const p = pct(current, previous);
  return delta >= 0 ? `↑ ${p} vs prior period` : `↓ ${p} vs prior period`;
}

// ---------------------------------------------------------------------------
// Entity extraction helpers
// ---------------------------------------------------------------------------

const DATE_RANGE_PATTERNS = [
  { re: /\b(today|aaj)\b/i,                         range: "today" },
  { re: /\b(yesterday|kal)\b/i,                      range: "yesterday" },
  { re: /\b(this week|is hafte|last 7 days?)\b/i,    range: "week" },
  { re: /\b(this month|is mahine|current month)\b/i,  range: "month" },
  { re: /\b(last month|pichle mahine)\b/i,            range: "last_month" },
  { re: /\b(last 30 days?|past month)\b/i,            range: "30days" },
];

function extractDateRange(msg) {
  for (const { re, range } of DATE_RANGE_PATTERNS) {
    if (re.test(msg)) return range;
  }
  return "week";
}

function extractLimit(msg) {
  const m = msg.match(/\btop\s*(\d+)\b/i) || msg.match(/\b(\d+)\s*(products?|customers?|items?|orders?)\b/i);
  return m ? Math.min(Math.max(Number(m[1]), 1), 20) : 5;
}

function rangeSql(d, range) {
  switch (range) {
    case "today":      return `${dateOnly(d, "ordered_at")} = ${today(d)}`;
    case "yesterday":  return `${dateOnly(d, "ordered_at")} = ${dateOffset(d, 1)}`;
    case "week":       return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 6)}`;
    case "month":      return `${dateOnly(d, "ordered_at")} >= ${monthStart(d)}`;
    case "last_month":
      return `${dateOnly(d, "ordered_at")} >= ${prevMonthStart(d)} AND ${dateOnly(d, "ordered_at")} < ${monthStart(d)}`;
    case "30days":     return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 29)}`;
    default:           return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 6)}`;
  }
}

function rangeSqlOn(d, range, col) {
  switch (range) {
    case "today":      return `${dateOnly(d, col)} = ${today(d)}`;
    case "yesterday":  return `${dateOnly(d, col)} = ${dateOffset(d, 1)}`;
    case "week":       return `${dateOnly(d, col)} >= ${dateOffset(d, 6)}`;
    case "month":      return `${dateOnly(d, col)} >= ${monthStart(d)}`;
    case "last_month":
      return `${dateOnly(d, col)} >= ${prevMonthStart(d)} AND ${dateOnly(d, col)} < ${monthStart(d)}`;
    case "30days":     return `${dateOnly(d, col)} >= ${dateOffset(d, 29)}`;
    default:           return `${dateOnly(d, col)} >= ${dateOffset(d, 6)}`;
  }
}

// Build the "previous equivalent" range for comparison
function prevRangeSql(d, range) {
  switch (range) {
    case "today":
      return `${dateOnly(d, "ordered_at")} = ${dateOffset(d, 1)}`;
    case "yesterday":
      return `${dateOnly(d, "ordered_at")} = ${dateOffset(d, 2)}`;
    case "week":
      return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 13)} AND ${dateOnly(d, "ordered_at")} < ${dateOffset(d, 6)}`;
    case "month":
      return `${dateOnly(d, "ordered_at")} >= ${prevMonthStart(d)} AND ${dateOnly(d, "ordered_at")} < ${monthStart(d)}`;
    case "last_month": {
      if (d === "postgresql") return `${dateOnly(d, "ordered_at")} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '2 month') AND ${dateOnly(d, "ordered_at")} < ${prevMonthStart(d)}`;
      if (d === "mysql")      return `${dateOnly(d, "ordered_at")} >= DATE_FORMAT(CURRENT_DATE - INTERVAL 2 MONTH,'%Y-%m-01') AND ${dateOnly(d, "ordered_at")} < ${prevMonthStart(d)}`;
      return `${dateOnly(d, "ordered_at")} >= date('now','localtime','start of month','-2 month') AND ${dateOnly(d, "ordered_at")} < ${prevMonthStart(d)}`;
    }
    case "30days":
      return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 59)} AND ${dateOnly(d, "ordered_at")} < ${dateOffset(d, 29)}`;
    default:
      return `${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 13)} AND ${dateOnly(d, "ordered_at")} < ${dateOffset(d, 6)}`;
  }
}

function rangeLabel(range) {
  return { today: "today", yesterday: "yesterday", week: "last 7 days",
           month: "this month", last_month: "last month", "30days": "last 30 days" }[range] || "last 7 days";
}

// ---------------------------------------------------------------------------
// Conversation memory — resolve pronouns and references from chat history
// ---------------------------------------------------------------------------

const REFERENCE_WORDS = /\b(it|its|this|that|the (product|item|customer|order|one)|first one|second one|top one|them|those|these)\b/i;

function extractEntitiesFromReply(reply) {
  if (!reply) return {};
  const entities = {};

  // Extract product names from numbered lists: "1. Product Name ..."
  const productMatches = [...reply.matchAll(/^\d+\.\s+([A-Za-z][\w\s&'-]+?)\s*(?:\(|—|–|-)/gm)];
  if (productMatches.length > 0) {
    entities.firstProduct = productMatches[0]?.[1]?.trim();
    entities.secondProduct = productMatches[1]?.[1]?.trim();
    entities.allProducts = productMatches.map((m) => m[1].trim());
  }

  // Extract customer names from "• Name (email)"
  const customerMatches = [...reply.matchAll(/^•\s+([A-Za-z][\w\s'-]+?)\s*\(/gm)];
  if (customerMatches.length > 0) {
    entities.firstCustomer = customerMatches[0]?.[1]?.trim();
    entities.allCustomers = customerMatches.map((m) => m[1].trim());
  }

  return entities;
}

function resolveMessage(message, history) {
  if (!history || history.length === 0) return message;
  if (!REFERENCE_WORDS.test(message)) return message;

  // Collect context from last 3 assistant messages
  const recentReplies = history
    .filter((h) => h.role === "assistant")
    .slice(-3)
    .map((h) => h.content);

  for (const reply of [...recentReplies].reverse()) {
    const entities = extractEntitiesFromReply(reply);

    if (/\bfirst one\b|\bnumber one\b|\b#1\b/i.test(message) && entities.firstProduct) {
      return message.replace(/\bfirst one\b|\bnumber one\b|\b#1\b/gi, entities.firstProduct);
    }
    if (/\bsecond one\b|\bnumber two\b|\b#2\b/i.test(message) && entities.secondProduct) {
      return message.replace(/\bsecond one\b|\bnumber two\b|\b#2\b/gi, entities.secondProduct);
    }
    if (/\b(it|that product|this product|that item)\b/i.test(message) && entities.firstProduct) {
      return message.replace(/\b(it|that product|this product|that item)\b/gi, entities.firstProduct);
    }
    if (/\b(that customer|this customer)\b/i.test(message) && entities.firstCustomer) {
      return message.replace(/\b(that customer|this customer)\b/gi, entities.firstCustomer);
    }
  }

  return message;
}

// Build a context summary from history for ambiguous queries
function buildContextHint(history) {
  if (!history || history.length === 0) return "";
  const last = history[history.length - 1];
  if (!last) return "";
  // Return a short summary of what was last discussed
  const reply = last.role === "assistant" ? last.content : "";
  if (reply.startsWith("Top products")) return "user was looking at top products";
  if (reply.startsWith("Top customers")) return "user was looking at top customers";
  if (reply.startsWith("Sales summary")) return "user was looking at sales data";
  if (reply.startsWith("Low stock")) return "user was looking at inventory";
  return "";
}

// ---------------------------------------------------------------------------
// Intent library
// ---------------------------------------------------------------------------

const INTENTS = [

  // ── Sales snapshot (with auto trend comparison) ───────────────────────────

  {
    name: "sales_snapshot",
    examples: [
      "what are my sales today",
      "today revenue and orders",
      "how much did I earn today",
      "aaj ki sales",
      "yesterday sales total",
      "kal ki kamai",
      "this week total revenue",
      "weekly sales summary",
      "is hafte ki sales",
      "this month revenue",
      "is mahine ka revenue",
      "last month earnings",
      "pichle mahine ki sales",
      "how much in last 30 days",
      "daily sales figure",
      "total orders and revenue",
      "show me revenue",
      "what is my total earning",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT COUNT(*) AS orders_count,
               COALESCE(SUM(total_amount), 0) AS revenue,
               ROUND(COALESCE(AVG(total_amount), 0), 2) AS avg_order
        FROM orders WHERE ${rangeSql(d, range)}
      `;
    },
    buildSqlCompare: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT COUNT(*) AS orders_count,
               COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders WHERE ${prevRangeSql(d, range)}
      `;
    },
    format: (rows, msg, compareRows) => {
      const range = extractDateRange(msg);
      const r = rows[0] || {};
      const p = compareRows?.[0] || {};
      const revTrend = trend(r.revenue, p.revenue);
      const lines = [
        `Sales summary — ${rangeLabel(range)}:`,
        `Orders:  ${r.orders_count || 0}`,
        `Revenue: ${Rs(r.revenue)}`,
        `Avg order: ${Rs(r.avg_order)}`,
      ];
      if (revTrend) lines.push(revTrend);
      return lines.join("\n");
    },
  },

  // ── Top products ──────────────────────────────────────────────────────────

  {
    name: "top_products",
    examples: [
      "what are my best selling products",
      "top 5 products by revenue",
      "top 10 products this week",
      "which products sell the most",
      "highest revenue products",
      "sabse zyada bikne wale products",
      "kaun se products popular hain",
      "best products this month",
      "most popular items",
      "product sales ranking",
      "product performance report",
      "best performing products",
      "which items are selling fast",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      const limit = extractLimit(msg);
      return `
        SELECT p.name, p.category,
               SUM(oi.quantity) AS units_sold,
               COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o   ON o.id = oi.order_id
        WHERE ${rangeSqlOn(d, range, "o.ordered_at")}
        GROUP BY p.id, p.name, p.category
        ORDER BY revenue DESC, units_sold DESC
        LIMIT ${limit}
      `;
    },
    format: (rows, msg) => {
      if (!rows.length) return "No product sales found for that period.";
      const range = extractDateRange(msg);
      const lines = rows.map(
        (r, i) => `${i + 1}. ${r.name} (${r.category}) — ${r.units_sold} units, ${Rs(r.revenue)}`,
      );
      const insight = rows[0] ? `\nTop performer: ${rows[0].name} with ${Rs(rows[0].revenue)} revenue.` : "";
      return [`Top products — ${rangeLabel(range)}:`, ...lines, insight].join("\n");
    },
  },

  // ── Best today ────────────────────────────────────────────────────────────

  {
    name: "top_selling_today",
    examples: [
      "what is selling best today",
      "today best products",
      "aaj kya zyada bika",
      "most sold items today",
      "today's top items",
      "which products moved today",
      "aaj ki best performance",
    ],
    buildSql: (d, msg) => {
      const limit = extractLimit(msg);
      return `
        SELECT p.name, p.category,
               SUM(oi.quantity) AS units_sold,
               COALESCE(SUM(oi.total_price), 0) AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o   ON o.id = oi.order_id
        WHERE ${dateOnly(d, "o.ordered_at")} = ${today(d)}
        GROUP BY p.id, p.name, p.category
        ORDER BY units_sold DESC, revenue DESC
        LIMIT ${limit}
      `;
    },
    format: (rows) => {
      if (!rows.length) return "No sales recorded yet today.";
      const lines = rows.map((r, i) => `${i + 1}. ${r.name} — ${r.units_sold} units, ${Rs(r.revenue)}`);
      return ["Today's top products:", ...lines].join("\n");
    },
  },

  // ── Low stock ─────────────────────────────────────────────────────────────

  {
    name: "low_stock",
    examples: [
      "which products are low on stock",
      "low stock alert",
      "items running out of stock",
      "inventory shortage warning",
      "stock kam hai kaun se products mein",
      "out of stock soon",
      "products need restocking",
      "check inventory levels",
      "how is inventory looking",
      "which items to reorder",
      "kya stock khatam hone wala hai",
      "show me products below 10 units",
      "inventory warning",
    ],
    buildSql: (_, msg) => {
      const m = msg.match(/\b(\d+)\s*units?\b/i);
      const threshold = m ? Number(m[1]) : 15;
      return `
        SELECT name, category, stock, price
        FROM products
        WHERE stock <= ${threshold} AND stock > 0
        ORDER BY stock ASC, price DESC
        LIMIT 15
      `;
    },
    format: (rows) => {
      if (!rows.length) return "Good news — all products are well stocked.";
      const lines = rows.map(
        (r) => `• ${r.name} (${r.category}) — ${r.stock} units left @ ${Rs(r.price)}`,
      );
      const urgent = rows.filter((r) => Number(r.stock) <= 5);
      const tip = urgent.length
        ? `\nUrgent — restock immediately: ${urgent.map((r) => r.name).join(", ")}`
        : "";
      return ["Low stock items:", ...lines, tip].join("\n");
    },
  },

  // ── Out-of-stock ──────────────────────────────────────────────────────────

  {
    name: "out_of_stock",
    examples: [
      "which products are out of stock",
      "zero stock products",
      "items not available",
      "khatam ho gaye products",
      "what is unavailable",
      "stockout alert",
      "show products with no inventory",
      "products with zero units",
    ],
    buildSql: () => `
      SELECT name, category, price
      FROM products
      WHERE stock = 0
      ORDER BY name
    `,
    format: (rows) => {
      if (!rows.length) return "Great news — no products are out of stock right now.";
      const lines = rows.map((r) => `• ${r.name} (${r.category}) — ${Rs(r.price)}`);
      return [`Out of stock (${rows.length} products):`, ...lines, "\nAction needed: restock these items to avoid lost sales."].join("\n");
    },
  },

  // ── Restock recommendations ────────────────────────────────────────────────

  {
    name: "restock_recommendation",
    examples: [
      "what should I restock",
      "restock suggestions",
      "which products should I order more of",
      "buying recommendations",
      "products running low that sell well",
      "reorder list",
      "kitna stock mangwana chahiye",
      "inventory replenishment suggestions",
      "what to buy more of",
    ],
    buildSql: (d) => `
      SELECT p.name, p.category, p.stock,
             COALESCE(SUM(oi.quantity), 0) AS units_sold_week
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND ${dateOnly(d, "o.ordered_at")} >= ${dateOffset(d, 6)}
      WHERE p.stock < 20
      GROUP BY p.id, p.name, p.category, p.stock
      ORDER BY units_sold_week DESC, p.stock ASC
      LIMIT 10
    `,
    format: (rows) => {
      if (!rows.length) return "No restock recommendations right now — inventory looks healthy.";
      const lines = rows.map((r) => {
        const velocity = Number(r.units_sold_week || 0);
        const daysLeft = velocity > 0 ? Math.floor((Number(r.stock) / velocity) * 7) : null;
        const eta = daysLeft !== null ? `~${daysLeft} days of stock left` : "slow-moving";
        return `• ${r.name} — ${r.stock} units, sold ${velocity} this week (${eta})`;
      });
      return ["Restock recommendations:", ...lines, "\nPrioritise items with fewest days of cover."].join("\n");
    },
  },

  // ── Top customers ─────────────────────────────────────────────────────────

  {
    name: "top_customers",
    examples: [
      "who are my best customers",
      "which customers bought the most",
      "top customers by spending",
      "highest value customers this month",
      "sabse zyada kharcha karne wale customers",
      "VIP customers",
      "loyal customers list",
      "repeat buyers",
      "customer revenue ranking",
      "kaun customers sabse zyada khareedte hain",
      "most valuable customers",
      "high spending customers",
      "biggest buyers",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      const limit = extractLimit(msg);
      return `
        SELECT c.name, c.email,
               COUNT(o.id) AS orders_count,
               COALESCE(SUM(o.total_amount), 0) AS total_spent
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        WHERE ${rangeSqlOn(d, range, "o.ordered_at")}
        GROUP BY c.id, c.name, c.email
        ORDER BY total_spent DESC
        LIMIT ${limit}
      `;
    },
    format: (rows, msg) => {
      if (!rows.length) return "No customer orders found for that period.";
      const range = extractDateRange(msg);
      const lines = rows.map(
        (r, i) =>
          `${i + 1}. ${r.name} — ${r.orders_count} orders, ${Rs(r.total_spent)} spent`,
      );
      return [`Top customers — ${rangeLabel(range)}:`, ...lines].join("\n");
    },
  },

  // ── New customers ─────────────────────────────────────────────────────────

  {
    name: "new_customers",
    examples: [
      "how many new customers today",
      "new customers this week",
      "naye customers",
      "customer acquisition this month",
      "new signups",
      "how many customers joined recently",
      "new buyers this week",
      "kitne naye customers aaye",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT COUNT(*) AS new_count
        FROM customers
        WHERE ${dateOnly(d, "created_at")} >= ${
          range === "today" ? today(d)
          : range === "yesterday" ? dateOffset(d, 1)
          : range === "week" ? dateOffset(d, 6)
          : range === "month" ? monthStart(d)
          : dateOffset(d, 29)
        }
      `;
    },
    buildSqlCompare: (d, msg) => {
      const range = extractDateRange(msg);
      return `SELECT COUNT(*) AS new_count FROM customers WHERE ${prevRangeSql(d, range).replace(/ordered_at/g, "created_at")}`;
    },
    format: (rows, msg, compareRows) => {
      const range = extractDateRange(msg);
      const count = Number(rows[0]?.new_count || 0);
      const prev  = Number(compareRows?.[0]?.new_count || 0);
      const t = trend(count, prev);
      const lines = [
        `New customers — ${rangeLabel(range)}: ${count}`,
      ];
      if (t) lines.push(t);
      return lines.join("\n");
    },
  },

  // ── Profit / margin ───────────────────────────────────────────────────────

  {
    name: "profit_margin",
    examples: [
      "what is my profit margin",
      "gross margin percentage",
      "how profitable am I",
      "profit this month",
      "kitna profit ho raha hai",
      "revenue minus cost",
      "margin calculation",
      "how much do I earn after costs",
      "net earnings",
      "is mahine ka profit",
      "show me profit",
      "what is my profitability",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT
          ROUND(
            (COALESCE(SUM(oi.total_price),0) - COALESCE(SUM(oi.unit_cost * oi.quantity),0))
            * 100.0 / NULLIF(SUM(oi.total_price), 0), 2
          ) AS margin_percent,
          COALESCE(SUM(oi.total_price), 0) AS revenue,
          COALESCE(SUM(oi.unit_cost * oi.quantity), 0) AS cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE ${rangeSqlOn(d, range, "o.ordered_at")}
      `;
    },
    buildSqlCompare: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT COALESCE(SUM(oi.total_price),0) AS revenue,
               COALESCE(SUM(oi.unit_cost * oi.quantity),0) AS cost
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE ${prevRangeSql(d, range).replace(/ordered_at/g, "o.ordered_at")}
      `;
    },
    format: (rows, msg, compareRows) => {
      const r = rows[0] || {};
      const range = extractDateRange(msg);
      const profit = Number(r.revenue || 0) - Number(r.cost || 0);
      const prevProfit = compareRows?.[0]
        ? Number(compareRows[0].revenue || 0) - Number(compareRows[0].cost || 0)
        : null;
      const t = prevProfit !== null ? trend(profit, prevProfit) : "";
      return [
        `Gross margin — ${rangeLabel(range)}:`,
        `Revenue: ${Rs(r.revenue)}`,
        `Cost:    ${Rs(r.cost)}`,
        `Profit:  ${Rs(profit)}`,
        `Margin:  ${Number(r.margin_percent || 0).toFixed(2)}%`,
        t,
      ].filter(Boolean).join("\n");
    },
  },

  // ── Category breakdown ────────────────────────────────────────────────────

  {
    name: "category_breakdown",
    examples: [
      "revenue by category",
      "category wise sales breakdown",
      "which product category performs best",
      "sales by product type",
      "kaun si category zyada bik rahi hai",
      "category revenue split",
      "top categories this week",
      "product category analysis",
      "category performance",
      "which category is best",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT p.category AS name,
               COALESCE(SUM(oi.total_price), 0) AS revenue,
               COALESCE(SUM(oi.quantity), 0) AS units_sold
        FROM products p
        JOIN order_items oi ON oi.product_id = p.id
        JOIN orders o       ON o.id = oi.order_id
        WHERE ${rangeSqlOn(d, range, "o.ordered_at")}
        GROUP BY p.category
        ORDER BY revenue DESC
      `;
    },
    format: (rows, msg) => {
      if (!rows.length) return "No category sales data found for that period.";
      const range = extractDateRange(msg);
      const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const lines = rows.map((r) => {
        const share = total > 0 ? ((Number(r.revenue) / total) * 100).toFixed(1) : "0.0";
        const bar = "█".repeat(Math.round(Number(share) / 10));
        return `• ${r.name}: ${Rs(r.revenue)} (${share}%) ${bar}`;
      });
      return [`Category breakdown — ${rangeLabel(range)}:`, ...lines].join("\n");
    },
  },

  // ── Month-over-month comparison ───────────────────────────────────────────

  {
    name: "month_comparison",
    examples: [
      "compare this month with last month",
      "this month vs last month sales",
      "is mahine aur pichle mahine mein farq",
      "month over month growth",
      "MoM revenue change",
      "how is this month performing vs last",
      "monthly growth comparison",
      "how does this month compare",
      "month comparison report",
    ],
    buildSql: (d) => `
      SELECT
        CASE WHEN ${dateOnly(d, "ordered_at")} >= ${monthStart(d)}
             THEN 'current' ELSE 'previous' END AS bucket,
        COUNT(*) AS orders_count,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE ${dateOnly(d, "ordered_at")} >= ${prevMonthStart(d)}
      GROUP BY bucket
    `,
    format: (rows) => {
      const cur  = rows.find((r) => r.bucket === "current")  || {};
      const prev = rows.find((r) => r.bucket === "previous") || {};
      const curRev  = Number(cur.revenue  || 0);
      const prevRev = Number(prev.revenue || 0);
      const growth = pct(curRev, prevRev);
      const arrow = curRev >= prevRev ? "↑" : "↓";
      return [
        "Month-over-month comparison:",
        `This month: ${cur.orders_count  || 0} orders, ${Rs(curRev)}`,
        `Last month: ${prev.orders_count || 0} orders, ${Rs(prevRev)}`,
        `Revenue change: ${arrow} ${growth ?? "N/A"}`,
        curRev > prevRev
          ? "You're growing — keep it up!"
          : "Revenue is down. Consider promotions or checking what changed.",
      ].join("\n");
    },
  },

  // ── Average order value ───────────────────────────────────────────────────

  {
    name: "average_order_value",
    examples: [
      "what is my average order value",
      "average order size",
      "mean order amount",
      "AOV this month",
      "average transaction value",
      "har order mein average kitna hota hai",
      "average spend per order",
      "what is my AOV",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT COUNT(*) AS orders_count,
               COALESCE(SUM(total_amount), 0) AS revenue,
               ROUND(COALESCE(AVG(total_amount), 0), 2) AS avg_order_value
        FROM orders WHERE ${rangeSql(d, range)}
      `;
    },
    buildSqlCompare: (d, msg) => {
      const range = extractDateRange(msg);
      return `SELECT ROUND(COALESCE(AVG(total_amount),0),2) AS avg_order_value FROM orders WHERE ${prevRangeSql(d, range)}`;
    },
    format: (rows, msg, compareRows) => {
      const r = rows[0] || {};
      const range = extractDateRange(msg);
      const t = compareRows?.[0] ? trend(r.avg_order_value, compareRows[0].avg_order_value) : "";
      return [
        `Average order value — ${rangeLabel(range)}:`,
        `Orders:    ${r.orders_count || 0}`,
        `Revenue:   ${Rs(r.revenue)}`,
        `AOV:       ${Rs(r.avg_order_value)}`,
        t,
      ].filter(Boolean).join("\n");
    },
  },

  // ── Recent orders ─────────────────────────────────────────────────────────

  {
    name: "recent_orders",
    examples: [
      "show me recent orders",
      "latest orders",
      "last 10 orders",
      "recent transactions",
      "haal ke orders dikhao",
      "new orders today",
      "what orders came in recently",
      "order history",
      "show latest purchases",
      "most recent sales",
    ],
    buildSql: (d, msg) => {
      const limit = extractLimit(msg);
      return `
        SELECT o.id, c.name AS customer_name,
               o.total_amount AS total, o.status,
               o.ordered_at AS date
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        ORDER BY o.ordered_at DESC
        LIMIT ${limit}
      `;
    },
    format: (rows) => {
      if (!rows.length) return "No orders found.";
      const lines = rows.map((r) => {
        const d = r.date ? new Date(String(r.date)).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        const status = r.status ? ` [${r.status}]` : "";
        return `• ${r.customer_name} — ${Rs(r.total)} on ${d}${status}`;
      });
      return ["Recent orders:", ...lines].join("\n");
    },
  },

  // ── Pending orders ────────────────────────────────────────────────────────

  {
    name: "pending_orders",
    examples: [
      "how many pending orders",
      "show pending orders",
      "orders not yet shipped",
      "unfulfilled orders",
      "orders in progress",
      "kitne orders pending hain",
      "orders awaiting dispatch",
      "processing orders",
      "orders that need attention",
    ],
    buildSql: () => `
      SELECT o.id, c.name AS customer_name,
             o.total_amount, o.status, o.ordered_at
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE LOWER(o.status) IN ('pending','processing','confirmed','unfulfilled')
      ORDER BY o.ordered_at ASC
      LIMIT 15
    `,
    format: (rows) => {
      if (!rows.length) return "No pending orders — you're all caught up!";
      const lines = rows.map((r) => {
        const d = r.ordered_at ? new Date(String(r.ordered_at)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
        return `• ${r.customer_name} — ${Rs(r.total_amount)} [${r.status}] since ${d}`;
      });
      return [`Pending orders (${rows.length}):`, ...lines].join("\n");
    },
  },

  // ── Product lookup ────────────────────────────────────────────────────────

  {
    name: "product_lookup",
    examples: [
      "how much does this product cost",
      "show product details",
      "product price and stock",
      "tell me about a specific product",
      "is product ki details",
      "search for a product",
      "find product by name",
      "what is the stock of this item",
      "product info",
      "tell me about this item",
    ],
    buildSql: (_, __, keywords) => {
      if (!keywords) {
        return `SELECT name, category, price, stock FROM products ORDER BY name LIMIT 10`;
      }
      const safe = keywords.replace(/'/g, "''");
      return `
        SELECT name, category, price, stock
        FROM products
        WHERE LOWER(name) LIKE LOWER('%${safe}%')
           OR LOWER(category) LIKE LOWER('%${safe}%')
        ORDER BY name LIMIT 10
      `;
    },
    format: (rows) => {
      if (!rows.length) return "No matching products found. Try a shorter keyword.";
      const lines = rows.map(
        (r) => `• ${r.name} (${r.category}) — ${Rs(r.price)}, ${r.stock} in stock`,
      );
      return ["Product details:", ...lines].join("\n");
    },
  },

  // ── Customer lookup ───────────────────────────────────────────────────────

  {
    name: "customer_lookup",
    examples: [
      "find customer by name",
      "customer details",
      "how much has this customer spent",
      "customer purchase history",
      "is customer ne kitna kharcha kiya",
      "show customer info",
      "lookup a customer",
      "customer profile",
      "tell me about this customer",
    ],
    buildSql: (d, _, keywords) => {
      const safe = (keywords || "").replace(/'/g, "''");
      return `
        SELECT c.name, c.email, c.phone,
               COUNT(o.id) AS orders_count,
               COALESCE(SUM(o.total_amount), 0) AS total_spent,
               MAX(o.ordered_at) AS last_order
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        WHERE LOWER(c.name) LIKE LOWER('%${safe}%')
           OR LOWER(c.email) LIKE LOWER('%${safe}%')
        GROUP BY c.id, c.name, c.email, c.phone
        ORDER BY total_spent DESC
        LIMIT 5
      `;
    },
    format: (rows) => {
      if (!rows.length) return "No matching customers found.";
      const lines = rows.map((r) => {
        const last = r.last_order
          ? new Date(String(r.last_order)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "no orders yet";
        return `• ${r.name} (${r.email}) — ${r.orders_count} orders, ${Rs(r.total_spent)} total, last: ${last}`;
      });
      return ["Customer info:", ...lines].join("\n");
    },
  },

  // ── Store overview ────────────────────────────────────────────────────────

  {
    name: "store_overview",
    examples: [
      "give me a store overview",
      "how many customers and products do I have",
      "total customers products orders",
      "store summary",
      "business overview",
      "mera store kaisa chal raha hai",
      "how big is my business",
      "overall store stats",
      "dashboard summary",
      "show me everything",
    ],
    buildSql: (d) => `
      SELECT
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM products)  AS total_products,
        (SELECT COUNT(*) FROM orders WHERE ${dateOnly(d, "ordered_at")} >= ${monthStart(d)}) AS orders_this_month,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE ${dateOnly(d, "ordered_at")} >= ${monthStart(d)}) AS revenue_this_month,
        (SELECT COUNT(*) FROM orders WHERE ${dateOnly(d, "ordered_at")} = ${today(d)}) AS orders_today,
        (SELECT COUNT(*) FROM products WHERE stock = 0) AS out_of_stock_count
    `,
    format: (rows) => {
      const r = rows[0] || {};
      const lines = [
        "Store overview:",
        `Customers:           ${r.total_customers || 0}`,
        `Products:            ${r.total_products || 0}`,
        `Orders this month:   ${r.orders_this_month || 0}`,
        `Revenue this month:  ${Rs(r.revenue_this_month)}`,
        `Orders today:        ${r.orders_today || 0}`,
      ];
      if (Number(r.out_of_stock_count) > 0) {
        lines.push(`⚠ Out of stock:    ${r.out_of_stock_count} products need restocking`);
      }
      return lines.join("\n");
    },
  },

  // ── Daily sales trend ─────────────────────────────────────────────────────

  {
    name: "daily_trend",
    examples: [
      "show me daily sales trend",
      "day by day revenue",
      "sales trend this week",
      "daily breakdown of orders",
      "har din ki sales",
      "daily revenue chart data",
      "weekly daily trend",
      "sales performance by day",
      "revenue trend",
      "sales by day",
    ],
    buildSql: (d, msg) => {
      const range = extractDateRange(msg);
      return `
        SELECT ${dateOnly(d, "ordered_at")} AS day,
               COUNT(*) AS orders_count,
               COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE ${rangeSql(d, range)}
        GROUP BY day ORDER BY day ASC
      `;
    },
    format: (rows, msg) => {
      if (!rows.length) return "No sales data found for that period.";
      const range = extractDateRange(msg);
      const revenues = rows.map((r) => Number(r.revenue || 0));
      const maxRev = Math.max(...revenues, 1);
      const lines = rows.map((r) => {
        const label = new Date(String(r.day)).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
        const barLen = Math.round((Number(r.revenue || 0) / maxRev) * 10);
        const bar = "▪".repeat(barLen);
        return `  ${label}: ${r.orders_count} orders, ${Rs(r.revenue)} ${bar}`;
      });
      const best = rows.reduce((a, b) => Number(a.revenue) > Number(b.revenue) ? a : b, rows[0]);
      const bestLabel = best ? new Date(String(best.day)).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "";
      return [
        `Daily sales trend — ${rangeLabel(range)}:`,
        ...lines,
        bestLabel ? `\nBest day: ${bestLabel} with ${Rs(best.revenue)}` : "",
      ].filter(Boolean).join("\n");
    },
  },

  // ── Hourly trend (today) ──────────────────────────────────────────────────

  {
    name: "hourly_trend",
    examples: [
      "show me hourly sales trend",
      "what time of day do I sell most",
      "peak hours for sales",
      "hour by hour sales today",
      "when are my busiest hours",
      "sales by time of day",
      "har ghante ki sales",
      "kis time pe zyada orders aate hain",
      "which hour has most orders",
    ],
    buildSql: (d) => `
      SELECT ${hourExpr(d, "ordered_at")} AS hour,
             COUNT(*) AS orders_count,
             COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE ${dateOnly(d, "ordered_at")} = ${today(d)}
      GROUP BY hour ORDER BY hour ASC
    `,
    format: (rows) => {
      if (!rows.length) return "No orders yet today.";
      const lines = rows.map((r) => {
        const h = Number(r.hour || 0);
        const label = `${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00`;
        return `  ${label}: ${r.orders_count} orders, ${Rs(r.revenue)}`;
      });
      const peak = rows.reduce((a, b) => Number(a.orders_count) > Number(b.orders_count) ? a : b, rows[0]);
      const peakHour = peak ? `${Number(peak.hour)}:00` : "";
      return [
        "Hourly sales today:",
        ...lines,
        peakHour ? `\nPeak hour: ${peakHour} with ${peak.orders_count} orders` : "",
      ].filter(Boolean).join("\n");
    },
  },

  // ── Best day of week ──────────────────────────────────────────────────────

  {
    name: "best_day_of_week",
    examples: [
      "which day of week has most sales",
      "best day to sell",
      "sales by day of week",
      "weekly pattern of sales",
      "kaun sa din sabse acha hota hai",
      "busiest day of the week",
      "day of week analysis",
      "when do most customers buy",
    ],
    buildSql: (d) => {
      if (d === "postgresql") {
        return `
          SELECT TO_CHAR(ordered_at::timestamp, 'Dy') AS day_name,
                 EXTRACT(DOW FROM ordered_at::timestamp) AS dow,
                 COUNT(*) AS orders_count,
                 COALESCE(SUM(total_amount),0) AS revenue
          FROM orders
          WHERE ${dateOnly(d, "ordered_at")} >= ${dateOffset(d, 29)}
          GROUP BY day_name, dow ORDER BY dow ASC
        `;
      }
      if (d === "mysql") {
        return `
          SELECT DAYNAME(ordered_at) AS day_name,
                 DAYOFWEEK(ordered_at) AS dow,
                 COUNT(*) AS orders_count,
                 COALESCE(SUM(total_amount),0) AS revenue
          FROM orders
          WHERE DATE(ordered_at) >= CURRENT_DATE - INTERVAL 29 DAY
          GROUP BY day_name, dow ORDER BY dow ASC
        `;
      }
      return `
        SELECT CASE CAST(strftime('%w', ordered_at) AS INTEGER)
          WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
          WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
          ELSE 'Sat' END AS day_name,
          CAST(strftime('%w', ordered_at) AS INTEGER) AS dow,
          COUNT(*) AS orders_count,
          COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE date(ordered_at,'localtime') >= date('now','localtime','-29 day')
        GROUP BY dow ORDER BY dow ASC
      `;
    },
    format: (rows) => {
      if (!rows.length) return "Not enough data for day-of-week analysis.";
      const maxRev = Math.max(...rows.map((r) => Number(r.revenue || 0)), 1);
      const lines = rows.map((r) => {
        const barLen = Math.round((Number(r.revenue || 0) / maxRev) * 8);
        return `  ${String(r.day_name).padEnd(4)}: ${r.orders_count} orders, ${Rs(r.revenue)} ${"▪".repeat(barLen)}`;
      });
      const best = rows.reduce((a, b) => Number(a.revenue) > Number(b.revenue) ? a : b, rows[0]);
      return [
        "Sales by day of week (last 30 days):",
        ...lines,
        `\nBest day: ${best.day_name} — consider running promotions on slower days.`,
      ].join("\n");
    },
  },

  // ── Repeat customers ──────────────────────────────────────────────────────

  {
    name: "repeat_customers",
    examples: [
      "how many repeat customers do I have",
      "customer retention rate",
      "returning customers count",
      "repeat buyer stats",
      "kitne customers dobara aate hain",
      "loyal buyer percentage",
      "customer loyalty",
      "retention statistics",
    ],
    buildSql: () => `
      SELECT
        COUNT(*) AS total_customers,
        SUM(CASE WHEN orders_count > 1 THEN 1 ELSE 0 END) AS repeat_customers,
        SUM(CASE WHEN orders_count = 1 THEN 1 ELSE 0 END) AS one_time_customers,
        ROUND(AVG(orders_count), 2) AS avg_orders_per_customer
      FROM (
        SELECT customer_id, COUNT(*) AS orders_count
        FROM orders GROUP BY customer_id
      ) sub
    `,
    format: (rows) => {
      const r = rows[0] || {};
      const total  = Number(r.total_customers || 0);
      const repeat = Number(r.repeat_customers || 0);
      const retention = total > 0 ? ((repeat / total) * 100).toFixed(1) : "0.0";
      const tip = Number(retention) < 30
        ? "\nTip: Retention below 30% — consider loyalty discounts or follow-up emails."
        : Number(retention) > 60
          ? "\nGreat retention! Your customers keep coming back."
          : "";
      return [
        "Customer retention:",
        `Total customers who ordered: ${total}`,
        `Repeat buyers:  ${repeat} (${retention}%)`,
        `One-time buyers: ${r.one_time_customers || 0}`,
        `Avg orders per customer: ${r.avg_orders_per_customer || "—"}`,
        tip,
      ].filter(Boolean).join("\n");
    },
  },

  // ── Revenue by order status ────────────────────────────────────────────────

  {
    name: "revenue_by_status",
    examples: [
      "revenue by order status",
      "how much revenue is in each status",
      "orders breakdown by status",
      "completed vs pending revenue",
      "status wise revenue",
      "order status report",
      "how many delivered orders",
      "order fulfillment stats",
    ],
    buildSql: () => `
      SELECT status,
             COUNT(*) AS orders_count,
             COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      GROUP BY status
      ORDER BY revenue DESC
    `,
    format: (rows) => {
      if (!rows.length) return "No order data available.";
      const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const lines = rows.map((r) => {
        const share = total > 0 ? ((Number(r.revenue) / total) * 100).toFixed(1) : "0.0";
        return `• ${r.status || "unknown"}: ${r.orders_count} orders, ${Rs(r.revenue)} (${share}%)`;
      });
      return ["Revenue by order status:", ...lines].join("\n");
    },
  },

];

// ---------------------------------------------------------------------------
// Embedding index
// ---------------------------------------------------------------------------

let _index = null;

async function buildIndex() {
  if (_index) return _index;
  const entries = [];
  for (const intent of INTENTS) {
    for (const example of intent.examples) {
      const vec = await embed(example);
      entries.push({ intent, vec, example });
    }
  }
  _index = entries;
  return _index;
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","do","did","does","have","has","had",
  "show","tell","give","me","my","i","for","of","and","or","to","from","in",
  "how","what","which","who","when","where","much","many","some","all","any",
  "can","could","would","about","with","on","at","by","this","that","these",
  "those","it","its","we","us","you","your","their","them","he","she","they",
  "product","products","customer","customers","order","orders","revenue","sales",
  "aur","ka","ki","ke","mein","hai","hain","kya","kaun","kitna","kitne","dikhao",
  "se","ne","ko","tha","thi","the","please","find","search","lookup",
]);

function extractKeywords(msg) {
  return msg
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Intent matching
// ---------------------------------------------------------------------------

async function matchIntent(message) {
  if (process.env.ENABLE_SEMANTIC_SEARCH !== "true") {
    const filler = new Set(["how", "is", "are", "were", "was", "what", "which", "who", "my", "me", "the", "a", "an", "show", "tell", "please", "looking", "do", "did", "of", "on", "by"]);
    const words = text => new Set(text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(word => word.length > 1 && !filler.has(word)));
    const query = words(message);
    const customerQuestion = /\b(customers?|buyers?)\b/i.test(message);
    const productQuestion = /\b(products?|items?|inventory|stock)\b/i.test(message);
    let best = { intent: null, score: 0 };
    for (const intent of INTENTS) for (const example of intent.examples) {
      if (customerQuestion && !/\b(customers?|buyers?)\b/i.test(example)) continue;
      if (productQuestion && !customerQuestion && !/\b(products?|items?|inventory|stock|selling)\b/i.test(example)) continue;
      const tokens = words(example);
      const overlap = [...query].filter(token => tokens.has(token)).length;
      const score = overlap / Math.max(query.size, tokens.size, 1);
      if (score > best.score) best = { intent, score };
    }
    return best;
  }
  const index = await buildIndex();
  const queryVec = await embed(message);

  const scored = index.map((entry) => ({
    intent: entry.intent,
    score: cosineSimilarity(queryVec, entry.vec),
  }));

  const byName = new Map();
  for (const { intent, score } of scored) {
    const existing = byName.get(intent.name);
    if (!existing || score > existing.score) {
      byName.set(intent.name, { intent, score });
    }
  }

  const ranked = [...byName.values()].sort((a, b) => b.score - a.score);
  const [first, second, third] = ranked;
  const blendedTop = first
    ? first.score * 0.6 + (second ? second.score * 0.3 : 0) + (third ? third.score * 0.1 : 0)
    : 0;

  return {
    intent: first?.intent || null,
    score: first?.score || 0,
    blendedScore: blendedTop,
  };
}

// ---------------------------------------------------------------------------
// Dynamic fallback for custom/imported tables
// ---------------------------------------------------------------------------

async function tryDynamicQuery(message, connection) {
  const overview = await getSchemaOverviewForConnection(connection);
  const schema = overview.schema;
  if (!schema || schema.length === 0) return null;

  const msg = message.toLowerCase();
  const BUILT_IN = new Set(["customers","orders","order_items","products"]);

  const mentionedTables = schema.filter(t => msg.includes(t.table.toLowerCase()));
  if (mentionedTables.length > 1) return { mode: "clarification", sql: null, rows: [], reply: "This question mentions multiple tables. Connect an AI provider for cross-table analysis, or ask about one table at a time." };
  const customTable = mentionedTables[0];

  const targetTable = customTable
    || (msg.includes("product")  ? schema.find((t) => t.table === "products")  : null)
    || (msg.includes("customer") ? schema.find((t) => t.table === "customers") : null)
    || (msg.includes("order")    ? schema.find((t) => t.table === "orders")    : null)
    || (schema.length === 1 ? schema[0] : null);

  if (!targetTable) return null;

  const numericCols = targetTable.columns.filter((c) => {
    const t = String(c.type || "").toUpperCase();
    return !c.primaryKey && c.name.toLowerCase() !== "id" && (t.includes("INT") || t.includes("REAL") || t.includes("NUM") || t.includes("FLOAT") || t.includes("DECIMAL") || t.includes("DOUBLE"));
  });
  const mentionedNumeric = numericCols.filter(c => msg.includes(c.name.toLowerCase()));
  if (/\b(sum|total|average|avg|mean|top|highest|most)\b/.test(msg) && !/\b(count|how many)\b/.test(msg)) {
    if (mentionedNumeric.length === 1) numericCols.unshift(mentionedNumeric[0]);
    else if (numericCols.length > 1) return { mode: "clarification", sql: null, rows: [], reply: `Which metric in ${targetTable.table} do you mean? Choose ${numericCols.map(c => c.name).join(", ")}.` };
  }

  const labelCols = targetTable.columns.filter((c) => {
    const t = String(c.type || "").toUpperCase();
    return (t.includes("TEXT") || t.includes("CHAR") || t.includes("VARCHAR")) && c.name.toLowerCase() !== "id";
  });

  const quoteId = (s) => connection?.databaseType === "mysql" ? `\`${String(s).replace(/`/g, "``")}\`` : `"${String(s).replace(/"/g, '""')}"`;

  let sql, replyPrefix;

  if (msg.includes("count") || msg.includes("how many") || msg.includes("kitne")) {
    sql = `SELECT COUNT(*) AS row_count FROM ${quoteId(targetTable.table)}`;
    replyPrefix = `Row count for ${targetTable.table}:`;
  } else if ((msg.includes("top") || msg.includes("highest") || msg.includes("most") || msg.includes("zyada")) && numericCols.length) {
    const metricCol = numericCols[0];
    const labelCol = labelCols[0] || targetTable.columns[0];
    const limit = extractLimit(message);
    sql = `SELECT ${quoteId(labelCol.name)} AS label, ${quoteId(metricCol.name)} AS metric FROM ${quoteId(targetTable.table)} ORDER BY ${quoteId(metricCol.name)} DESC LIMIT ${limit}`;
    replyPrefix = `Top rows from ${targetTable.table} by ${metricCol.name}:`;
  } else if ((msg.includes("sum") || msg.includes("total") || msg.includes("kul")) && numericCols.length) {
    const metricCol = numericCols[0];
    sql = `SELECT SUM(${quoteId(metricCol.name)}) AS total_value FROM ${quoteId(targetTable.table)}`;
    replyPrefix = `Total ${metricCol.name} from ${targetTable.table}:`;
  } else if ((msg.includes("average") || msg.includes("avg") || msg.includes("mean")) && numericCols.length) {
    const metricCol = numericCols[0];
    sql = `SELECT ROUND(AVG(${quoteId(metricCol.name)}), 2) AS avg_value FROM ${quoteId(targetTable.table)}`;
    replyPrefix = `Average ${metricCol.name} from ${targetTable.table}:`;
  } else if (/\b(show|sample|preview|list|rows)\b/.test(msg)) {
    const previewCols = targetTable.columns.slice(0, 5).map((c) => quoteId(c.name)).join(", ");
    sql = `SELECT ${previewCols} FROM ${quoteId(targetTable.table)} LIMIT 5`;
    replyPrefix = `Sample rows from ${targetTable.table}:`;
  } else {
    return { mode: "clarification", sql: null, rows: [], reply: `Local queries support counts, totals, averages, top rows, and previews of ${targetTable.table}. For more complex questions, configure the AI provider.` };
  }

  try {
    const rows = await executeReadOnlyQuery(connection, sql);
    let reply;

    if (replyPrefix.startsWith("Row count")) {
      reply = `${replyPrefix} ${rows[0]?.row_count ?? 0}`;
    } else if (replyPrefix.startsWith("Total")) {
      reply = `${replyPrefix} ${Number(rows[0]?.total_value || 0).toLocaleString("en-IN")}`;
    } else if (replyPrefix.startsWith("Average")) {
      reply = `${replyPrefix} ${Number(rows[0]?.avg_value || 0).toFixed(2)}`;
    } else if (replyPrefix.startsWith("Top")) {
      const lines = rows.map((r, i) => `${i + 1}. ${r.label} — ${Number(r.metric || 0).toLocaleString("en-IN")}`);
      reply = [replyPrefix, ...lines].join("\n");
    } else {
      const lines = rows.map((r) =>
        Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", "),
      );
      reply = [replyPrefix, ...lines].join("\n");
    }

    return { mode: "rag_dynamic", sql: sql.trim(), rows, reply };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpful fallback — list what the engine can answer
// ---------------------------------------------------------------------------

function buildHelpReply(message, history) {
  const hint = buildContextHint(history);
  const intro = hint
    ? `I couldn't understand your question (context: ${hint}). `
    : "I'm not sure how to answer that. ";

  return {
    mode: "rag_help",
    reply: [
      intro + "Here's what I can help with:",
      "",
      "Sales & Revenue",
      "  • Sales today / this week / this month / last month",
      "  • Month-over-month comparison",
      "  • Revenue by order status",
      "  • Hourly trend (today), daily trend",
      "  • Best day of the week",
      "",
      "Products & Inventory",
      "  • Top selling products",
      "  • Best selling today",
      "  • Low stock / out of stock alerts",
      "  • Restock recommendations",
      "  • Product lookup by name",
      "",
      "Customers",
      "  • Top customers by spending",
      "  • New customers this week/month",
      "  • Customer lookup by name",
      "  • Repeat buyers & retention rate",
      "",
      "Business Overview",
      "  • Store overview (everything at once)",
      "  • Average order value (AOV)",
      "  • Profit margin",
      "  • Category breakdown",
      "  • Pending orders",
      "",
      "Try asking in English or Hindi — both work!",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const CONFIDENCE_HIGH = 0.52;
const CONFIDENCE_LOW  = 0.38;

export async function buildRagChatReply(message, options = {}) {
  const connection = options.connection || null;
  const history    = options.history    || [];   // [{role, content}]

  // Resolve pronouns / references ("it", "that product", "first one") from history
  const resolvedMessage = resolveMessage(message, history);
  const keywords = extractKeywords(resolvedMessage);

  if (/^\s*(select|with)\b/i.test(resolvedMessage)) {
    const rows = await executeReadOnlyQuery(connection, resolvedMessage);
    return { mode: "sql", sql: resolvedMessage.trim(), rows, reply: `Query returned ${rows.length} rows (maximum 500).` };
  }
  const overview = await getSchemaOverviewForConnection(connection);
  if (/\b(schema|tables|columns)\b/i.test(resolvedMessage)) return { mode: "schema", sql: null, rows: [], reply: overview.schema.map(t => `${t.table}: ${t.columns.map(c => `${c.name} (${c.type})`).join(", ")}`).join("\n") || "Your database has no tables yet." };
  if (!overview.schema.some(t => t.table === "order_items") || overview.schema.some(t => resolvedMessage.toLowerCase().includes(t.table.toLowerCase()) && !["orders", "customers", "products", "order_items"].includes(t.table))) {
    const dynamic = await tryDynamicQuery(resolvedMessage, connection);
    return dynamic || { mode: "clarification", sql: null, rows: [], reply: `Which table should I use? Available tables: ${overview.schema.map(t => t.table).join(", ")}.` };
  }

  const { intent, score } = await matchIntent(resolvedMessage);

  if (intent && score >= CONFIDENCE_HIGH) {
    const dialect = getDialect(connection);
    try {
      const sql  = intent.buildSql(dialect, resolvedMessage, keywords).trim();
      const rows = await executeReadOnlyQuery(connection, sql);

      // Fetch comparison data if intent supports it
      let compareRows = null;
      if (intent.buildSqlCompare) {
        try {
          const sqlCompare = intent.buildSqlCompare(dialect, resolvedMessage).trim();
          compareRows = await executeReadOnlyQuery(connection, sqlCompare);
        } catch { /* comparison is optional */ }
      }

      const reply = intent.format(rows, resolvedMessage, compareRows);
      return { mode: "rag", sql, rows, reply, intentName: intent.name, score: Math.round(score * 100) / 100 };
    } catch {
      // SQL failed — fall through
    }
  }

  if (score >= CONFIDENCE_LOW) {
    const dynamic = await tryDynamicQuery(resolvedMessage, connection);
    if (dynamic) return dynamic;
  }

  return buildHelpReply(message, history);
}

export function warmupRagEngine() {
  if (process.env.ENABLE_SEMANTIC_SEARCH === "true") buildIndex().catch(() => undefined);
}
