import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonButton, useIonViewWillEnter, IonIcon, IonSelect, IonSelectOption } from '@ionic/react';
import { FileText, Printer } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { generatePdfReceipt, generateSalesReport } from '../services/pdf.service';

const SalesHistory: React.FC = () => {
    const [sales, setSales] = useState<any[]>([]);
    const [period, setPeriod] = useState<string>('all'); // all, today, month

    const loadSales = async () => {
        try {
            const db = sqliteService.getDb();
            let query = 'SELECT * FROM vw_sales_summary ORDER BY date DESC';
            // Simple string matching filters for mock, advanced for native
            const res = await db.query(query);
            
            // Post-filtering for mock / native unify since strftime can vary in mock
            let finalSales = res.values || [];
            if (period === 'today') {
                const today = new Date().toISOString().split('T')[0];
                finalSales = finalSales.filter((s: any) => s.date.startsWith(today));
            } else if (period === 'month') {
                const month = new Date().toISOString().substring(0, 7);
                finalSales = finalSales.filter((s: any) => s.date.startsWith(month));
            }
            
            setSales(finalSales);
        } catch (error) {
            console.error(error);
        }
    };

    useIonViewWillEnter(() => {
        loadSales();
    });

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

            generatePdfReceipt(sale, res.values || [], client);
        } catch (error) {
            console.error(error);
        }
    };

    const exportGeneralReport = () => {
        const sum = sales.reduce((acc, curr) => acc + curr.total, 0);
        let periodName = 'Histórico Total';
        if (period === 'today') periodName = 'Ventas del Día';
        if (period === 'month') periodName = 'Ventas del Mes';
        generateSalesReport(sales, periodName, sales.length, sum);
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Historial de Ventas</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">

                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 16px' }}>
                    <IonSelect value={period} onIonChange={e => { setPeriod(e.detail.value); setTimeout(loadSales, 100); }} interface="popover">
                        <IonSelectOption value="today">Día Actual</IonSelectOption>
                        <IonSelectOption value="month">Este Mes</IonSelectOption>
                        <IonSelectOption value="all">Todas</IonSelectOption>
                    </IonSelect>
                    
                    <IonButton fill="clear" onClick={exportGeneralReport} disabled={sales.length === 0}>
                        <FileText style={{ marginRight: '8px' }} /> Reporte PDF
                    </IonButton>
                </div>

                <div style={{ paddingBottom: '20px' }}>
                    {sales.map(s => (
                        <div key={s.id} className="glass-panel" style={{ padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>INV-{s.id.toString().padStart(6, '0')}</div>
                                <div className="card-subtitle">{new Date(s.date).toLocaleString()}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.type === 'cash' ? 'Efectivo' : 'Crédito'}{s.client_name ? ` - ${s.client_name}` : ''}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div className="gradient-text" style={{ fontWeight: 'bold' }}>${parseFloat(s.total || 0).toFixed(2)}</div>
                                <IonButton size="small" fill="outline" style={{ '--border-radius': 'var(--radius-sm)' }} onClick={() => printReceipt(s)}>
                                    <Printer size={16} />
                                </IonButton>
                            </div>
                        </div>
                    ))}
                    {sales.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                            No se encontraron ventas
                        </div>
                    )}
                </div>

            </IonContent>
        </IonPage>
    );
};

export default SalesHistory;
