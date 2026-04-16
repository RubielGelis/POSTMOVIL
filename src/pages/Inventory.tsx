import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon, IonModal, IonButton, IonInput, useIonToast, IonBadge, useIonViewWillEnter } from '@ionic/react';
import { Plus, Barcode, X } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

const Inventory: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [present] = useIonToast();

    // Form
    const [editId, setEditId] = useState<number | null>(null);
    const [barcode, setBarcode] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');

    const loadProducts = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT * FROM Products ORDER BY name ASC');
            setProducts(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    useIonViewWillEnter(() => {
        loadProducts();
    });

    const openEditModal = (product: any) => {
        setEditId(product.id);
        setBarcode(product.barcode || '');
        setName(product.name);
        setPrice(product.price.toString());
        setStock(product.stock.toString());
        setShowModal(true);
    };

    const openNewModal = () => {
        setEditId(null);
        setBarcode('');
        setName('');
        setPrice('');
        setStock('');
        setShowModal(true);
    };

    const scanBarcode = async () => {
        try {
            const granted = await BarcodeScanner.requestPermissions();
            if (granted.camera !== 'granted') {
                present({ message: 'Permiso de cámara denegado', duration: 2000 });
                return;
            }

            // Hide everything behind the scanner
            document.querySelector('body')?.classList.add('barcode-scanner-active');

            const { barcodes } = await BarcodeScanner.scan();

            document.querySelector('body')?.classList.remove('barcode-scanner-active');

            if (barcodes.length > 0) {
                setBarcode(barcodes[0].displayValue);
            }
        } catch (error) {
            document.querySelector('body')?.classList.remove('barcode-scanner-active');
            present({ message: 'Error al activar la cámara', duration: 3000 });
        }
    };

    const saveProduct = async () => {
        if (!name || !price || !stock) {
            present({ message: 'Por favor, complete todos los campos requeridos', duration: 2000, color: 'warning' });
            return;
        }

        try {
            const db = sqliteService.getDb();
            if (editId) {
                await db.run(
                    'UPDATE Products SET barcode = ?, name = ?, price = ?, stock = ? WHERE id = ?',
                    [barcode || null, name, parseFloat(price) || 0, parseInt(stock, 10) || 0, editId]
                );
                present({ message: 'Producto actualizado', duration: 2000, color: 'success' });
            } else {
                await db.run(
                    'INSERT INTO Products (barcode, name, price, stock) VALUES (?, ?, ?, ?)',
                    [barcode || null, name, parseFloat(price) || 0, parseInt(stock, 10) || 0]
                );
                present({ message: 'Producto guardado', duration: 2000, color: 'success' });
            }
            setShowModal(false);
            loadProducts();
        } catch (error: any) {
            if (error?.message?.includes('UNIQUE')) {
                present({ message: 'El código de barras ya existe', duration: 2000, color: 'danger' });
            } else {
                present({ message: 'Error al guardar', duration: 2000, color: 'danger' });
            }
        }
    };

    const [adjustModal, setAdjustModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [adjustType, setAdjustType] = useState('in');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustReason, setAdjustReason] = useState('');

    const saveAdjustment = async () => {
        if (!adjustQty || parseInt(adjustQty) <= 0) {
            present({ message: 'Ingrese una cantidad válida', duration: 2000, color: 'warning' });
            return;
        }
        try {
            const db = sqliteService.getDb();
            const date = new Date().toISOString();
            await db.run(
                'INSERT INTO StockMovements (product_id, type, quantity, reason, date) VALUES (?, ?, ?, ?, ?)',
                [selectedProduct.id, adjustType, parseInt(adjustQty), adjustReason, date]
            );
            
            // The constraint trigger or native SQLite logic might handle products stock, but in emulator we mapped it.
            // Wait, we didn't add a trigger for StockMovements! Native SQLite needs an explicit update or trigger.
            // It's safer to just run an explicit UPDATE here to support both web mock and native safely.
            const query = adjustType === 'in' ? 'UPDATE Products SET stock = stock + ? WHERE id = ?' : 'UPDATE Products SET stock = stock - ? WHERE id = ?';
            await db.run(query, [parseInt(adjustQty), selectedProduct.id]);
            
            present({ message: 'Movimiento de stock guardado', duration: 2000, color: 'success' });
            setAdjustModal(false);
            setAdjustQty(''); setAdjustReason('');
            loadProducts();
        } catch (error) {
            console.error(error);
            present({ message: 'Error guardando ajuste', duration: 2000, color: 'danger' });
        }
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Inventario</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">
                
                <IonList style={{ background: 'transparent' }}>
                    {products.map(p => (
                        <div key={p.id} className="glass-panel" style={{ marginBottom: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{p.name}</div>
                                <div className="card-subtitle">{p.barcode || 'Sin código'}</div>
                                <div className="gradient-text" style={{ fontWeight: 'bold' }}>${p.price.toFixed(2)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <IonBadge color={p.stock <= 5 ? 'danger' : 'primary'} style={{ marginBottom: '8px' }}>{p.stock} unid.</IonBadge>
                                <br/>
                                <IonButton size="small" fill="outline" style={{ '--border-radius': 'var(--radius-sm)' }} onClick={() => { setSelectedProduct(p); setAdjustModal(true); }}>
                                    Ajustar
                                </IonButton>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                            No hay productos registrados
                        </div>
                    )}
                </IonList>

                <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: '80px', right: '20px' }}>
                    <IonFabButton onClick={openNewModal} style={{ '--background': 'var(--primary-gradient)' }}>
                        <Plus />
                    </IonFabButton>
                </IonFab>

                <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)} breakpoints={[0, 1]} initialBreakpoint={1}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }} className="gradient-text">{editId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                            <IonButton fill="clear" onClick={() => setShowModal(false)}><X color="var(--text-muted)" /></IonButton>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <IonInput label="Código de barras" labelPlacement="stacked" value={barcode} onIonChange={e => setBarcode(e.detail.value!)} placeholder="Ej: 770000..." />
                            <IonButton onClick={scanBarcode} className="beautiful-btn" style={{ margin: 0, height: '44px' }}><Barcode /></IonButton>
                        </div>
                        
                        <IonInput label="Nombre del producto" labelPlacement="stacked" value={name} onIonChange={e => setName(e.detail.value!)} />
                        
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <IonInput type="number" label="Precio" labelPlacement="stacked" value={price} onIonChange={e => setPrice(e.detail.value!)} />
                            <IonInput type="number" label="Stock" labelPlacement="stacked" value={stock} onIonChange={e => setStock(e.detail.value!)} />
                        </div>

                        <IonButton expand="block" className="beautiful-btn" onClick={saveProduct} style={{ marginTop: '24px' }}>
                            Guardar Producto
                        </IonButton>
                    </IonContent>
                </IonModal>

                <IonModal isOpen={adjustModal} onDidDismiss={() => setAdjustModal(false)} breakpoints={[0, 0.7]} initialBreakpoint={0.7}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        {selectedProduct && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2 style={{ margin: 0, fontWeight: 'bold' }}>Ajustar Stock</h2>
                                    <IonButton fill="clear" onClick={() => setAdjustModal(false)}><X color="var(--text-muted)" /></IonButton>
                                </div>
                                <div className="card-subtitle" style={{ marginBottom: '16px' }}>{selectedProduct.name} - Stock actual: {selectedProduct.stock}</div>

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                    <IonButton expand="block" fill={adjustType === 'in' ? 'solid' : 'outline'} color="success" style={{ flex: 1 }} onClick={() => setAdjustType('in')}>+ Entrada</IonButton>
                                    <IonButton expand="block" fill={adjustType === 'out' ? 'solid' : 'outline'} color="danger" style={{ flex: 1 }} onClick={() => setAdjustType('out')}>- Salida</IonButton>
                                </div>

                                <IonInput type="number" label="Cantidad" labelPlacement="stacked" value={adjustQty} onIonChange={e => setAdjustQty(e.detail.value!)} />
                                <IonInput label="Razón / Motivo (Opcional)" labelPlacement="stacked" value={adjustReason} onIonChange={e => setAdjustReason(e.detail.value!)} />

                                <IonButton expand="block" className="beautiful-btn" onClick={saveAdjustment} style={{ marginTop: '24px' }}>
                                    Registrar Movimiento
                                </IonButton>
                            </>
                        )}
                    </IonContent>
                </IonModal>
                
            </IonContent>
        </IonPage>
    );
};

export default Inventory;
