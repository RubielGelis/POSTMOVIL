import React, { useEffect, useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonRefresher, IonRefresherContent, useIonViewWillEnter } from '@ionic/react';
import { DollarSign, Search, PackageMinus, TrendingUp } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        todaySales: 0,
        lowStock: 0,
        totalProducts: 0,
        creditPending: 0
    });

    const loadStats = async () => {
        try {
            const db = sqliteService.getDb();
            const today = new Date().toISOString().split('T')[0];
            
            // Sales today
            const salesRes = await db.query(`SELECT SUM(total) as total FROM Sales WHERE date LIKE ?`, [`${today}%`]);
            const todaySales = salesRes.values?.[0]?.total || 0;

            // Low stock
            const lowStockRes = await db.query(`SELECT COUNT(*) as count FROM vw_low_stock_products`);
            const lowStock = lowStockRes.values?.[0]?.count || 0;

            // Total products
            const prodsRes = await db.query(`SELECT COUNT(*) as count FROM Products`);
            const totalProducts = prodsRes.values?.[0]?.count || 0;

            // Credit pending
            const creditRes = await db.query(`SELECT SUM(balance_due) as total FROM vw_client_balances`);
            const creditPending = creditRes.values?.[0]?.total || 0;

            setStats({ todaySales, lowStock, totalProducts, creditPending });
        } catch (error) {
            console.error('Error loading stats', error);
        }
    };

    useIonViewWillEnter(() => {
        loadStats();
    });

    useEffect(() => {
        loadStats();
    }, []);

    const handleRefresh = async (event: CustomEvent) => {
        await loadStats();
        event.detail.complete();
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Resumen</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent></IonRefresherContent>
                </IonRefresher>

                <div className="glass-panel animate-slide-up" style={{ marginBottom: '24px' }}>
                    <div className="card-subtitle">Ventas de Hoy</div>
                    <div className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, margin: '8px 0' }}>
                        ${stats.todaySales.toFixed(2)}
                    </div>
                </div>

                <div className="card-title animate-slide-up delay-1" style={{ marginBottom: '16px' }}>Métricas Generales</div>
                <div className="stats-grid animate-slide-up delay-1">
                    
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--secondary-gradient)' }}>
                            <Search size={20} />
                        </div>
                        <div className="card-subtitle">Total Productos</div>
                        <div className="stat-value">{stats.totalProducts}</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
                            <PackageMinus size={20} />
                        </div>
                        <div className="card-subtitle">Stock Bajo</div>
                        <div className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--ion-color-danger)' : 'inherit' }}>{stats.lowStock}</div>
                    </div>

                    <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginBottom: 0 }}>
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <div className="card-subtitle">Cuentas por Cobrar (Créditos)</div>
                                <div className="stat-value">${stats.creditPending.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Dashboard;
