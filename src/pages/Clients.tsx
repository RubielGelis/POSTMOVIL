import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon, IonFab, IonFabButton, IonModal, IonInput, useIonToast } from '@ionic/react';
import { Users, Plus, X, DollarSign, ListOrdered } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';

const Clients: React.FC = () => {
    const [clients, setClients] = useState<any[]>([]);
    const [clientModal, setClientModal] = useState(false);
    const [paymentModal, setPaymentModal] = useState(false);
    
    // New Client State
    const [name, setName] = useState('');
    const [identification, setIdentification] = useState('');
    const [contact, setContact] = useState('');

    // Payment State
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const [present] = useIonToast();

    const loadClients = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT * FROM vw_client_balances ORDER BY client_name ASC');
            setClients(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    const saveClient = async () => {
        if (!name || !identification) {
            present({ message: 'Nombre e identificación requeridos', duration: 2000, color: 'warning' });
            return;
        }
        try {
            const db = sqliteService.getDb();
            await db.run('INSERT INTO Clients (name, identification, contact) VALUES (?, ?, ?)', [name, identification, contact]);
            present({ message: 'Cliente guardado', duration: 2000, color: 'success' });
            setClientModal(false);
            setName(''); setIdentification(''); setContact('');
            loadClients();
        } catch (e) {
            present({ message: 'Error guardando cliente', duration: 2000, color: 'danger' });
        }
    };

    const registerPayment = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            present({ message: 'Ingrese un monto válido', duration: 2000, color: 'warning' });
            return;
        }
        try {
            const db = sqliteService.getDb();
            const date = new Date().toISOString();
            await db.run('INSERT INTO Payments (client_id, amount, date) VALUES (?, ?, ?)', [selectedClient.client_id, parseFloat(paymentAmount), date]);
            present({ message: 'Abono registrado con éxito', duration: 2000, color: 'success' });
            setPaymentModal(false);
            setPaymentAmount('');
            loadClients();
        } catch (e) {
            present({ message: 'Error procesando abono', duration: 2000, color: 'danger' });
        }
    };

    const openPaymentModal = (client: any) => {
        setSelectedClient(client);
        setPaymentModal(true);
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Crédito a Clientes</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">
                
                {clients.length === 0 ? (
                    <div style={{ textAlign: 'center', margin: '40px 0', color: 'var(--text-muted)' }}>
                        <Users size={48} opacity={0.3} style={{ marginBottom: '16px' }} />
                        <p>No hay clientes registrados</p>
                    </div>
                ) : (
                    <div>
                        {clients.map(c => (
                            <div key={c.client_id} className="glass-panel" style={{ marginBottom: '16px', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{c.client_name}</div>
                                        <div className="card-subtitle">Saldo Pendiente</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: c.balance_due > 0 ? 'var(--ion-color-danger)' : 'var(--ion-color-success)' }}>
                                            ${c.balance_due.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <IonButton expand="block" size="small" className="beautiful-btn" style={{ flex: 1, margin: 0 }} onClick={() => openPaymentModal(c)} disabled={c.balance_due <= 0}>
                                        <DollarSign size={16} style={{ marginRight: '4px' }} /> Abonar
                                    </IonButton>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: '80px', right: '20px' }}>
                    <IonFabButton onClick={() => setClientModal(true)} style={{ '--background': 'var(--secondary-gradient)' }}>
                        <Plus />
                    </IonFabButton>
                </IonFab>

                {/* MODAL NUEVO CLIENTE */}
                <IonModal isOpen={clientModal} onDidDismiss={() => setClientModal(false)} breakpoints={[0, 0.8]} initialBreakpoint={0.8}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }} className="gradient-text">Nuevo Cliente</h2>
                            <IonButton fill="clear" onClick={() => setClientModal(false)}><X color="var(--text-muted)" /></IonButton>
                        </div>
                        
                        <IonInput label="Nombre o Razón Social" labelPlacement="stacked" value={name} onIonChange={e => setName(e.detail.value!)} />
                        <IonInput label="Identificación (Cédula/NIT)" labelPlacement="stacked" value={identification} onIonChange={e => setIdentification(e.detail.value!)} />
                        <IonInput label="Teléfono / Email" labelPlacement="stacked" value={contact} onIonChange={e => setContact(e.detail.value!)} />

                        <IonButton expand="block" className="beautiful-btn" onClick={saveClient} style={{ marginTop: '24px' }}>
                            Registrar Cliente
                        </IonButton>
                    </IonContent>
                </IonModal>

                {/* MODAL ABONO */}
                <IonModal isOpen={paymentModal} onDidDismiss={() => setPaymentModal(false)} breakpoints={[0, 0.6]} initialBreakpoint={0.6}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }}>Registrar Abono</h2>
                            <IonButton fill="clear" onClick={() => setPaymentModal(false)}><X color="var(--text-muted)" /></IonButton>
                        </div>

                        <div className="glass-panel" style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <div className="card-subtitle">Cliente</div>
                            <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{selectedClient?.client_name}</div>
                            <div className="card-subtitle" style={{ marginTop: '12px' }}>Saldo Actual</div>
                            <div className="gradient-text" style={{ fontWeight: 800, fontSize: '1.5rem' }}>${selectedClient?.balance_due?.toFixed(2)}</div>
                        </div>
                        
                        <IonInput type="number" label="Monto a abonar ($)" labelPlacement="stacked" value={paymentAmount} onIonChange={e => setPaymentAmount(e.detail.value!)} />

                        <IonButton expand="block" className="beautiful-btn" onClick={registerPayment} style={{ marginTop: '24px' }}>
                            Guardar Pago
                        </IonButton>
                    </IonContent>
                </IonModal>
                
            </IonContent>
        </IonPage>
    );
};

export default Clients;
