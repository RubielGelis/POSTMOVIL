import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonDatetime, IonModal, IonLabel, IonItem, useIonViewWillEnter, IonList, IonIcon, IonGrid, IonRow, IonCol, useIonToast } from '@ionic/react';
import { FileText, Calendar, Download, TrendingUp, Users, Package, ShoppingBag, Trophy, Filter, ChevronRight } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { getSalesReportHtml, getCreditReportHtml } from '../services/pdf.service';
import ReportPreviewModal from '../components/ReportPreviewModal';

const Reports: React.FC = () => {
    const [salesReport, setSalesReport] = useState<any[]>([]);
    const [detailedSales, setDetailedSales] = useState<any[]>([]); // Para el reporte PDF detallado
    const [creditsReport, setCreditsReport] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [dailyStats, setDailyStats] = useState<any[]>([]);

    const [showFilterModal, setShowFilterModal] = useState(false);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString());
    const [endDate, setEndDate] = useState(new Date().toISOString());

    // Estado para la vista previa
    const [previewModal, setPreviewModal] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewFileName, setPreviewFileName] = useState('');

    const [present] = useIonToast();

    const loadAllData = async () => {
        await loadDailyStats();
        await loadTopProducts();
        await loadSalesReport();
        await loadCreditsReport();
        await loadDetailedSales();
    };

    const loadDailyStats = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT strftime('%d/%m', date) as label, SUM(total) as amount
                FROM Sales WHERE status != 'voided'
                GROUP BY label ORDER BY date DESC LIMIT 7
            `);
            setDailyStats((res.values || []).reverse());
        } catch (e) { console.error(e); }
    };

    const loadTopProducts = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT p.name, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
                FROM SaleItems si
                JOIN Products p ON si.product_id = p.id
                JOIN Sales s ON si.sale_id = s.id
                WHERE s.status != 'voided' AND s.date BETWEEN ? AND ?
                GROUP BY p.id ORDER BY total_qty DESC LIMIT 5
            `, [startDate, endDate]);
            setTopProducts(res.values || []);
        } catch (e) { console.error(e); }
    };

    const loadSalesReport = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT strftime('%Y-%m-%d', date) as day, COUNT(*) as total_sales, SUM(total) as revenue
                FROM Sales WHERE status != 'voided' AND date BETWEEN ? AND ?
                GROUP BY day ORDER BY day DESC
            `, [startDate, endDate]);
            setSalesReport(res.values || []);
        } catch (error) { console.error(error); }
    };

    const loadDetailedSales = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT s.*, c.name as client_name
                FROM Sales s
                LEFT JOIN Clients c ON s.client_id = c.id
                WHERE s.date BETWEEN ? AND ?
                ORDER BY s.date DESC
            `, [startDate, endDate]);
            setDetailedSales(res.values || []);
        } catch (e) { console.error(e); }
    };

    const loadCreditsReport = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query(`
                SELECT c.name as client_name, p.name as product_name, si.quantity, si.price, si.subtotal, s.date, s.id as sale_id
                FROM Clients c
                JOIN Sales s ON c.id = s.client_id
                JOIN SaleItems si ON s.id = si.sale_id
                JOIN Products p ON si.product_id = p.id
                WHERE s.type = 'credit' AND s.status != 'voided'
                ORDER BY c.name, s.date DESC
            `);
            setCreditsReport(res.values || []);
        } catch (error) { console.error(error); }
    };

    useIonViewWillEnter(() => {
        loadAllData();
    });

    const exportSalesPdf = () => {
        if (detailedSales.length === 0) {
            present({ message: 'No hay datos para exportar en este rango', duration: 2000, color: 'warning' });
            return;
        }
        const totalSum = detailedSales.reduce((acc, s) => acc + (s.status !== 'voided' ? s.total : 0), 0);
        const period = `${new Date(startDate).toLocaleDateString()} al ${new Date(endDate).toLocaleDateString()}`;

        const html = getSalesReportHtml(detailedSales, period, detailedSales.length, totalSum);
        setPreviewHtml(html);
        setPreviewFileName(`Reporte_Ventas_${period.replace(/ /g, '_')}`);
        setPreviewModal(true);
    };

    const maxDailyAmount = Math.max(...dailyStats.map(d => d.amount), 1);

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Informes y Estadísticas</IonTitle>
                    <IonButton slot="end" fill="clear" onClick={() => setShowFilterModal(true)}>
                        <Filter size={20} color="var(--ion-color-primary)" />
                    </IonButton>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">

                <div className="glass-panel" style={{ marginBottom: '20px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Periodo filtrado:</div>
                        <div style={{ fontWeight: 'bold' }}>{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</div>
                    </div>
                    <IonButton size="small" fill="outline" onClick={() => setShowFilterModal(true)}>Cambiar</IonButton>
                </div>

                {/* GRÁFICA DE VENTAS RECIENTES */}
                <div className="card-title"><TrendingUp size={20} style={{marginRight: '8px'}} /> Ventas (Últimos 7 días)</div>
                <div className="glass-panel" style={{ marginBottom: '24px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '150px', gap: '8px' }}>
                        {dailyStats.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                <div style={{
                                    width: '100%',
                                    background: 'linear-gradient(to top, var(--ion-color-primary), var(--ion-color-secondary))',
                                    height: `${(d.amount / maxDailyAmount) * 100}%`,
                                    borderRadius: '6px 6px 0 0',
                                    minHeight: '4px',
                                    transition: 'height 0.5s ease'
                                }}></div>
                                <div style={{ fontSize: '0.7rem', marginTop: '8px', color: 'var(--text-muted)' }}>{d.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* TOP 5 PRODUCTOS */}
                <div className="card-title"><Trophy size={20} style={{marginRight: '8px', color: 'var(--ion-color-warning)'}} /> Los 5 más Vendidos</div>
                <div className="glass-panel" style={{ marginBottom: '24px' }}>
                    {topProducts.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No hay datos suficientes</p>
                    ) : (
                        <div>
                            {topProducts.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--dark-surface-hover)' : 'none' }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: i === 0 ? 'var(--ion-color-warning)' : 'var(--dark-surface-hover)',
                                        color: i === 0 ? 'black' : 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem'
                                    }}>{i + 1}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.total_qty} {p.unit_type || 'unid.'}</div>
                                    </div>
                                    <div className="gradient-text" style={{ fontWeight: 'bold' }}>${p.total_revenue.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card-title"><ShoppingBag size={20} style={{marginRight: '8px'}} /> Resumen Diario</div>
                <div className="glass-panel" style={{ marginBottom: '24px' }}>
                    {salesReport.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No hay ventas en este rango</p>
                    ) : (
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            {salesReport.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{r.day}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.total_sales} ventas</div>
                                    </div>
                                    <div className="gradient-text" style={{ fontWeight: 'bold', alignSelf: 'center' }}>${r.revenue.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card-title"><Users size={20} style={{marginRight: '8px'}} /> Créditos Pendientes</div>
                <div className="glass-panel" style={{ marginBottom: '24px' }}>
                    {creditsReport.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No hay créditos pendientes</p>
                    ) : (
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {creditsReport.map((r, i) => (
                                <div key={i} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--ion-color-secondary)' }}>{r.client_name}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(r.date).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '4px' }}>
                                        <span>{r.product_name} (x{r.quantity})</span>
                                        <span>${r.subtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card-title"><FileText size={20} style={{marginRight: '8px'}} /> Exportar Reportes</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
                    <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }} onClick={exportSalesPdf}>
                        <Download size={24} color="var(--ion-color-primary)" style={{ marginBottom: '8px' }} />
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Ventas del Periodo</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }} onClick={() => {
                         if (creditsReport.length > 0) {
                            const firstClient = creditsReport[0];
                            const balance = creditsReport.reduce((a, b) => a + b.subtotal, 0);
                            const history = creditsReport.map((c: any) => ({
                                date: c.date, notes: `${c.product_name} (x${c.quantity})`, amount: c.subtotal
                            }));

                            const html = getCreditReportHtml({ name: firstClient.client_name, identification: '' }, history, balance);
                            setPreviewHtml(html);
                            setPreviewFileName(`Estado_Cuenta_${firstClient.client_name.replace(/ /g, '_')}`);
                            setPreviewModal(true);
                        } else {
                            present({ message: 'No hay créditos para reportar', duration: 2000 });
                        }
                    }}>
                        <Download size={24} color="var(--ion-color-secondary)" style={{ marginBottom: '8px' }} />
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Estado de Cuenta</div>
                    </div>
                </div>

                {/* MODAL DE FILTROS */}
                <IonModal isOpen={showFilterModal} onDidDismiss={() => setShowFilterModal(false)} breakpoints={[0, 0.7]} initialBreakpoint={0.7}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <h3 style={{ fontWeight: 800, marginBottom: '20px' }}>Filtrar por Fecha</h3>

                        <div className="glass-panel" style={{ marginBottom: '16px' }}>
                            <IonLabel style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Desde:</IonLabel>
                            <IonDatetime presentation="date" value={startDate} onIonChange={e => setStartDate(e.detail.value as string)} style={{ borderRadius: '12px', marginTop: '8px' }} />
                        </div>

                        <div className="glass-panel" style={{ marginBottom: '24px' }}>
                            <IonLabel style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hasta:</IonLabel>
                            <IonDatetime presentation="date" value={endDate} onIonChange={e => setEndDate(e.detail.value as string)} style={{ borderRadius: '12px', marginTop: '8px' }} />
                        </div>

                        <IonButton expand="block" className="beautiful-btn" onClick={() => {
                            loadAllData();
                            setShowFilterModal(false);
                        }}>Aplicar Filtros</IonButton>
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

export default Reports;
