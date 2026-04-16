import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonDatetime, IonModal, IonLabel, IonItem, useIonViewWillEnter, IonList } from '@ionic/react';
import { FileText, Calendar, Download, TrendingUp, Users, Package } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { generateCreditReport } from '../services/pdf.service';

const Reports: React.FC = () => {
    const [salesReport, setSalesReport] = useState<any[]>([]);
    const [creditsReport, setCreditsReport] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [showDateModal, setShowDateModal] = useState(false);

    const loadCreditsReport = async () => {
        try {
            const db = sqliteService.getDb();
            // Informe detallado de créditos por cliente y producto
            const res = await db.query(`
                SELECT
                    c.name as client_name,
                    p.name as product_name,
                    si.quantity,
                    si.price,
                    si.subtotal,
                    s.date,
                    s.id as sale_id
                FROM Clients c
                JOIN Sales s ON c.id = s.client_id
                JOIN SaleItems si ON s.id = si.sale_id
                JOIN Products p ON si.product_id = p.id
                WHERE s.type = 'credit'
                ORDER BY c.name, s.date DESC
            `);
            setCreditsReport(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    const loadSalesReport = async (start?: string, end?: string) => {
        try {
            const db = sqliteService.getDb();
            let query = `
                SELECT
                    strftime('%Y-%m-%d', date) as day,
                    COUNT(*) as total_sales,
                    SUM(total) as revenue
                FROM Sales
            `;
            const params: any[] = [];

            if (start && end) {
                query += ` WHERE date BETWEEN ? AND ?`;
                params.push(start, end);
            }

            query += ` GROUP BY day ORDER BY day DESC`;

            const res = await db.query(query, params);
            setSalesReport(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    useIonViewWillEnter(() => {
        loadSalesReport();
        loadCreditsReport();
    });

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Informes</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">

                <div className="card-title"><TrendingUp size={20} style={{marginRight: '8px'}} /> Ventas por Periodo</div>
                <div className="glass-panel" style={{ marginBottom: '20px' }}>
                    {salesReport.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No hay datos de ventas</p>
                    ) : (
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {salesReport.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{r.day}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.total_sales} ventas</div>
                                    </div>
                                    <div className="gradient-text" style={{ fontWeight: 'bold' }}>${r.revenue.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card-title"><Users size={20} style={{marginRight: '8px'}} /> Detalle de Créditos</div>
                <div className="glass-panel" style={{ marginBottom: '20px' }}>
                    {creditsReport.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No hay créditos pendientes</p>
                    ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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

                <div className="card-title"><Package size={20} style={{marginRight: '8px'}} /> Exportar Estado de Cuenta</div>
                <div className="glass-panel">
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Genere un PDF oficial de sus informes actuales para impresión o enviar a clientes.
                    </p>
                    <IonButton expand="block" className="beautiful-btn" onClick={() => {
                        if (creditsReport.length > 0) {
                            // Dummy client to pass to report, or we just use general report for all clients
                            const firstClient = creditsReport[0];
                            const balance = creditsReport.reduce((a, b) => a + b.subtotal, 0);
                            generateCreditReport({ name: firstClient.client_name }, creditsReport.map((c: any) => ({
                                date: c.date, description: `${c.product_name} (x${c.quantity})`, type: 'Crédito', amount: c.subtotal
                            })), balance);
                        }
                    }}>
                        <Download size={20} style={{ marginRight: '8px' }} /> Generar Archivo PDF
                    </IonButton>
                </div>

            </IonContent>
        </IonPage>
    );
};

export default Reports;
