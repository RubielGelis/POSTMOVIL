CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    pin TEXT, -- optional fast pin
    role TEXT DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS Categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    cost REAL DEFAULT 0,
    price REAL NOT NULL,
    stock REAL NOT NULL DEFAULT 0, -- Cambiado a REAL para soportar stock fraccionado
    unit_type TEXT DEFAULT 'unit', -- 'unit', 'kg', 'lb', 'lt', 'm'
    is_weighed INTEGER DEFAULT 0, -- 1: yes, 0: no
    track_stock INTEGER DEFAULT 1,
    category_id INTEGER,
    FOREIGN KEY(category_id) REFERENCES Categories(id)
);

CREATE TABLE IF NOT EXISTS Clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identification TEXT UNIQUE,
    name TEXT NOT NULL,
    contact TEXT
);

CREATE TABLE IF NOT EXISTS Sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    total REAL NOT NULL,
    discount REAL DEFAULT 0,
    user_id INTEGER,
    client_id INTEGER,
    type TEXT NOT NULL DEFAULT 'cash', -- cash or credit
    notes TEXT, -- New: for payment method like Nequi, Transfer, etc.
    status TEXT NOT NULL DEFAULT 'completed', -- completed or voided
    received_amount REAL DEFAULT 0,
    change_amount REAL DEFAULT 0,
    void_reason TEXT,
    void_number TEXT,
    void_date TEXT,
    FOREIGN KEY(user_id) REFERENCES Users(id),
    FOREIGN KEY(client_id) REFERENCES Clients(id)
);

CREATE TABLE IF NOT EXISTS SaleItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, -- Soporta decimales (kg, lt, etc)
    price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES Sales(id),
    FOREIGN KEY(product_id) REFERENCES Products(id)
);

CREATE TABLE IF NOT EXISTS Payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    sale_id INTEGER,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(client_id) REFERENCES Clients(id),
    FOREIGN KEY(sale_id) REFERENCES Sales(id)
);

CREATE TABLE IF NOT EXISTS StockMovements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'in' or 'out'
    quantity REAL NOT NULL, -- Soporta decimales (kg, lt, etc)
    reason TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES Products(id)
);

-- Insert initial user (password: admin123)
INSERT OR IGNORE INTO Users (username, name, password, pin, role) VALUES ('admin', 'Administrador', 'admin123', '1234', 'admin');

-- Insert some default categories
INSERT OR IGNORE INTO Categories (id, name, description) VALUES (1, 'General', 'Categoría general');
INSERT OR IGNORE INTO Categories (id, name, description) VALUES (2, 'Abarrotes', 'Abarrotes en general');
INSERT OR IGNORE INTO Categories (id, name, description) VALUES (3, 'Bebidas', 'Bebidas y refrescos');

-- Insert default client
INSERT OR IGNORE INTO Clients (id, name, identification) VALUES (1, 'Consumidor Final', '0000000000');
