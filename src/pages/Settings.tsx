import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonButton, useIonToast, useIonLoading, IonAlert, IonModal, IonInput, IonSelect, IonSelectOption, useIonViewWillEnter, useIonAlert } from '@ionic/react';
import { UploadCloud, DownloadCloud, Database, ShieldCheck, LogOut, UserPlus, Users, Trash2 } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useHistory } from 'react-router-dom';

const SettingsPage: React.FC = () => {
    const [present, dismiss] = useIonToast();
    const [presentLoading, dismissLoading] = useIonLoading();
    const [presentAlert] = useIonAlert();
    const [showLogoutAlert, setShowLogoutAlert] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'admin' });
    const history = useHistory();

    const loadUsers = async () => {
        try {
            const db = sqliteService.getDb();
            const res = await db.query('SELECT id, username, name, role FROM Users');
            setUsers(res.values || []);
        } catch (error) {
            console.error(error);
        }
    };

    useIonViewWillEnter(() => {
        loadUsers();
    });

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.name || !newUser.password) {
            present({ message: 'Por favor rellene todos los campos', duration: 2000, color: 'warning' });
            return;
        }

        try {
            const db = sqliteService.getDb();
            await db.run(
                'INSERT INTO Users (username, name, password, role) VALUES (?, ?, ?, ?)',
                [newUser.username, newUser.name, newUser.password, newUser.role]
            );
            present({ message: 'Usuario creado correctamente', duration: 2000, color: 'success' });
            setShowUserModal(false);
            setNewUser({ username: '', name: '', password: '', role: 'admin' });
            loadUsers();
        } catch (error: any) {
            console.error(error);
            present({ message: 'Error al crear usuario (posiblemente el nombre de usuario ya existe)', duration: 3000, color: 'danger' });
        }
    };

    const deleteUser = async (id: number) => {
        // Prevent deleting current user or main admin if necessary
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (id === currentUser.id) {
            present({ message: 'No puede eliminarse a sí mismo', duration: 2000, color: 'warning' });
            return;
        }

        try {
            const db = sqliteService.getDb();
            await db.run('DELETE FROM Users WHERE id = ?', [id]);
            present({ message: 'Usuario eliminado', duration: 2000, color: 'success' });
            loadUsers();
        } catch (error) {
            console.error(error);
            present({ message: 'Error al eliminar usuario', duration: 2000, color: 'danger' });
        }
    };

    const handleBackup = async () => {
        try {
            await presentLoading({ message: 'Generando respaldo...' });
            const db = sqliteService.getDb();
            // Export DB to JSON
            const exportData = await db.exportToJson('full');
            
            const fileName = `postmovil_backup_${new Date().toISOString().replace(/[:.]/g, '')}.json`;
            const fileData = JSON.stringify(exportData.export);

            // Save to device temporary directory before sharing
            const fileResult = await Filesystem.writeFile({
                path: fileName,
                data: fileData,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });

            await dismissLoading();
            
            // Share via native intent (Drive, Email, etc.)
            await Share.share({
                title: 'Respaldo POSTMOVIL',
                text: 'Adjunto el respaldo de base de datos generado por POSTMOVIL',
                url: fileResult.uri,
                dialogTitle: 'Respaldar a Nube / Correo'
            });

            present({ message: 'Respaldo generado correctamente.', duration: 3000, color: 'success' });
        } catch (error: any) {
            await dismissLoading();
            console.error(error);
            present({ message: `Error al respaldar: ${error.message}`, duration: 4000, color: 'danger' });
        }
    };

    const handleRestore = async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';

            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (!file) return;

                await presentLoading({ message: 'Procesando archivo...' });

                try {
                    // Usamos FileReader de la forma más compatible
                    const reader = new FileReader();

                    reader.onload = async (event: any) => {
                        try {
                            const content = event.target.result as string;
                            if (!content) throw new Error('Archivo vacío');

                            let jsonData = JSON.parse(content);
                            const db = sqliteService.getDb();

                            console.log('JSON Cargado:', jsonData);

                            let exportObject = jsonData.export ? jsonData.export : jsonData;

                            // Doble parseo de seguridad
                            if (typeof exportObject === 'string') {
                                exportObject = JSON.parse(exportObject);
                            }

                            if (!exportObject.tables || !Array.isArray(exportObject.tables)) {
                                throw new Error('El archivo no contiene una lista de tablas válida.');
                            }

                            await dismissLoading();
                            await presentLoading({ message: 'Escribiendo en base de datos...' });

                            const importData = {
                                database: 'postmovildb',
                                version: 1,
                                overwrite: true,
                                encrypted: false,
                                mode: 'full',
                                tables: exportObject.tables
                            };

                            console.log('Enviando a SQLite:', importData);

                            // Cambiamos db.importFromJson por sqliteService.importFromJson
                            const result = await sqliteService.importFromJson(importData);

                            console.log('Resultado importación:', result);

                            await dismissLoading();

                            present({ message: '¡Restauración exitosa! Reiniciando...', duration: 2500, color: 'success' });

                            setTimeout(() => {
                                window.location.href = '/login';
                            }, 2000);
                        } catch (err: any) {
                            await dismissLoading();
                            console.error('Error en restauración:', err);
                            present({ message: `Error: ${err.message || 'Archivo no válido'}`, duration: 4000, color: 'danger' });
                        }
                    };

                    reader.onerror = () => {
                        dismissLoading();
                        // Este es el error típico de Drive en Android
                        presentAlert({
                            header: 'Acceso Denegado',
                            subHeader: 'Restricción de Android',
                            message: 'Por seguridad, Android no permite leer archivos directamente desde la nube de Drive. \n\nPASOS:\n1. Ve a Drive y dale a "Descargar" al archivo.\n2. Vuelve aquí y selecciónalo desde la carpeta "Descargas" de tu teléfono.',
                            buttons: ['Entendido']
                        });
                    };

                    reader.readAsText(file);
                } catch (err) {
                    await dismissLoading();
                    present({ message: 'No se pudo abrir el archivo.', duration: 3000, color: 'danger' });
                }
            };

            input.click();
        } catch (error: any) {
            present({ message: 'Error al iniciar el selector.', duration: 3000, color: 'danger' });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        history.replace('/login');
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'transparent' }}>
                    <IonTitle style={{ fontWeight: 800 }}>Ajustes y Respaldo</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding page-container">
                
                <div className="card-title" style={{ marginBottom: '16px', marginTop: '10px' }}>Respaldo a la Nube / Correo</div>
                <div className="glass-panel" style={{ marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                        Al generar el respaldo, podrá guardarlo automáticamente en Google Drive, iCloud, o enviarlo por correo electrónico usando su cuenta del dispositivo.
                    </p>

                    <IonButton expand="block" className="beautiful-btn" onClick={handleBackup} style={{ marginBottom: '16px' }}>
                        <UploadCloud size={20} style={{ marginRight: '8px' }} />
                        Respaldar Datos
                    </IonButton>

                    <IonButton expand="block" fill="outline" onClick={handleRestore} style={{ '--border-color': 'var(--ion-color-secondary)', '--color': 'var(--text-light)', '--border-radius': 'var(--radius-md)' }}>
                        <DownloadCloud size={20} style={{ marginRight: '8px', color: 'var(--ion-color-secondary)' }} />
                        Restaurar Copia
                    </IonButton>
                </div>

                <div className="card-title" style={{ marginBottom: '16px' }}>Gestión de Usuarios</div>
                <div className="glass-panel" style={{ marginBottom: '24px', padding: '16px' }}>
                    <IonButton expand="block" fill="outline" onClick={() => setShowUserModal(true)} style={{ marginBottom: '16px', '--border-color': 'var(--ion-color-tertiary)', '--color': 'var(--text-light)', '--border-radius': 'var(--radius-md)' }}>
                        <UserPlus size={20} style={{ marginRight: '8px', color: 'var(--ion-color-tertiary)' }} />
                        Nuevo Usuario
                    </IonButton>

                    <IonList style={{ background: 'transparent' }}>
                        {users.map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--dark-surface-hover)' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username} | Rol: {u.role}</div>
                                </div>
                                <IonButton fill="clear" color="danger" onClick={() => deleteUser(u.id)}>
                                    <Trash2 size={18} />
                                </IonButton>
                            </div>
                        ))}
                    </IonList>
                </div>

                <div className="card-title" style={{ marginBottom: '16px' }}>Sesión y Sistema</div>
                <div className="glass-panel" style={{ padding: '0', marginBottom: '24px' }}>
                    <IonItem lines="none" className="glass-panel" style={{ '--padding-start': '16px', background: 'transparent' }}>
                        <div slot="start">
                            <ShieldCheck color="var(--ion-color-success)" />
                        </div>
                        <IonLabel>
                            <h2>Base de datos SQLite</h2>
                            <p>En funcionamiento local</p>
                        </IonLabel>
                    </IonItem>

                    <div style={{ padding: '16px', borderTop: '1px solid var(--dark-surface-hover)' }}>
                        <IonButton expand="block" color="danger" fill="clear" onClick={() => setShowLogoutAlert(true)}>
                            <LogOut size={20} style={{ marginRight: '8px' }} />
                            Cerrar Sesión
                        </IonButton>
                    </div>
                </div>

                <IonAlert
                    isOpen={showLogoutAlert}
                    onDidDismiss={() => setShowLogoutAlert(false)}
                    header="Cerrar Sesión"
                    message="¿Está seguro que desea salir de la aplicación?"
                    buttons={[
                        { text: 'Cancelar', role: 'cancel' },
                        { text: 'Salir', role: 'confirm', handler: handleLogout }
                    ]}
                />

                <IonModal isOpen={showUserModal} onDidDismiss={() => setShowUserModal(false)} breakpoints={[0, 0.7]} initialBreakpoint={0.7}>
                    <IonContent className="ion-padding" style={{ '--background': 'var(--dark-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontWeight: 'bold' }}>Nuevo Usuario</h2>
                            <IonButton fill="clear" onClick={() => setShowUserModal(false)}>Cerrar</IonButton>
                        </div>

                        <div className="glass-panel">
                            <IonItem className="glass-panel" style={{ marginBottom: '12px' }}>
                                <IonLabel position="stacked">Nombre Completo</IonLabel>
                                <IonInput value={newUser.name} onIonInput={e => setNewUser({...newUser, name: e.detail.value!})} placeholder="Ej: Juan Pérez" />
                            </IonItem>

                            <IonItem className="glass-panel" style={{ marginBottom: '12px' }}>
                                <IonLabel position="stacked">Nombre de Usuario</IonLabel>
                                <IonInput value={newUser.username} onIonInput={e => setNewUser({...newUser, username: e.detail.value!})} placeholder="juanp" />
                            </IonItem>

                            <IonItem className="glass-panel" style={{ marginBottom: '12px' }}>
                                <IonLabel position="stacked">Contraseña</IonLabel>
                                <IonInput type="password" value={newUser.password} onIonInput={e => setNewUser({...newUser, password: e.detail.value!})} placeholder="****" />
                            </IonItem>

                            <IonItem className="glass-panel" style={{ marginBottom: '20px' }}>
                                <IonLabel position="stacked">Rol</IonLabel>
                                <IonSelect value={newUser.role} onIonChange={e => setNewUser({...newUser, role: e.detail.value!})}>
                                    <IonSelectOption value="admin">Administrador</IonSelectOption>
                                    <IonSelectOption value="vendor">Vendedor</IonSelectOption>
                                </IonSelect>
                            </IonItem>

                            <IonButton expand="block" className="beautiful-btn" onClick={handleCreateUser}>
                                Crear Usuario
                            </IonButton>
                        </div>
                    </IonContent>
                </IonModal>
            </IonContent>
        </IonPage>
    );
};

export default SettingsPage;
