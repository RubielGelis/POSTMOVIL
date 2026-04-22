import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonList, IonItem, IonLabel, IonIcon, IonFab, IonFabButton, useIonToast, IonInput, IonModal, useIonViewWillEnter, IonSelect, IonSelectOption } from '@ionic/react';
import { Barcode, ShoppingCart, Trash2, Check, Search, Plus, Minus, DollarSign, Printer, FileText } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { getReceiptHtml } from '../services/pdf.service';
import ReportPreviewModal from '../components/ReportPreviewModal';

const POS: React.FC = () => {
    const [cart, setCart] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [searchModal, setSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [checkoutModal, setCheckoutModal] = useState(false);
    const [discount, setDiscount] = useState<number>(0);
    const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'nequi' | 'credit'>('cash');
    const [receivedAmount, setReceivedAmount] = useState<number>(0);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<number | null>(null); // Empieza vacío por defecto
    const [clientSearch, setClientSearch] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', iden: '' });
    const [present] = useIonToast();

    // Estado para la vista previa
    const [previewModal, setPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewFileName, setPreviewFileName] = useState('');

    // Modal para ingreso de peso/cantidad manual
    const [weightModal, setWeightModal] = useState(false);
    const [pendingProduct, setPendingProduct] = useState<any>(null);
    const [manualQty, setManualQty] = useState('');

    // Estado para el modal de éxito/detalle post-venta
    const [successModal, setSuccessModal] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null);
    const [lastSaleItems, setLastSaleItems] = useState<any[]>([]);

    // Declaración única del total y finalTotal
    const total = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
    const finalTotal = total - discount;
    const change = receivedAmount > 0 ? receivedAmount - finalTotal : 0;

    const loadProducts = async () => {
        try {
            const db = sqliteService.getDb();
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
        if (product.is_weighed === 1) {
            setPendingProduct(product);
            setManualQty('');
            setWeightModal(true);
            setSearchModal(false);
            return;
        }

        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                if (product.track_stock === 1 && existing.quantity >= product.stock) {
                    present({ message: 'Stock insuficiente', duration: 1500 });
                    return prev;
                }
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1, subtotal: (p.quantity + 1) * p.price } : p);
            }
            return [...prev, { ...product, quantity: 1, subtotal: product.price }];
        });
        setSearchModal(false);
    };

    const addWeightedProduct = () => {
        const qty = parseFloat(manualQty);
        if (!qty || qty <= 0) {
            present({ message: 'Ingrese una cantidad válida', duration: 1500, color: 'warning' });
            return;
        }

        if (pendingProduct.track_stock === 1 && qty > pendingProduct.stock) {
            present({ message: 'Stock insuficiente para esta cantidad', duration: 1500, color: 'warning' });
            return;
        }

        setCart(prev => {
            const existing = prev.find(p => p.id === pendingProduct.id);
            if (existing) {
                const newQty = existing.quantity + qty;
                return prev.map(p => p.id === pendingProduct.id ? { ...p, quantity: newQty, subtotal: newQty * p.price } : p);
            }
            return [...prev, { ...pendingProduct, quantity: qty, subtotal: qty * pendingProduct.price }];
        });

        setWeightModal(false);
        setPendingProduct(null);
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === id) {
                const newQty = p.quantity + delta;
                if (newQty <= 0) return p;
                if (p.track_stock === 1 && newQty > p.stock) {
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
                    if (product.track_stock === 1 && product.stock <= 0) {
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

    const finishSale = async () => {
        if (cart.length === 0) return;

        if (finalTotal < 0) {
            present({ message: 'El descuento no puede ser mayor al total', duration: 2000, color: 'warning' });
            return;
        }

        if (paymentType === 'cash' && receivedAmount < finalTotal) {
            present({ message: 'El monto recibido es insuficiente', duration: 2000, color: 'warning' });
            return;
        }

        if (paymentType === 'credit' && !selectedClient) {
            present({ message: 'Debe seleccionar un cliente para la venta a crédito', duration: 2000, color: 'warning' });
            return;
        }

        try {
            const db = sqliteService.getDb();
            const date = new Date().toISOString();
            
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const userId = user ? user.id : null;

            const dbType = paymentType === 'credit' ? 'credit' : 'cash';
            const notes = paymentType === 'transfer' ? 'Transferencia' : paymentType === 'nequi' ? 'Nequi' : 'Efectivo';

            const resSale = await db.run(
                `INSERT INTO Sales (date, total, discount, status, type, client_id, user_id, notes, received_amount, change_amount) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)`,
                [date, finalTotal, discount, dbType, selectedClient || 1, userId, notes, parseFloat(receivedAmount.toString()) || 0, parseFloat(change.toString()) || 0]
            );
            
            const saleId = resSale.changes?.lastId;

            const itemsForModal = [];
            for (const item of cart) {
                await db.run(
                    `INSERT INTO SaleItems (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)`,
                    [saleId, item.id, item.quantity, item.price, item.subtotal]
                );
                itemsForModal.push({ ...item, product_name: item.name });
            }

            // Preparar datos para el modal de éxito
            const clientName = clients.find(c => c.id === selectedClient)?.name || 'Consumidor Final';
            setLastSale({
                id: saleId,
                date: date,
                total: finalTotal,
                discount: discount,
                received_amount: receivedAmount,
                change_amount: change,
                client_name: clientName,
                notes: notes
            });
            setLastSaleItems(itemsForModal);
            setSuccessModal(true);

            setCart([]);
            setDiscount(0);
            setReceivedAmount(0);
            setPaymentType('cash');
            setSelectedClient(null);
            setCheckoutModal(false);
            await loadProducts();
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
                                        {item.is_weighed === 1 ? (
                                            <div style={{ fontWeight: 'bold', color: 'var(--ion-color-secondary)' }}>
                                                {item.quantity.toFixed(3)} {item.unit_type}
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ background: 'var(--dark-surface-hover)', padding: '6px', borderRadius: '8px' }} onClick={() => updateQty(item.id, -1)}>
                                                    <Minus size={16} />
                                                </div>
                                                <div style={{ fontWeight: 'bold' }}>{item.quantity}</div>
                                                <div style={{ background: 'var(--dark-surface-hover)', padding: '6px', borderRadius: '8px' }} onClick={() => updateQty(item.id, 1)}>
                                                    <Plus size={16} />
                                                </div>
                                            </>
                                        )}
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

                <IonModal isOpen={checkoutModal} onDidDismiss={() => setCheckoutModal(false)} breakpoints={[0, 1]} initialBreakpoint={1}>
                    <IonHeader className="ion-no-border">
                        <IonToolbar style={{ '--background': 'var(--dark-bg)' }}>
                            <IonTitle style={{ fontWeight: 'bold' }}>Finalizar Venta</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setCheckoutModal(false)}>Cerrar</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div className="card-subtitle">Total a Cobrar</div>
                            <div className="gradient-text" style={{ fontSize: '2.2rem', fontWeight: 800 }}>${finalTotal.toFixed(2)}</div>
                        </div>

                        <div className="card-title" style={{ marginBottom: '10px' }}>Método de Pago</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            <IonButton fill={paymentType === 'cash' ? 'solid' : 'outline'} onClick={() => setPaymentType('cash')} style={{ margin: 0 }}>Efectivo</IonButton>
                            <IonButton fill={paymentType === 'nequi' ? 'solid' : 'outline'} onClick={() => setPaymentType('nequi')} style={{ margin: 0 }}>Nequi</IonButton>
                            <IonButton fill={paymentType === 'transfer' ? 'solid' : 'outline'} onClick={() => setPaymentType('transfer')} style={{ margin: 0 }}>Transferencia</IonButton>
                            <IonButton fill={paymentType === 'credit' ? 'solid' : 'outline'} onClick={() => setPaymentType('credit')} color="secondary" style={{ margin: 0 }}>Crédito</IonButton>
                        </div>

                        {paymentType !== 'credit' && (
                            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                                <IonLabel>Asociar Cliente (Opcional)</IonLabel>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <IonInput
                                        placeholder="Cédula..."
                                        value={clientSearch}
                                        onIonInput={e => setClientSearch(e.detail.value!)}
                                        style={{ '--background': 'var(--dark-surface)', borderRadius: '8px' }}
                                    />
                                    <IonButton fill="outline" onClick={async () => {
                                        const db = sqliteService.getDb();
                                        const res = await db.query('SELECT * FROM Clients WHERE identification = ?', [clientSearch]);
                                        if (res.values && res.values.length > 0) {
                                            setSelectedClient(res.values[0].id);
                                            present({ message: `Cliente: ${res.values[0].name}`, duration: 1500 });
                                        } else {
                                            present({
                                                message: 'No encontrado. ¿Desea crearlo?',
                                                duration: 3000,
                                                color: 'warning',
                                                buttons: [{ text: 'CREAR', handler: () => {
                                                    setNewClientData({ name: '', iden: clientSearch });
                                                    setShowNewClientModal(true);
                                                }}]
                                            });
                                        }
                                    }}>Buscar</IonButton>
                                </div>
                                <IonSelect value={selectedClient} placeholder="Seleccionar Cliente" onIonChange={e => setSelectedClient(e.detail.value)} style={{ marginTop: '10px' }}>
                                    {clients.map(c => (
                                        <IonSelectOption key={c.id} value={c.id}>{c.name} ({c.identification})</IonSelectOption>
                                    ))}
                                </IonSelect>
                            </div>
                        )}

                        {paymentType === 'cash' && (
                            <div className="glass-panel" style={{ marginBottom: '20px', border: '1px solid var(--ion-color-primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <IonLabel>¿Cuánto entrega el cliente?</IonLabel>
                                    <IonInput
                                        type="number"
                                        placeholder="0.00"
                                        value={receivedAmount}
                                        onIonInput={e => setReceivedAmount(parseFloat(e.detail.value!) || 0)}
                                        style={{ '--background': 'var(--dark-surface)', width: '120px', borderRadius: '8px', textAlign: 'right', fontSize: '1.2rem', fontWeight: 'bold' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--dark-surface-hover)', paddingTop: '10px' }}>
                                    <IonLabel style={{ color: 'var(--ion-color-success)', fontWeight: 'bold' }}>SU VUELTO:</IonLabel>
                                    <div style={{ color: 'var(--ion-color-success)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        ${change > 0 ? change.toFixed(2) : '0.00'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentType === 'credit' && (
                            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                                <IonLabel>Seleccionar Cliente</IonLabel>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <IonInput
                                        placeholder="Buscar por cédula..."
                                        value={clientSearch}
                                        onIonInput={e => setClientSearch(e.detail.value!)}
                                        style={{ '--background': 'var(--dark-surface)', borderRadius: '8px' }}
                                    />
                                    <IonButton fill="outline" onClick={async () => {
                                        const db = sqliteService.getDb();
                                        const res = await db.query('SELECT * FROM Clients WHERE identification = ?', [clientSearch]);
                                        if (res.values && res.values.length > 0) {
                                            setSelectedClient(res.values[0].id);
                                            present({ message: `Cliente: ${res.values[0].name}`, duration: 1500 });
                                        } else {
                                            present({
                                                message: 'No encontrado. ¿Crear nuevo?',
                                                duration: 3000,
                                                color: 'warning',
                                                buttons: [{ text: 'CREAR', handler: () => {
                                                    setNewClientData({ name: '', iden: clientSearch });
                                                    setShowNewClientModal(true);
                                                }}]
                                            });
                                        }
                                    }}>Buscar</IonButton>
                                </div>
                                <IonSelect value={selectedClient} placeholder="Toque para elegir" onIonChange={e => setSelectedClient(e.detail.value)} style={{ marginTop: '10px' }}>
                                    {clients.map(c => (
                                        <IonSelectOption key={c.id} value={c.id}>{c.name} ({c.identification})</IonSelectOption>
                                    ))}
                                </IonSelect>
                            </div>
                        )}

                        <div className="glass-panel" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <IonLabel>Descuento aplicado ($):</IonLabel>
                                <IonInput
                                    type="number"
                                    value={discount}
                                    onIonInput={e => setDiscount(parseFloat(e.detail.value!) || 0)}
                                    style={{ '--background': 'var(--dark-surface)', width: '100px', borderRadius: '8px', textAlign: 'center' }}
                                />
                            </div>
                        </div>

                        <IonButton expand="block" className="beautiful-btn" style={{ height: '60px' }} onClick={finishSale}>
                            <Check style={{ marginRight: '8px' }} /> GUARDAR VENTA Y FACTURAR
                        </IonButton>

                        {/* Modal rápido para nuevo cliente */}
                        <IonModal isOpen={showNewClientModal} onDidDismiss={() => setShowNewClientModal(false)} breakpoints={[0, 0.5]} initialBreakpoint={0.5}>
                            <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                                <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Registrar Cliente Nuevo</h3>
                                <div className="glass-panel">
                                    <IonItem className="glass-panel" style={{ marginBottom: '12px' }}>
                                        <IonLabel position="stacked">Nombre Completo</IonLabel>
                                        <IonInput value={newClientData.name} onIonInput={e => setNewClientData({...newClientData, name: e.detail.value!})} placeholder="Ej: Maria Lopez" />
                                    </IonItem>
                                    <IonItem className="glass-panel" style={{ marginBottom: '20px' }}>
                                        <IonLabel position="stacked">Cédula / ID</IonLabel>
                                        <IonInput value={newClientData.iden} onIonInput={e => setNewClientData({...newClientData, iden: e.detail.value!})} />
                                    </IonItem>
                                    <IonButton expand="block" onClick={async () => {
                                        if (!newClientData.name) return;
                                        try {
                                            const db = sqliteService.getDb();
                                            const res = await db.run('INSERT INTO Clients (name, identification) VALUES (?, ?)', [newClientData.name, newClientData.iden]);
                                            const newId = res.changes?.lastId;

                                            // Recargar lista y seleccionar
                                            const resList = await db.query('SELECT * FROM Clients ORDER BY name ASC');
                                            setClients(resList.values || []);
                                            setSelectedClient(newId);

                                            setShowNewClientModal(false);
                                            present({ message: 'Cliente guardado y seleccionado', duration: 2000, color: 'success' });
                                        } catch (e) {
                                            present({ message: 'Error al crear cliente', duration: 2000, color: 'danger' });
                                        }
                                    }}>
                                        Guardar Cliente
                                    </IonButton>
                                </div>
                            </IonContent>
                        </IonModal>
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
                                     opacity: (p.track_stock === 1 && p.stock <= 0) ? 0.6 : 1
                                 }}
                                 onClick={() => (p.track_stock === 0 || p.stock > 0) ? addToCart(p) : present({message: 'Sin stock', duration: 1000})}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {p.barcode || 'Sin código'} | {p.track_stock === 1 ? `Stock: ${p.stock}` : 'Stock ilimitado'}
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

                {/* MODAL DE ÉXITO Y DETALLE (AUTO-OPEN DESPUÉS DE VENTA) */}
                <IonModal isOpen={successModal} onDidDismiss={() => setSuccessModal(false)} breakpoints={[0, 1]} initialBreakpoint={1}>
                    <IonHeader className="ion-no-border">
                        <IonToolbar style={{ '--background': 'var(--dark-bg)' }}>
                            <IonTitle style={{ fontWeight: 'bold' }}>Venta Completada</IonTitle>
                            <IonButton slot="end" fill="clear" onClick={() => setSuccessModal(false)}>Cerrar</IonButton>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ background: 'var(--ion-color-success)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Check size={32} color="white" />
                            </div>
                            <h2 style={{ fontWeight: 800, margin: 0 }}>¡Venta Exitosa!</h2>
                            <p style={{ color: 'var(--text-muted)' }}>La factura ha sido registrada correctamente.</p>
                        </div>

                        {lastSale && (
                            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Factura:</span>
                                    <span style={{ fontWeight: 'bold' }}>INV-{lastSale.id.toString().padStart(6, '0')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Cliente:</span>
                                    <span>{lastSale.client_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Método:</span>
                                    <span style={{ textTransform: 'capitalize' }}>{lastSale.notes}</span>
                                </div>
                            </div>
                        )}

                        <div className="card-title">Resumen de Productos</div>
                        <div style={{ marginBottom: '24px' }}>
                            {lastSaleItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.quantity} x ${item.price.toFixed(2)}</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>${item.subtotal.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>

                        {lastSale && (
                            <div className="glass-panel" style={{ background: 'var(--dark-surface-hover)', marginBottom: '30px' }}>
                                {lastSale.discount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--ion-color-warning)' }}>
                                        <span>Descuento:</span>
                                        <span>-${lastSale.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>
                                    <span>Total:</span>
                                    <span className="gradient-text">${lastSale.total.toFixed(2)}</span>
                                </div>

                                {lastSale.received_amount > 0 && (
                                    <div style={{ borderTop: '1px solid var(--dark-surface)', paddingTop: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Efectivo Recibido:</span>
                                            <span style={{ fontWeight: 'bold' }}>${lastSale.received_amount.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ion-color-success)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            <span>Vuelto:</span>
                                            <span>${lastSale.change_amount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <IonButton expand="block" className="beautiful-btn" onClick={() => {
                                const html = getReceiptHtml(lastSale, lastSaleItems.map(i => ({...i, name: i.product_name})), { name: lastSale.client_name });
                                setPreviewHtml(html);
                                setPreviewFileName(`Recibo_INV_${lastSale.id}`);
                                setPreviewModal(true);
                            }}>
                                <Printer style={{ marginRight: '8px' }} /> Ver / Imprimir Recibo
                            </IonButton>
                            <IonButton expand="block" fill="clear" color="medium" onClick={() => setSuccessModal(false)}>
                                Finalizar y Nueva Venta
                            </IonButton>
                        </div>
                    </IonContent>
                </IonModal>

                <ReportPreviewModal
                    isOpen={previewModal}
                    onClose={() => setPreviewModal(false)}
                    html={previewHtml}
                    fileName={previewFileName}
                />

                {/* MODAL PARA INGRESO DE PESO */}
                <IonModal isOpen={weightModal} onDidDismiss={() => setWeightModal(false)} breakpoints={[0, 0.5]} initialBreakpoint={0.5}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        {pendingProduct && (
                            <div style={{ textAlign: 'center' }}>
                                <h2 style={{ fontWeight: 'bold', marginBottom: '8px' }}>{pendingProduct.name}</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Precio por {pendingProduct.unit_type}: ${pendingProduct.price.toFixed(2)}</p>

                                <div className="glass-panel" style={{ marginBottom: '24px' }}>
                                    <IonLabel position="stacked" style={{ fontSize: '0.9rem', color: 'var(--ion-color-secondary)' }}>Ingrese la cantidad en {pendingProduct.unit_type}</IonLabel>
                                    <IonInput
                                        type="number"
                                        placeholder="0.000"
                                        value={manualQty}
                                        onIonInput={e => setManualQty(e.detail.value!)}
                                        style={{ fontSize: '2rem', textAlign: 'center', fontWeight: 'bold' }}
                                        autofocus
                                    />
                                    {manualQty && (
                                        <div style={{ marginTop: '12px', fontSize: '1.2rem', color: 'var(--ion-color-success)', fontWeight: 'bold' }}>
                                            Subtotal: ${(parseFloat(manualQty) * pendingProduct.price).toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <IonButton expand="block" fill="outline" style={{ flex: 1 }} onClick={() => setWeightModal(false)}>Cancelar</IonButton>
                                    <IonButton expand="block" className="beautiful-btn" style={{ flex: 2 }} onClick={addWeightedProduct}>Aceptar</IonButton>
                                </div>
                            </div>
                        )}
                    </IonContent>
                </IonModal>

            </IonContent>
        </IonPage>
    );
};

export default POS;
