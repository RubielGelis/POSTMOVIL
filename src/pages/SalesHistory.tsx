import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonButton, useIonViewWillEnter, IonIcon, IonSelect, IonSelectOption, useIonAlert, useIonToast, IonInput, IonModal } from '@ionic/react';
import { FileText, Printer, Trash2, AlertTriangle } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { getReceiptHtml, getSalesReportHtml } from '../services/pdf.service';
import ReportPreviewModal from '../components/ReportPreviewModal';

const SalesHistory: React.FC = () => {
    const [sales, setSales] = useState<any[]>([]);
    const [period, setPeriod] = useState<string>('all'); // all, today, month, range
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [detailModal, setDetailModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [saleItems, setSaleItems] = useState<any[]>([]);
    const [presentAlert] = useIonAlert();
    const [presentToast] = useIonToast();

    // Estado para la vista previa
    const [previewModal, setPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewFileName, setPreviewFileName] = useState('');

    // Get current user role
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const isAdmin = currentUser?.role === 'admin';

    const [loading, setLoading] = useState(false);
    const lastRequest = React.useRef(0);

    const loadSales = React.useCallback(async () => {
        const requestId = ++lastRequest.current;
        setLoading(true);
        try {
            const db = sqliteService.getDb();
            let query = `
                SELECT s.*, c.name as client_name
                FROM Sales s
                LEFT JOIN Clients c ON s.client_id = c.id
                WHERE 1=1
            `;
            const params: any[] = [];

            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            if (period === 'today') {
                query += " AND s.date LIKE ?";
                params.push(`${todayStr}%`);
            } else if (period === 'month') {
                const monthStr = `${year}-${month}`;
                query += " AND s.date LIKE ?";
                params.push(`${monthStr}%`);
            } else if (period === 'range') {
                query += " AND date(s.date) BETWEEN date(?) AND date(?)";
                params.push(startDate, endDate);
            }

            query += " ORDER BY s.id DESC";

            const res = await db.query(query, params);

            // Solo actualizar si esta es la petición más reciente
            if (requestId === lastRequest.current) {
                setSales(res.values || []);
            }
        } catch (error) {
            console.error('Error al cargar ventas:', error);
            if (requestId === lastRequest.current) {
                presentToast({ message: 'Error al cargar el historial', duration: 2000, color: 'danger' });
            }
        } finally {
            if (requestId === lastRequest.current) {
                setLoading(false);
            }
        }
    }, [period, startDate, endDate]);

    // Efecto para recargar cuando cambien los filtros
    React.useEffect(() => {
        loadSales();
    }, [loadSales]);

    useIonViewWillEnter(() => {
        loadSales();
    });

    const viewDetails = async (sale: any) => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT si.quantity, si.price, si.subtotal, p.name
                FROM SaleItems si
                JOIN Products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `, [sale.id]);
            setSaleItems(res.values || []);
            setSelectedSale(sale);
            setDetailModal(true);
        } catch (error) {
            console.error(error);
        }
    };

    const voidSale = async (sale: any) => {
        presentAlert({
            header: 'Anular Factura',
            subHeader: `¿Seguro que desea anular la factura INV-${sale.id.toString().padStart(6, '0')}?`,
            inputs: [
                {
                    name: 'reason',
                    type: 'text',
                    placeholder: 'Motivo de la anulación (mín. 5 letras)',
                }
            ],
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'ANULAR',
                    role: 'confirm',
                    handler: async (data) => {
                        if (!data.reason || data.reason.length < 5) {
                            presentToast({ message: 'Debe ingresar un motivo válido', duration: 2000, color: 'warning' });
                            return false;
                        }
                        await executeVoid(sale, data.reason);
                        return true;
                    }
                }
            ]
        });
    };

    const executeVoid = async (sale: any, reason: string) => {
        try {
            const db = sqliteService.getDb();
            const voidNumber = `VOID-${sale.id.toString().padStart(6, '0')}`;
            const voidDate = new Date().toISOString();

            // 1. Mark sale as voided
            await db.run(
                'UPDATE Sales SET status = ?, void_reason = ?, void_number = ?, void_date = ? WHERE id = ?',
                ['voided', reason, voidNumber, voidDate, sale.id]
            );

            // 2. Get items to restore stock
            const itemsRes = await db.query('SELECT product_id, quantity FROM SaleItems WHERE sale_id = ?', [sale.id]);
            const items = itemsRes.values || [];

            for (const item of items) {
                // Return stock to product
                await db.run(
                    'UPDATE Products SET stock = stock + ? WHERE id = ?',
                    [item.quantity, item.product_id]
                );

                // Register movement
                await db.run(
                    'INSERT INTO StockMovements (product_id, type, quantity, reason, date) VALUES (?, ?, ?, ?, ?)',
                    [item.product_id, 'in', item.quantity, `ANULACIÓN: ${voidNumber}`, voidDate]
                );
            }

            presentToast({ message: `Venta anulada con éxito: ${voidNumber}`, duration: 3000, color: 'success' });
            loadSales();
        } catch (error) {
            console.error(error);
            presentToast({ message: 'Error al anular la venta', duration: 3000, color: 'danger' });
        }
    };

    const printReceipt = async (sale: any) => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT si.quantity, si.price, si.subtotal, p.name 
                FROM SaleItems si
                JOIN Products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `, [sale.id]);

            const clRes = sale.client_id ? await db.query('SELECT name FROM Clients WHERE id = ?', [sale.client_id]) : null;
            const client = clRes && clRes.values && clRes.values.length > 0 ? clRes.values[0] : (sale.client_name ? { name: sale.client_name } : undefined);

            const html = getReceiptHtml(sale, res.values || [], client);
            setPreviewHtml(html);
            setPreviewFileName(`Recibo_INV_${sale.id}`);
            setPreviewModal(true);
        } catch (error) {
            console.error(error);
        }
    };

    const exportGeneralReport = () => {
        const sum = sales.filter(s => s.status !== 'voided').reduce((acc, curr) => acc + curr.total, 0);
        let periodName = 'Histórico Total';
        if (period === 'today') periodName = 'Ventas del Día';
        if (period === 'month') periodName = 'Ventas del Mes';

        const html = getSalesReportHtml(sales, periodName, sales.length, sum);
        setPreviewHtml(html);
        setPreviewFileName(`Reporte_${periodName.replace(/ /g, '_')}`);
        setPreviewModal(true);
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Historial de Ventas</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">

                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', padding: '10px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <IonSelect value={period} onIonChange={e => setPeriod(e.detail.value)} interface="popover">
                            <IonSelectOption value="today">Día Actual</IonSelectOption>
                            <IonSelectOption value="month">Este Mes</IonSelectOption>
                            <IonSelectOption value="range">Rango de Fechas</IonSelectOption>
                            <IonSelectOption value="all">Todas</IonSelectOption>
                        </IonSelect>

                        <IonButton fill="clear" onClick={exportGeneralReport} disabled={sales.length === 0}>
                            <FileText style={{ marginRight: '8px' }} /> Reporte PDF
                        </IonButton>
                    </div>

                    {period === 'range' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <IonInput type="date" value={startDate} onIonChange={(e: any) => setStartDate(e.detail.value!)} style={{ '--background': 'var(--dark-surface)', borderRadius: '8px' }} />
                            <span>a</span>
                            <IonInput type="date" value={endDate} onIonChange={(e: any) => setEndDate(e.detail.value!)} style={{ '--background': 'var(--dark-surface)', borderRadius: '8px' }} />
                        </div>
                    )}
                </div>

                <div style={{ paddingBottom: '20px' }}>
                    {sales.map(s => (
                        <div key={s.id}
                            className="glass-panel"
                            onClick={() => viewDetails(s)}
                            style={{
                                padding: '16px',
                                marginBottom: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                opacity: s.status === 'voided' ? 0.6 : 1,
                                borderLeft: s.status === 'voided' ? '4px solid var(--ion-color-danger)' : 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>INV-{s.id.toString().padStart(6, '0')}</div>
                                    {s.status === 'voided' && <IonLabel color="danger" style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>ANULADA</IonLabel>}
                                </div>
                                <div className="card-subtitle">{new Date(s.date).toLocaleString()}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {s.type === 'cash' ? 'Efectivo' : 'Crédito'}{s.client_name ? ` - ${s.client_name}` : ''}
                                </div>
                                {(parseFloat(s.received_amount) || 0) > 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--ion-color-success)', marginTop: '2px' }}>
                                        Recibido: ${parseFloat(s.received_amount).toFixed(2)} | Vuelto: ${parseFloat(s.change_amount).toFixed(2)}
                                    </div>
                                )}
                                {s.status === 'voided' && (
                                    <div style={{ color: 'var(--ion-color-danger)', fontSize: '0.75rem', marginTop: '4px', fontStyle: 'italic' }}>
                                        Motivo: {s.void_reason}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div className={s.status === 'voided' ? '' : 'gradient-text'} style={{ fontWeight: 'bold', textDecoration: s.status === 'voided' ? 'line-through' : 'none' }}>
                                    ${parseFloat(s.total || 0).toFixed(2)}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <IonButton size="small" fill="outline" onClick={(e) => { e.stopPropagation(); printReceipt(s); }}>
                                        <Printer size={16} />
                                    </IonButton>
                                    {s.status !== 'voided' && isAdmin && (
                                        <IonButton size="small" fill="outline" color="danger" onClick={(e) => { e.stopPropagation(); voidSale(s); }}>
                                            <Trash2 size={16} />
                                        </IonButton>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {sales.length > 0 && (
                        <div className="glass-panel" style={{ padding: '20px', marginTop: '20px', borderTop: '2px solid var(--ion-color-primary)', background: 'var(--dark-surface-hover)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Cantidad de Ventas:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{sales.filter(s => s.status !== 'voided').length}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL RECAUDADO:</span>
                                <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.5rem' }}>
                                    ${sales.filter(s => s.status !== 'voided').reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0).toFixed(2)}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                                * No incluye facturas anuladas
                            </p>
                        </div>
                    )}

                    {sales.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                            No se encontraron ventas
                        </div>
                    )}
                </div>

                <IonModal isOpen={detailModal} onDidDismiss={() => setDetailModal(false)} breakpoints={[0, 0.8]} initialBreakpoint={0.8}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }}>Detalle de Venta</h2>
                            <IonButton fill="clear" onClick={() => setDetailModal(false)}>Cerrar</IonButton>
                        </div>

                        {selectedSale && (
                            <div className="glass-panel" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Factura:</span>
                                    <span style={{ fontWeight: 'bold' }}>INV-{selectedSale.id.toString().padStart(6, '0')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Fecha:</span>
                                    <span>{new Date(selectedSale.date).toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Cliente:</span>
                                    <span>{selectedSale.client_name || 'Consumidor Final'}</span>
                                </div>
                            </div>
                        )}

                        <div className="card-title">Productos</div>
                        <div style={{ marginBottom: '24px' }}>
                            {saleItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.quantity} x ${item.price.toFixed(2)}</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>${item.subtotal.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>

                        {selectedSale && (
                            <div className="glass-panel" style={{ background: 'var(--dark-surface-hover)' }}>
                                {selectedSale.discount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--ion-color-warning)' }}>
                                        <span>Descuento:</span>
                                        <span>-${selectedSale.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: (selectedSale.type === 'cash' && selectedSale.received_amount > 0) ? '12px' : '0' }}>
                                    <span>Total:</span>
                                    <span className="gradient-text">${parseFloat(selectedSale.total).toFixed(2)}</span>
                                </div>

                                {(parseFloat(selectedSale.received_amount) || 0) > 0 && (
                                    <div style={{ borderTop: '1px solid var(--dark-surface)', paddingTop: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Efectivo Recibido:</span>
                                            <span>${parseFloat(selectedSale.received_amount).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--ion-color-success)' }}>
                                            <span>Su Vuelto:</span>
                                            <span>${parseFloat(selectedSale.change_amount).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ marginTop: '20px' }}>
                            <IonButton expand="block" className="beautiful-btn" onClick={() => { printReceipt(selectedSale); }}>
                                <Printer style={{ marginRight: '8px' }} /> Imprimir / Compartir Recibo
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

            </IonContent>
        </IonPage>
    );
};

export default SalesHistory;
