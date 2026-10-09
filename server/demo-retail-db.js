import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const isVercelRuntime = Boolean(process.env.VERCEL);
const dataDirectory = process.env.APP_DATA_DIRECTORY ? path.resolve(process.env.APP_DATA_DIRECTORY) : isVercelRuntime
  ? path.join(os.tmpdir(), "orrico-data")
  : path.resolve("server", "data");
const demoDatabasePath = path.join(
  dataDirectory,
  "demo-retail-analytics.sqlite",
);

const demoProducts = [
  {
    id: "p1",
    name: "Samsung Galaxy A34 5G",
    category: "Mobile Phones",
    price: 28999,
    costPrice: 24350,
    stock: 12,
  },
  {
    id: "p2",
    name: "boAt Rockerz 450 Bluetooth Headphones",
    category: "Audio Devices",
    price: 1299,
    costPrice: 760,
    stock: 45,
  },
  {
    id: "p3",
    name: "Lenovo IdeaPad Slim 3",
    category: "Laptops",
    price: 42999,
    costPrice: 36750,
    stock: 6,
  },
  {
    id: "p4",
    name: "Samsung 43-inch Smart LED TV",
    category: "Televisions",
    price: 32999,
    costPrice: 28100,
    stock: 8,
  },
  {
    id: "p5",
    name: "Realme Buds Air 3 TWS Earbuds",
    category: "Audio Devices",
    price: 2999,
    costPrice: 1985,
    stock: 67,
  },
  {
    id: "p6",
    name: "HP LaserJet M126nw Printer",
    category: "Printers & Scanners",
    price: 12499,
    costPrice: 10300,
    stock: 11,
  },
  {
    id: "p7",
    name: "Logitech K380 Wireless Keyboard",
    category: "Computer Accessories",
    price: 1899,
    costPrice: 1240,
    stock: 34,
  },
  {
    id: "p8",
    name: "Xiaomi Power Bank 20000mAh",
    category: "Mobile Accessories",
    price: 1599,
    costPrice: 980,
    stock: 89,
  },
];

const demoCustomers = [
  {
    id: "c1",
    name: "Amit Kumar",
    email: "amit.kumar@email.com",
    phone: "+91 98765 43210",
  },
  {
    id: "c2",
    name: "Priya Patel",
    email: "priya.patel@email.com",
    phone: "+91 98765 43212",
  },
  {
    id: "c3",
    name: "Rajesh Electronics",
    email: "rajesh@business.com",
    phone: "+91 98765 43211",
  },
  {
    id: "c4",
    name: "Sneha Gupta",
    email: "sneha.gupta@email.com",
    phone: "+91 98765 43214",
  },
  {
    id: "c5",
    name: "Arjun Malhotra",
    email: "arjun@email.com",
    phone: "+91 98765 43217",
  },
  {
    id: "c6",
    name: "Meera Iyer",
    email: "meera@email.com",
    phone: "+91 98765 43218",
  },
];

const orderTemplates = [
  { customerId: "c1", productId: "p1", quantity: 1, paymentMethod: "UPI" },
  { customerId: "c2", productId: "p8", quantity: 2, paymentMethod: "Card" },
  { customerId: "c3", productId: "p3", quantity: 1, paymentMethod: "Bank Transfer" },
  { customerId: "c4", productId: "p5", quantity: 2, paymentMethod: "UPI" },
  { customerId: "c5", productId: "p2", quantity: 3, paymentMethod: "Cash" },
  { customerId: "c6", productId: "p4", quantity: 1, paymentMethod: "Card" },
  { customerId: "c1", productId: "p7", quantity: 2, paymentMethod: "UPI" },
  { customerId: "c2", productId: "p6", quantity: 1, paymentMethod: "Cash" },
  { customerId: "c3", productId: "p8", quantity: 5, paymentMethod: "UPI" },
  { customerId: "c4", productId: "p2", quantity: 4, paymentMethod: "Card" },
  { customerId: "c5", productId: "p5", quantity: 1, paymentMethod: "UPI" },
  { customerId: "c6", productId: "p1", quantity: 1, paymentMethod: "EMI" },
];

function ensureDataDirectory() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }
}

function formatDateOffset(daysAgo) {
  const date = new Date();
  date.setHours(13, 30, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function seedDemoRetailDatabase(database) {
  database.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost_price REAL NOT NULL,
      stock INTEGER NOT NULL
    );

    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  const insertProduct = database.prepare(`
    INSERT INTO products (id, name, category, price, cost_price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCustomer = database.prepare(`
    INSERT INTO customers (id, name, email, phone)
    VALUES (?, ?, ?, ?)
  `);
  const insertOrder = database.prepare(`
    INSERT INTO orders (id, customer_id, ordered_at, payment_method, total_amount)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertOrderItem = database.prepare(`
    INSERT INTO order_items (
      id, order_id, product_id, quantity, unit_price, unit_cost, total_price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  demoProducts.forEach((product) => {
    insertProduct.run(
      product.id,
      product.name,
      product.category,
      product.price,
      product.costPrice,
      product.stock,
    );
  });

  demoCustomers.forEach((customer) => {
    insertCustomer.run(
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
    );
  });

  let orderCounter = 1;
  let itemCounter = 1;

  for (let daysAgo = 0; daysAgo < 45; daysAgo += 1) {
    const dailyOrderCount = 2 + (daysAgo % 4);

    for (let dailyIndex = 0; dailyIndex < dailyOrderCount; dailyIndex += 1) {
      const template =
        orderTemplates[(daysAgo + dailyIndex) % orderTemplates.length];
      const product = demoProducts.find(
        (entry) => entry.id === template.productId,
      );

      if (!product) {
        continue;
      }

      const quantity = template.quantity + ((daysAgo + dailyIndex) % 2);
      const totalPrice = quantity * product.price;
      const orderedAt = new Date(formatDateOffset(daysAgo));
      orderedAt.setHours(
        10 + ((daysAgo + dailyIndex) % 8),
        ((daysAgo + dailyIndex) * 7) % 60,
        0,
        0,
      );

      const orderId = `ord-${orderCounter}`;
      const orderItemId = `item-${itemCounter}`;

      insertOrder.run(
        orderId,
        template.customerId,
        orderedAt.toISOString(),
        template.paymentMethod,
        totalPrice,
      );

      insertOrderItem.run(
        orderItemId,
        orderId,
        template.productId,
        quantity,
        product.price,
        product.costPrice,
        totalPrice,
      );

      orderCounter += 1;
      itemCounter += 1;
    }
  }
}

export function ensureDemoRetailDatabase() {
  ensureDataDirectory();

  if (!fs.existsSync(demoDatabasePath)) {
    const database = new DatabaseSync(demoDatabasePath);
    seedDemoRetailDatabase(database);
    database.close();
    return demoDatabasePath;
  }

  const database = new DatabaseSync(demoDatabasePath);

  try {
    const latestOrder = database
      .prepare(`
        SELECT MAX(ordered_at) AS latest_ordered_at
        FROM orders
      `)
      .get();

    const latestTimestamp = Date.parse(
      String(latestOrder?.latest_ordered_at || ""),
    );
    const daysSinceLatestOrder = Number.isFinite(latestTimestamp)
      ? (Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24)
      : Number.POSITIVE_INFINITY;

    if (daysSinceLatestOrder > 2) {
      database.exec(`
        DROP TABLE IF EXISTS order_items;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS customers;
        DROP TABLE IF EXISTS products;
      `);
      seedDemoRetailDatabase(database);
    }
  } finally {
    database.close();
  }

  return demoDatabasePath;
}

export function resolveSqliteDatabasePath(connection) {
  const configuredPath = String(connection?.filePath || "").trim();

  if (
    !configuredPath ||
    configuredPath === "demo_retail_shop.db" ||
    configuredPath === "demo-retail-analytics.sqlite"
  ) {
    return ensureDemoRetailDatabase();
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(configuredPath);
}

export function openRetailDatabase(connection) {
  const databasePath = resolveSqliteDatabasePath(connection);
  return {
    databasePath,
    database: new DatabaseSync(databasePath),
  };
}

export function getSchemaOverview(connection) {
  const { database, databasePath } = openRetailDatabase(connection);

  try {
    const tables = database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all();

    const schema = tables.map((table) => {
      const columns = database
        .prepare(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => ({
          name: column.name,
          type: column.type,
          required: column.notnull === 1,
          primaryKey: column.pk === 1,
        }));

      return {
        table: table.name,
        columns,
      };
    });

    return {
      databasePath,
      schema,
    };
  } finally {
    database.close();
  }
}

function normalizeIdentifier(value, fallbackValue) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallbackValue;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsvContent(csvContent) {
  const content = String(csvContent || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = [];
  let record = [], cell = "", quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') { cell += '"'; index++; }
      else if (quoted || cell.trim() === "") quoted = !quoted;
      else throw new Error("CSV contains an unexpected quote.");
    } else if (char === "," && !quoted) { record.push(cell.trim()); cell = ""; }
    else if (char === "\n" && !quoted) {
      record.push(cell.trim());
      if (record.some(value => value !== "")) records.push(record);
      record = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  record.push(cell.trim());
  if (record.some(value => value !== "")) records.push(record);
  if (records.length < 2) {
    throw new Error("CSV file must include a header row and at least one data row.");
  }
  const headers = records[0].map((header, index) =>
    normalizeIdentifier(header, `column_${index + 1}`),
  );
  if (new Set(headers).size !== headers.length) throw new Error("CSV headers must have unique names after normalization.");
  const rows = records.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${cells.length} values; expected ${headers.length}.`);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });

  return { headers, rows };
}

function inferColumnTypes(rows, headers) {
  return headers.map((header) => {
    const nonEmptyValues = rows
      .map((row) => String(row[header] ?? "").trim())
      .filter(Boolean);

    if (
      nonEmptyValues.length > 0 &&
      nonEmptyValues.every((value) => /^-?\d+$/.test(value))
    ) {
      return { name: header, type: "INTEGER" };
    }

    if (
      nonEmptyValues.length > 0 &&
      nonEmptyValues.every((value) => /^-?\d+(\.\d+)?$/.test(value))
    ) {
      return { name: header, type: "REAL" };
    }

    return { name: header, type: "TEXT" };
  });
}

export function importCsvDataset(
  connection,
  { csvContent, tableName, fileName },
) {
  const { database, databasePath } = openRetailDatabase(connection);

  try {
    const { headers, rows } = parseCsvContent(csvContent);
    const normalizedTableName = normalizeIdentifier(
      tableName || fileName || "imported_data",
      "imported_data",
    );
    const columns = inferColumnTypes(rows, headers);
    const quotedTableName = `"${normalizedTableName}"`;
    const columnDefinitions = columns
      .map((column) => `"${column.name}" ${column.type}`)
      .join(", ");

    database.exec("BEGIN");
    database.exec(`DROP TABLE IF EXISTS ${quotedTableName}`);
    database.exec(`
      CREATE TABLE ${quotedTableName} (
        ${columns.some(column => column.name === "id") ? "" : "id INTEGER PRIMARY KEY AUTOINCREMENT,"}
        ${columnDefinitions}
      )
    `);
    const placeholders = columns.map(() => "?").join(", ");
    const insertStatement = database.prepare(`
      INSERT INTO ${quotedTableName} (${columns
        .map((column) => `"${column.name}"`)
        .join(", ")})
      VALUES (${placeholders})
    `);

    rows.forEach((row) => {
      const values = columns.map((column) => {
        const rawValue = String(row[column.name] ?? "").trim();

        if (!rawValue) {
          return null;
        }

        if (column.type === "INTEGER") {
          return Number.parseInt(rawValue, 10);
        }

        if (column.type === "REAL") {
          return Number.parseFloat(rawValue);
        }

        return rawValue;
      });

      insertStatement.run(...values);
    });

    database.exec("COMMIT");

    return {
      databasePath,
      tableName: normalizedTableName,
      rowCount: rows.length,
      columns,
    };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
    }
    throw error;
  } finally {
    database.close();
  }
}

function assertWritableRetailConnection(connection) {
  if (
    connection &&
    connection.databaseType &&
    connection.databaseType !== "sqlite" &&
    !connection.isDemoConnection
  ) {
    throw new Error(
      "Catalog writes are currently available only for the demo SQLite database and SQLite file connections.",
    );
  }
}

function buildProductIdentifier() {
  return `p-${crypto.randomUUID()}`;
}

function buildCustomerIdentifier() {
  return `c-${crypto.randomUUID()}`;
}

function buildOrderIdentifier() {
  return `ord-${crypto.randomUUID()}`;
}

function buildOrderItemIdentifier() {
  return `item-${crypto.randomUUID()}`;
}

export function createRetailProduct(connection, payload) {
  assertWritableRetailConnection(connection);

  const name = String(payload?.name || "").trim();
  const category = String(payload?.category || "").trim();
  const price = Number(payload?.price);
  const stock = Number.parseInt(String(payload?.stock || ""), 10);
  const costPrice =
    payload?.costPrice !== undefined && payload?.costPrice !== null
      ? Number(payload.costPrice)
      : Math.round(price * 0.75);

  if (!name || !category) {
    throw new Error("Product name and category are required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Product price must be greater than zero.");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Product stock must be zero or more.");
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error("Product cost price is invalid.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const product = {
      id: buildProductIdentifier(),
      name,
      category,
      price,
      costPrice,
      stock,
    };

    database
      .prepare(`
        INSERT INTO products (id, name, category, price, cost_price, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        product.id,
        product.name,
        product.category,
        product.price,
        product.costPrice,
        product.stock,
      );

    return product;
  } finally {
    database.close();
  }
}

export function createRetailOrder(connection, payload) {
  assertWritableRetailConnection(connection);

  const productId = String(payload?.productId || "").trim();
  const quantity = Number.parseInt(String(payload?.quantity || ""), 10);
  const customerId = String(payload?.customerId || "").trim();
  const customerName = String(payload?.customerName || "").trim();
  const customerEmail = String(payload?.customerEmail || "").trim();
  const customerPhone = String(payload?.customerPhone || "").trim();
  const paymentMethod =
    String(payload?.paymentMethod || "").trim() || "Manual";

  if (!productId) {
    throw new Error("Product selection is required.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const product = database
      .prepare(`
        SELECT id, name, category, price, cost_price, stock
        FROM products
        WHERE id = ?
      `)
      .get(productId);

    if (!product) {
      throw new Error("Selected product was not found.");
    }

    if (Number(product.stock || 0) < quantity) {
      throw new Error("Not enough stock is available for that order.");
    }

    database.exec("BEGIN");

    let nextCustomerId = customerId;
    let customer = null;

    if (nextCustomerId) {
      customer = database
        .prepare(`
          SELECT id, name, email, phone
          FROM customers
          WHERE id = ?
        `)
        .get(nextCustomerId);

      if (!customer) {
        throw new Error("Selected customer was not found.");
      }
    } else {
      if (!customerName || !customerEmail) {
        throw new Error(
          "Customer name and email are required for a new customer.",
        );
      }

      nextCustomerId = buildCustomerIdentifier();
      database
        .prepare(`
          INSERT INTO customers (id, name, email, phone)
          VALUES (?, ?, ?, ?)
        `)
        .run(
          nextCustomerId,
          customerName,
          customerEmail,
          customerPhone || null,
        );

      customer = {
        id: nextCustomerId,
        name: customerName,
        email: customerEmail,
        phone: customerPhone || "",
      };
    }

    const totalAmount = Number(product.price) * quantity;
    const orderedAt = new Date().toISOString();
    const orderId = buildOrderIdentifier();
    const orderItemId = buildOrderItemIdentifier();

    database
      .prepare(`
        INSERT INTO orders (id, customer_id, ordered_at, payment_method, total_amount)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        orderId,
        nextCustomerId,
        orderedAt,
        paymentMethod,
        totalAmount,
      );

    database
      .prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, quantity, unit_price, unit_cost, total_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        orderItemId,
        orderId,
        productId,
        quantity,
        Number(product.price),
        Number(product.cost_price),
        totalAmount,
      );

    database
      .prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
      `)
      .run(quantity, productId);

    database.exec("COMMIT");

    return {
      order: {
        id: orderId,
        customerId: nextCustomerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || "",
        productId: product.id,
        productName: product.name,
        quantity,
        total: totalAmount,
        date: orderedAt,
      },
      customer,
    };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
    }
    throw error;
  } finally {
    database.close();
  }
}

export function updateRetailProductStock(connection, payload) {
  assertWritableRetailConnection(connection);

  const productId = String(payload?.productId || "").trim();
  const stock = Number.parseInt(String(payload?.stock || ""), 10);

  if (!productId) {
    throw new Error("Product identifier is required.");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Stock must be zero or more.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const existing = database
      .prepare(`
        SELECT id, name, category, price, stock
        FROM products
        WHERE id = ?
      `)
      .get(productId);

    if (!existing) {
      throw new Error("Product was not found.");
    }

    database
      .prepare(`
        UPDATE products
        SET stock = ?
        WHERE id = ?
      `)
      .run(stock, productId);

    return {
      id: String(existing.id),
      name: existing.name,
      category: existing.category,
      price: Number(existing.price || 0),
      stock,
    };
  } finally {
    database.close();
  }
}

export function updateRetailProduct(connection, payload) {
  assertWritableRetailConnection(connection);

  const productId = String(payload?.productId || "").trim();
  const name = String(payload?.name || "").trim();
  const category = String(payload?.category || "").trim();
  const price = Number(payload?.price);
  const stock = Number.parseInt(String(payload?.stock || ""), 10);
  const costPrice =
    payload?.costPrice !== undefined && payload?.costPrice !== null
      ? Number(payload.costPrice)
      : Math.round(price * 0.75);

  if (!productId) {
    throw new Error("Product identifier is required.");
  }

  if (!name || !category) {
    throw new Error("Product name and category are required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Product price must be greater than zero.");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Stock must be zero or more.");
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error("Product cost price is invalid.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const existing = database
      .prepare(`
        SELECT id
        FROM products
        WHERE id = ?
      `)
      .get(productId);

    if (!existing) {
      throw new Error("Product was not found.");
    }

    database
      .prepare(`
        UPDATE products
        SET name = ?, category = ?, price = ?, cost_price = ?, stock = ?
        WHERE id = ?
      `)
      .run(
        name,
        category,
        price,
        costPrice,
        stock,
        productId,
      );

    return {
      id: productId,
      name,
      category,
      price,
      stock,
      costPrice,
    };
  } finally {
    database.close();
  }
}

export function deleteRetailProduct(connection, payload) {
  assertWritableRetailConnection(connection);

  const productId = String(payload?.productId || "").trim();

  if (!productId) {
    throw new Error("Product identifier is required.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const existing = database
      .prepare(`
        SELECT id, name
        FROM products
        WHERE id = ?
      `)
      .get(productId);

    if (!existing) {
      throw new Error("Product was not found.");
    }

    const linkedOrders = database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM order_items
        WHERE product_id = ?
      `)
      .get(productId);

    if (Number(linkedOrders?.total || 0) > 0) {
      throw new Error(
        "Products with existing order history cannot be deleted.",
      );
    }

    database
      .prepare(`
        DELETE FROM products
        WHERE id = ?
      `)
      .run(productId);

    return {
      id: String(existing.id),
      name: existing.name,
    };
  } finally {
    database.close();
  }
}

export function updateRetailCustomer(connection, payload) {
  assertWritableRetailConnection(connection);

  const customerId = String(payload?.customerId || "").trim();
  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "").trim();
  const phone = String(payload?.phone || "").trim();

  if (!customerId) {
    throw new Error("Customer identifier is required.");
  }

  if (!name || !email) {
    throw new Error("Customer name and email are required.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const existing = database
      .prepare(`
        SELECT id
        FROM customers
        WHERE id = ?
      `)
      .get(customerId);

    if (!existing) {
      throw new Error("Customer was not found.");
    }

    database
      .prepare(`
        UPDATE customers
        SET name = ?, email = ?, phone = ?
        WHERE id = ?
      `)
      .run(name, email, phone || null, customerId);

    return {
      id: customerId,
      name,
      email,
      phone,
    };
  } finally {
    database.close();
  }
}

export function deleteRetailCustomer(connection, payload) {
  assertWritableRetailConnection(connection);

  const customerId = String(payload?.customerId || "").trim();

  if (!customerId) {
    throw new Error("Customer identifier is required.");
  }

  const { database } = openRetailDatabase(connection);

  try {
    const existing = database
      .prepare(`
        SELECT id, name
        FROM customers
        WHERE id = ?
      `)
      .get(customerId);

    if (!existing) {
      throw new Error("Customer was not found.");
    }

    const linkedOrders = database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM orders
        WHERE customer_id = ?
      `)
      .get(customerId);

    if (Number(linkedOrders?.total || 0) > 0) {
      throw new Error(
        "Customers with existing order history cannot be deleted.",
      );
    }

    database
      .prepare(`
        DELETE FROM customers
        WHERE id = ?
      `)
      .run(customerId);

    return {
      id: String(existing.id),
      name: existing.name,
    };
  } finally {
    database.close();
  }
}
