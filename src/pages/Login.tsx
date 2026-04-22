import React, { useState } from 'react';
import { IonPage, IonContent, IonInput, IonButton, IonIcon, IonText, useIonToast, IonModal, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { LogIn, ShoppingBag, UserPlus, Key, X, User } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';

const Login: React.FC = () => {
    const [view, setView] = useState<'login' | 'register' | 'changePassword'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const history = useHistory();
    const [present] = useIonToast();

    const handleLogin = async () => {
        if (!username || !password) {
            present({ message: 'Ingrese usuario y contraseña', duration: 2000, color: 'warning' });
            return;
        }
        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password]);
            
            if (res.values && res.values.length > 0) {
                const user = res.values[0];
                localStorage.setItem('user', JSON.stringify(user));
                history.push('/app/dashboard');
            } else {
                present({ message: 'Usuario o contraseña incorrectos', duration: 2000, color: 'danger' });
            }
        } catch (error) {
            console.error(error);
            present({ message: 'Error al iniciar sesión', duration: 2000, color: 'danger' });
        }
    };

    const handleRegister = async () => {
        if (!username || !password || !name) {
            present({ message: 'Complete todos los campos', duration: 2000, color: 'warning' });
            return;
        }
        try {
            const db = sqliteService.getDb();
            await db.run(
                'INSERT INTO Users (username, name, password, role) VALUES (?, ?, ?, ?)',
                [username, name, password, 'admin']
            );
            present({ message: 'Usuario registrado con éxito', duration: 2000, color: 'success' });
            setView('login');
        } catch (error: any) {
            if (error?.message?.includes('UNIQUE')) {
                present({ message: 'El nombre de usuario ya existe', duration: 2000, color: 'danger' });
            } else {
                present({ message: 'Error al registrar usuario', duration: 2000, color: 'danger' });
            }
        }
    };

    const handleChangePassword = async () => {
        if (!username || !password || !newPassword) {
            present({ message: 'Complete todos los campos', duration: 2000, color: 'warning' });
            return;
        }
        if (newPassword !== confirmPassword) {
            present({ message: 'Las contraseñas no coinciden', duration: 2000, color: 'warning' });
            return;
        }

        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password]);

            if (res.values && res.values.length > 0) {
                await db.run('UPDATE Users SET password = ? WHERE username = ?', [newPassword, username]);
                present({ message: 'Contraseña actualizada correctamente', duration: 2000, color: 'success' });
                setView('login');
            } else {
                present({ message: 'Usuario o contraseña actual incorrectos', duration: 2000, color: 'danger' });
            }
        } catch (error) {
            present({ message: 'Error al cambiar contraseña', duration: 2000, color: 'danger' });
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
                            <p className="card-subtitle" style={{ marginBottom: '32px' }}>
                                {view === 'login' && 'Iniciar Sesión'}
                                {view === 'register' && 'Nuevo Usuario'}
                                {view === 'changePassword' && 'Cambiar Contraseña'}
                            </p>
                        </IonText>

                        <div style={{ textAlign: 'left' }}>
                            {view === 'register' && (
                                <IonInput
                                    label="Nombre Completo"
                                    labelPlacement="stacked"
                                    placeholder="Nombre completo"
                                    value={name}
                                    onIonChange={e => setName(e.detail.value!)}
                                    className="custom-input"
                                />
                            )}

                            <IonInput
                                label="Usuario"
                                labelPlacement="stacked"
                                placeholder="Nombre de usuario"
                                value={username}
                                onIonChange={e => setUsername(e.detail.value!)}
                                className="custom-input"
                            />

                            <IonInput
                                type="password" 
                                label={view === 'changePassword' ? "Contraseña Actual" : "Contraseña"}
                                labelPlacement="stacked"
                                placeholder="********"
                                value={password}
                                onIonChange={e => setPassword(e.detail.value!)}
                                className="custom-input"
                            />

                            {view === 'changePassword' && (
                                <>
                                    <IonInput
                                        type="password"
                                        label="Nueva Contraseña"
                                        labelPlacement="stacked"
                                        placeholder="********"
                                        value={newPassword}
                                        onIonChange={e => setNewPassword(e.detail.value!)}
                                        className="custom-input"
                                    />
                                    <IonInput
                                        type="password"
                                        label="Confirmar Nueva Contraseña"
                                        labelPlacement="stacked"
                                        placeholder="********"
                                        value={confirmPassword}
                                        onIonChange={e => setConfirmPassword(e.detail.value!)}
                                        className="custom-input"
                                    />
                                </>
                            )}

                            {view === 'login' && (
                                <IonButton expand="block" className="beautiful-btn" onClick={handleLogin}>
                                    <LogIn style={{ marginRight: '8px' }} size={20} /> Ingresar
                                </IonButton>
                            )}

                            {view === 'register' && (
                                <IonButton expand="block" className="beautiful-btn" onClick={handleRegister}>
                                    <UserPlus style={{ marginRight: '8px' }} size={20} /> Registrarse
                                </IonButton>
                            )}

                            {view === 'changePassword' && (
                                <IonButton expand="block" className="beautiful-btn" onClick={handleChangePassword}>
                                    <Key style={{ marginRight: '8px' }} size={20} /> Actualizar Contraseña
                                </IonButton>
                            )}

                            <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {view === 'login' ? (
                                    <>
                                        <IonButton fill="clear" size="small" onClick={() => setView('register')}>
                                            <UserPlus size={16} style={{ marginRight: '8px' }} /> Crear cuenta nueva
                                        </IonButton>
                                        <IonButton fill="clear" size="small" onClick={() => setView('changePassword')}>
                                            <Key size={16} style={{ marginRight: '8px' }} /> Cambiar contraseña
                                        </IonButton>
                                    </>
                                ) : (
                                    <IonButton fill="clear" size="small" onClick={() => setView('login')}>
                                        <X size={16} style={{ marginRight: '8px' }} /> Volver al Login
                                    </IonButton>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;
