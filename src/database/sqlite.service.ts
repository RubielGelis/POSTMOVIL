import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import schema from '../../SQL/schema.sql?raw';
import procedures from '../../SQL/procedures.sql?raw';

class MockWebDB {
    private tables: any = {
        Users: [{ id: 1, username: 'admin', name: 'Administrador', password: 'admin123', pin: '1234', role: 'admin' }],
        Products: [],
        Sales: [],
        SaleItems: [],
        Clients: [{ id: 1, name: 'Consumidor Final', identification: '0000000000', contact: '', balance_due: 0 }],
        Payments: [],
        StockMovements: []
    };

    constructor() {
        // Load from localStorage if exists
        const saved = localStorage.getItem('mockDB');
        if (saved) {
            this.tables = JSON.parse(saved);
        }
    }

    private persist() {
        localStorage.setItem('mockDB', JSON.stringify(this.tables));
    }

    async execute(query: string) { return { changes: { changes: 1 } }; }
    async open() {}
    async exportToJson() { return { export: this.tables }; }

    async importFromJson(jsonString: string) {
        try {
            const data = JSON.parse(jsonString);
            this.tables = data.tables || data;
            this.persist();
            return { changes: { changes: 1 } };
        } catch (e) {
            console.error("Error en import Mock:", e);
            return { changes: { changes: -1 } };
        }
    }

    async query(statement: string, values: any[] = []) {
        console.log('[Mock WebDB Query]', statement, values);
        if (statement.includes('Users WHERE username = ? AND password = ?')) {
            return { values: this.tables.Users.filter((u: any) => u.username === values[0] && u.password === values[1]) };
        }
        if (statement.includes('Users WHERE pin')) {
            return { values: this.tables.Users.filter((u: any) => u.pin === values[0]) };
        }
        if (statement.includes('FROM Products')) {
            return { values: this.tables.Products };
        }
        if (statement.includes('FROM Clients ORDER')) {
            return { values: this.tables.Clients };
        }
        if (statement.includes('vw_client_balances')) {
            const mapped = this.tables.Clients.map((c: any) => ({
                client_id: c.id, client_name: c.name, balance_due: c.balance_due || 0
            }));
            return { values: mapped };
        }
        if (statement.includes('FROM Sales s') || statement.includes('FROM Sales')) {
            const joined = this.tables.Sales.map((s: any) => ({
                ...s,
                client_name: this.tables.Clients.find((c: any) => c.id === s.client_id)?.name || null
            }));
            return { values: joined };
        }
        if (statement.includes('FROM SaleItems si')) {
            const saleId = values[0];
            const items = this.tables.SaleItems.filter((si: any) => si.sale_id === saleId).map((si: any) => ({
                ...si,
                product_name: this.tables.Products.find((p: any) => p.id === si.product_id)?.name || 'Unknown'
            }));
            return { values: items };
        }
        if (statement.includes('strftime')) {
            // Very basic day group for mock
            return { values: [{ day: new Date().toISOString().split('T')[0], total_sales: this.tables.Sales.length, revenue: this.tables.Sales.reduce((a: any, b: any) => a + b.total, 0) }] };
        }
        if (statement.includes('WHERE s.type = \'credit\'')) {
            const credits: any[] = [];
            this.tables.Sales.filter((s:any) => s.type === 'credit').forEach((s:any) => {
                const client = this.tables.Clients.find((c:any) => c.id === s.client_id);
                this.tables.SaleItems.filter((si:any) => si.sale_id === s.id).forEach((si:any) => {
                    const prod = this.tables.Products.find((p:any) => p.id === si.product_id);
                    credits.push({
                        client_name: client?.name || 'Unknown',
                        product_name: prod?.name || 'Unknown',
                        quantity: si.quantity,
                        price: si.price,
                        subtotal: si.subtotal,
                        date: s.date,
                        sale_id: s.id
                    });
                });
            });
            return { values: credits };
        }
        if (statement.includes('SUM(total)') && statement.includes('Sales')) {
            const today = this.tables.Sales.reduce((a: number, b: any) => a + b.total, 0);
            return { values: [{ total: today }] };
        }
        if (statement.includes('vw_low_stock_products')) {
            const low = this.tables.Products.filter((p: any) => p.stock <= 5);
            return { values: [{ count: low.length }] };
        }
        if (statement.includes('COUNT(*) as count FROM Products')) {
            return { values: [{ count: this.tables.Products.length }] };
        }
        return { values: [] };
    }

    async run(statement: string, values: any[] = []) {
        console.log('[Mock WebDB Run]', statement, values);
        if (statement.includes('INSERT INTO Users')) {
            this.tables.Users.push({ id: Date.now(), username: values[0], name: values[1], password: values[2], role: values[3] });
        }
        if (statement.includes('UPDATE Users SET password = ?')) {
            const user = this.tables.Users.find((u: any) => u.username === values[1]);
            if (user) user.password = values[0];
        }
        if (statement.includes('INSERT INTO Products')) {
            this.tables.Products.push({ id: Date.now(), barcode: values[0], name: values[1], cost: values[2], price: values[3], stock: values[4], track_stock: values[5] });
        }
        if (statement.includes('UPDATE Products SET barcode = ?')) {
            const prod = this.tables.Products.find((p: any) => p.id === values[6]);
            if (prod) {
                prod.barcode = values[0]; prod.name = values[1]; prod.cost = values[2];
                prod.price = values[3]; prod.stock = values[4]; prod.track_stock = values[5];
            }
        }
        if (statement.includes('INSERT INTO Clients')) {
            this.tables.Clients.push({ id: Date.now(), name: values[0], identification: values[1], contact: values[2], balance_due: 0 });
        }
        if (statement.includes('INSERT INTO Sales')) {
            this.tables.Sales.push({
                id: Date.now(),
                date: values[0],
                total: values[1],
                discount: values[2],
                status: 'completed',
                type: values[3],
                client_id: values[4],
                user_id: values[5],
                notes: values[6],
                received_amount: values[7] || 0,
                change_amount: values[8] || 0
            });
            if (values[3] && values[3] === 'credit') {
                const c = this.tables.Clients.find((x: any) => x.id === values[4]);
                if (c) c.balance_due += values[1];
            }
        }
        if (statement.includes('INSERT INTO Payments')) {
            const c = this.tables.Clients.find((x: any) => x.id === values[0]);
            if (c) c.balance_due -= values[1];
        }
        if (statement.includes('INSERT INTO SaleItems')) {
            const prod = this.tables.Products.find((p: any) => p.id === values[1]);
            if (prod) prod.stock -= values[2];
            this.tables.SaleItems.push({
                id: Date.now(),
                sale_id: values[0],
                product_id: values[1],
                quantity: values[2],
                price: values[3],
                subtotal: values[4]
            });
        }
        if (statement.includes('DELETE FROM SaleItems')) {
            this.tables.SaleItems = this.tables.SaleItems.filter((si: any) => si.sale_id !== values[0]);
        }
        if (statement.includes('DELETE FROM Sales')) {
            this.tables.Sales = this.tables.Sales.filter((s: any) => s.id !== values[0]);
        }
        if (statement.includes('UPDATE Products SET stock = stock + ?')) {
            const prod = this.tables.Products.find((p: any) => p.id === values[1]);
            if (prod) prod.stock += values[0];
        }
        if (statement.includes('INSERT INTO StockMovements')) {
            this.tables.StockMovements.push({ id: Date.now(), product_id: values[0], type: values[1], quantity: values[2], reason: values[3], date: values[4] });
            const prod = this.tables.Products.find((p: any) => p.id === values[0]);
            if (prod) {
                if (values[1] === 'in') prod.stock += values[2];
                else prod.stock -= values[2];
            }
        }
        
        this.persist();
        return { changes: { lastId: Date.now() } };
    }
}

class SQLiteService {
    private sqliteConnection: SQLiteConnection;
    private db!: any;
    private isWeb: boolean;

    constructor() {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        this.isWeb = Capacitor.getPlatform() === 'web';
    }

    async initDatabase(): Promise<void> {
        if (this.isWeb) {
            this.db = new MockWebDB() as any;
            return;
        }

        try {
            // Sincronización oficial para limpiar estados corruptos
            await this.sqliteConnection.checkConnectionsConsistency();

            try {
                // Intentamos crear/abrir la conexión
                this.db = await this.sqliteConnection.createConnection('postmovildb', false, 'no-encryption', 1, false);
            } catch (e: any) {
                // Si la conexión ya existe en el motor nativo, la recuperamos
                this.db = await this.sqliteConnection.retrieveConnection('postmovildb', false);
            }

            // Abrir la base de datos
            await this.db.open();

            // 1. Ejecutar esquema base primero
            try {
                await this.db.execute(schema);
                await this.db.execute(procedures);
            } catch (sqlErr) {
                console.warn("Aviso al cargar esquema:", sqlErr);
            }

            // 2. Migraciones rápidas (solo necesarias si actualizas una app ya instalada con esquema viejo)
            // Como el schema.sql ya tiene las columnas, esto solo fallará silenciosamente si ya existen.
            // Es seguro dejarlo, pero genera ruido en los logs.
            console.log('Validando integridad de tablas...');

            console.log('CONEXIÓN EXITOSA');
        } catch (error: any) {
            console.error('ERROR CRÍTICO DB:', error);
            // Intentamos cerrar para liberar el recurso
            try {
                await this.sqliteConnection.closeConnection('postmovildb', false);
            } catch (closeErr) {}
            throw new Error(error.message || "Error al conectar con SQLite");
        }
    }

    getDb(): any {
        return this.db;
    }

    async importFromJson(data: any): Promise<any> {
        if (this.isWeb) {
            return await (this.db as any).importFromJson(JSON.stringify(data));
        }
        // En nativo, importFromJson se llama desde la conexión principal, no desde la DB
        return await this.sqliteConnection.importFromJson(JSON.stringify(data));
    }
}

export const sqliteService = new SQLiteService();
