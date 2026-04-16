import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonButton, useIonToast, useIonLoading } from '@ionic/react';
import { UploadCloud, DownloadCloud, Database, ShieldCheck, Mail } from 'lucide-react';
import { sqliteService } from '../database/sqlite.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const SettingsPage: React.FC = () => {
    const [present, dismiss] = useIonToast();
    const [presentLoading, dismissLoading] = useIonLoading();

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
        // En una app real de Capacitor podemos usar FilePicker para seleccionar el JSON
        // Para mock, solo mostramos el Toast de que se requiere selección
        present({ 
            message: 'Función de restauración requerirá acceso a archivos nativos. Seleccione el archivo JSON desde su Drive o Correo.', 
            duration: 4000, 
            color: 'primary' 
        });
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

                <div className="card-title" style={{ marginBottom: '16px' }}>Información del Sistema</div>
                <IonList style={{ background: 'transparent' }}>
                    <IonItem className="glass-panel" style={{ marginBottom: '8px', '--padding-start': '16px' }}>
                        <div slot="start">
                            <ShieldCheck color="var(--ion-color-success)" />
                        </div>
                        <IonLabel>
                            <h2>Base de datos SQLite</h2>
                            <p>En funcionamiento local</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem className="glass-panel" style={{ '--padding-start': '16px' }}>
                        <div slot="start">
                            <Database color="var(--ion-color-tertiary)" />
                        </div>
                        <IonLabel>
                            <h2>Versión offline</h2>
                            <p>No requiere internet</p>
                        </IonLabel>
                    </IonItem>
                </IonList>

            </IonContent>
        </IonPage>
    );
};

export default SettingsPage;
