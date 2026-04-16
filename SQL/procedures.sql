-- Trigger to update product stock after a sale item is inserted
DROP TRIGGER IF EXISTS trg_after_sale_item_insert;
CREATE TRIGGER IF NOT EXISTS trg_after_sale_item_insert
AFTER INSERT ON SaleItems
FOR EACH ROW
BEGIN
    UPDATE Products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
END;

-- View for low stock products
DROP VIEW IF EXISTS vw_low_stock_products;
CREATE VIEW IF NOT EXISTS vw_low_stock_products AS
SELECT id, barcode, name, price, stock
FROM Products
WHERE stock <= 5;

-- View for sales summary
DROP VIEW IF EXISTS vw_sales_summary;
CREATE VIEW IF NOT EXISTS vw_sales_summary AS
SELECT 
    s.id, 
    s.date, 
    s.total, 
    s.type, 
    s.status, 
    c.name as client_name,
    u.name as user_name
FROM Sales s
LEFT JOIN Clients c ON s.client_id = c.id
LEFT JOIN Users u ON s.user_id = u.id;

-- View for credit balances
DROP VIEW IF EXISTS vw_client_balances;
CREATE VIEW IF NOT EXISTS vw_client_balances AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    COALESCE(SUM(CASE WHEN s.type = 'credit' THEN s.total ELSE 0 END), 0) -
    COALESCE((SELECT SUM(amount) FROM Payments p WHERE p.client_id = c.id), 0) as balance_due
FROM Clients c
LEFT JOIN Sales s ON c.id = s.client_id
GROUP BY c.id;
