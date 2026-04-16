import React, { useState } from 'react';
import { IonPage, IonContent, IonInput, IonButton, IonIcon, IonText, useIonToast } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { LogIn, ShoppingBag } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';

const Login: React.FC = () => {
    const [pin, setPin] = useState('');
    const history = useHistory();
    const [present] = useIonToast();

    const handleLogin = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT * FROM Users WHERE pin = ?', [pin]);
            
            if (res.values && res.values.length > 0) {
                // Store user info in localStorage/preferences logic here
                history.push('/app/dashboard');
            } else {
                present({
                    message: 'PIN incorrecto',
                    duration: 2000,
                    color: 'danger'
                });
            }
        } catch (error) {
            console.error(error);
            present({
                message: 'Error al iniciar sesión',
                duration: 2000,
                color: 'danger'
            });
        }
    };

    return (
        <IonPage>
            <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                        
                        <div style={{ padding: '20px', background: 'var(--primary-gradient)', borderRadius: '50%', width: '80px', height: '80px', margin: '0 auto 20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingBag color="white" size={40} />
                        </div>
                        
                        <IonText>
                            <h1 className="gradient-text" style={{ fontWeight: 'bold', marginBottom: '8px' }}>POSTMOVIL</h1>
                            <p className="card-subtitle" style={{ marginBottom: '32px' }}>Gestión de Inventario y Ventas</p>
                        </IonText>

                        <div style={{ textAlign: 'left' }}>
                            <IonInput 
                                type="password" 
                                placeholder="Ingrese su PIN (ej. 1234)" 
                                value={pin}
                                onIonChange={e => setPin(e.detail.value!)}
                                style={{
                                    '--padding-start': '16px',
                                    '--padding-end': '16px',
                                    '--padding-top': '16px',
                                    '--padding-bottom': '16px',
                                }}
                            />

                            <IonButton 
                                expand="block" 
                                className="beautiful-btn" 
                                onClick={handleLogin}
                            >
                                <LogIn style={{ marginRight: '8px' }} size={20} />
                                Ingresar
                            </IonButton>
                        </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;
