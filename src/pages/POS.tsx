import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonList, IonItem, IonLabel, IonIcon, IonFab, IonFabButton, useIonToast, IonInput, IonModal, useIonViewWillEnter } from '@ionic/react';
import { Barcode, ShoppingCart, Trash2, Check, Search, Plus, Minus, DollarSign } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

const POS: React.FC = () => {
    const [cart, setCart] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [searchModal, setSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [checkoutModal, setCheckoutModal] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [present] = useIonToast();

    const loadProducts = async () => {
        try {
            const db = sqliteService.getDb();
            // Load all products for search, not just those with stock > 0
            const res = await db.query('SELECT * FROM Products');
            setProducts(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    useIonViewWillEnter(() => {
        loadProducts();
    });

    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    present({ message: 'Stock insuficiente', duration: 1500 });
                    return prev;
                }
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1, subtotal: (p.quantity + 1) * p.price } : p);
            }
            return [...prev, { ...product, quantity: 1, subtotal: product.price }];
        });
        setSearchModal(false);
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === id) {
                const newQty = p.quantity + delta;
                if (newQty <= 0) return p; // use remote to delete
                if (newQty > p.stock) {
                    present({ message: 'Stock insuficiente', duration: 1500 });
                    return p;
                }
                return { ...p, quantity: newQty, subtotal: newQty * p.price };
            }
            return p;
        }));
    };

    const scanToAdd = async () => {
        try {
            const granted = await BarcodeScanner.requestPermissions();
            if (granted.camera !== 'granted') {
                present({ message: 'Permiso de cámara denegado', duration: 2000 });
                return;
            }

            document.querySelector('body')?.classList.add('barcode-scanner-active');
            const { barcodes } = await BarcodeScanner.scan();
            document.querySelector('body')?.classList.remove('barcode-scanner-active');

            if (barcodes.length > 0) {
                const code = barcodes[0].displayValue;
                const db = sqliteService.getDb();
                const res = await db.query('SELECT * FROM Products WHERE barcode = ?', [code]);
                if (res.values && res.values.length > 0) {
                    const product = res.values[0];
                    if (product.stock <= 0) {
                        present({ message: 'Producto sin stock', duration: 2000, color: 'warning' });
                    } else {
                        addToCart(product);
                    }
                } else {
                    present({ message: 'Producto no encontrado', duration: 2000, color: 'warning' });
                }
            }
        } catch (e) {
            document.querySelector('body')?.classList.remove('barcode-scanner-active');
            present({ message: 'Error de cámara', duration: 2000 });
        }
    };

    const total = cart.reduce((acc, curr) => acc + curr.subtotal, 0);

    const finishSale = async (type: 'cash' | 'credit', clientId?: number) => {
        if (cart.length === 0) return;
        try {
            const db = sqliteService.getDb();
            const date = new Date().toISOString();
            
            const resSale = await db.run(
                `INSERT INTO Sales (date, total, status, type, client_id) VALUES (?, ?, 'completed', ?, ?)`,
                [date, total, type, clientId || null]
            );
            
            const saleId = resSale.changes?.lastId;

            for (const item of cart) {
                await db.run(
                    `INSERT INTO SaleItems (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)`,
                    [saleId, item.id, item.quantity, item.price, item.subtotal]
                );
            }

            present({ message: `Venta a ${type === 'cash' ? 'contado' : 'crédito'} completada`, duration: 2000, color: 'success' });
            setCart([]);
            setCheckoutModal(false);
            await loadProducts();
            // El stock se actualiza automáticamente en el DB por el trigger,
            // pero refrescamos la vista cargando los productos de nuevo.
        } catch (e) {
            console.error(e);
            present({ message: 'Error procesando la venta', duration: 2000, color: 'danger' });
        }
    };

    const handleCheckoutClick = async () => {
        const db = sqliteService.getDb();
        const res = await db.query('SELECT * FROM Clients ORDER BY name ASC');
        setClients(res.values || []);
        setCheckoutModal(true);
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Punto de Venta</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">
                
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                    <IonButton expand="block" className="beautiful-btn" style={{ flex: 1, marginTop: 0 }} onClick={scanToAdd}>
                        <Barcode style={{ marginRight: '8px' }} /> Escanear
                    </IonButton>
                    <IonButton expand="block" fill="outline" style={{ flex: 1, marginTop: 0, '--border-color': 'var(--ion-color-secondary)', '--color': 'var(--text-light)', '--border-radius': 'var(--radius-md)' }} onClick={() => setSearchModal(true)}>
                        <Search style={{ marginRight: '8px', color: 'var(--ion-color-secondary)' }} /> Buscar
                    </IonButton>
                </div>

                <div className="card-title">Carrito Actual</div>
                
                {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', margin: '40px 0', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={48} opacity={0.3} style={{ marginBottom: '16px' }} />
                        <p>No hay productos en el carrito</p>
                    </div>
                ) : (
                    <div style={{ paddingBottom: '90px' }}>
                        {cart.map(item => (
                            <div key={item.id} className="glass-panel" style={{ marginBottom: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.name}</div>
                                    <div style={{ fontWeight: 'bold' }} className="gradient-text">${item.subtotal.toFixed(2)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: 'var(--dark-surface-hover)', padding: '6px', borderRadius: '8px' }} onClick={() => updateQty(item.id, -1)}>
                                            <Minus size={16} />
                                        </div>
                                        <div style={{ fontWeight: 'bold' }}>{item.quantity}</div>
                                        <div style={{ background: 'var(--dark-surface-hover)', padding: '6px', borderRadius: '8px' }} onClick={() => updateQty(item.id, 1)}>
                                            <Plus size={16} />
                                        </div>
                                    </div>
                                    <IonButton fill="clear" color="danger" onClick={() => removeFromCart(item.id)}>
                                        <Trash2 size={20} />
                                    </IonButton>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {cart.length > 0 && (
                    <div style={{ position: 'fixed', bottom: '80px', left: '20px', right: '20px', zIndex: 10 }}>
                        <IonButton expand="block" className="beautiful-btn" style={{ margin: 0, height: '56px', fontSize: '1.1rem' }} onClick={handleCheckoutClick}>
                            Cobrar Total: <strong style={{ marginLeft: '8px' }}>${total.toFixed(2)}</strong>
                        </IonButton>
                    </div>
                )}

                <IonModal isOpen={checkoutModal} onDidDismiss={() => setCheckoutModal(false)} breakpoints={[0, 0.7]} initialBreakpoint={0.7}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }}>Finalizar Venta</h2>
                            <IonButton fill="clear" onClick={() => setCheckoutModal(false)}>Cerrar</IonButton>
                        </div>
                        <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div className="card-subtitle">Total a Cobrar</div>
                            <div className="gradient-text" style={{ fontSize: '2rem', fontWeight: 800 }}>${total.toFixed(2)}</div>
                        </div>

                        <IonButton expand="block" className="beautiful-btn" style={{ height: '60px', marginBottom: '16px' }} onClick={() => finishSale('cash')}>
                            <DollarSign style={{ marginRight: '8px' }} /> Pago en Efectivo
                        </IonButton>

                        <div className="card-title" style={{ marginTop: '24px', marginBottom: '12px' }}>O Asignar a Crédito de Cliente:</div>
                        <IonList style={{ background: 'transparent' }}>
                            {clients.map(c => (
                                <IonItem key={c.id} button onClick={() => finishSale('credit', c.id)} className="glass-panel" style={{ '--padding-start': '16px', marginBottom: '8px', border: '1px solid var(--ion-color-secondary)' }}>
                                    <IonLabel>{c.name}</IonLabel>
                                </IonItem>
                            ))}
                            {clients.length === 0 && (
                                <div style={{ color: 'var(--text-muted)' }}>No hay clientes. Regístrelos en la pestaña Crédito.</div>
                            )}
                        </IonList>
                    </IonContent>
                </IonModal>

                <IonModal isOpen={searchModal} onDidDismiss={() => setSearchModal(false)}>
                    <IonHeader className="ion-no-border">
                        <IonToolbar style={{ '--background': 'var(--dark-bg)' }}>
                            <IonTitle>Buscar Producto</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setSearchModal(false)}>Cerrar</IonButton>
                        </IonToolbar>
                        <IonToolbar style={{ '--background': 'var(--dark-bg)', padding: '0 16px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                <IonInput
                                    placeholder="Nombre o código"
                                    value={searchQuery}
                                    onIonInput={e => setSearchQuery(e.detail.value!)}
                                    style={{ '--background': 'var(--dark-surface)', flex: 1 }}
                                />
                                <IonButton onClick={scanToAdd} fill="clear"><Barcode color="var(--ion-color-secondary)" /></IonButton>
                            </div>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        {products
                            .filter(p =>
                                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (p.barcode && p.barcode.includes(searchQuery))
                            )
                            .map(p => (
                            <div key={p.id} className="glass-panel"
                                 style={{
                                     marginBottom: '12px',
                                     padding: '16px',
                                     display: 'flex',
                                     justifyContent: 'space-between',
                                     alignItems: 'center',
                                     opacity: p.stock <= 0 ? 0.6 : 1
                                 }}
                                 onClick={() => p.stock > 0 ? addToCart(p) : present({message: 'Sin stock', duration: 1000})}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {p.barcode || 'Sin código'} | Stock: {p.stock}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 'bold' }} className="gradient-text">${p.price.toFixed(2)}</div>
                            </div>
                        ))}
                        {products.length > 0 && products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery))).length === 0 && (
                            <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
                                No se encontraron productos
                            </div>
                        )}
                    </IonContent>
                </IonModal>

            </IonContent>
        </IonPage>
    );
};

export default POS;
