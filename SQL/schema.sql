CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
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
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
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
    user_id INTEGER,
    client_id INTEGER,
    type TEXT NOT NULL DEFAULT 'cash', -- cash or credit
    status TEXT NOT NULL DEFAULT 'completed',
    FOREIGN KEY(user_id) REFERENCES Users(id),
    FOREIGN KEY(client_id) REFERENCES Clients(id)
);

CREATE TABLE IF NOT EXISTS SaleItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
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
    quantity INTEGER NOT NULL,
    reason TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES Products(id)
);

-- Insert initial user (pin: 1234)
INSERT INTO Users (name, pin, role) VALUES ('Admin', '1234', 'admin');

-- Insert some default categories
INSERT INTO Categories (name, description) VALUES ('General', 'Categoría general');
INSERT INTO Categories (name, description) VALUES ('Abarrotes', 'Abarrotes en general');
INSERT INTO Categories (name, description) VALUES ('Bebidas', 'Bebidas y refrescos');
