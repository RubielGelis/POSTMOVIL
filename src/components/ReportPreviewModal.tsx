import React from 'react';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/react';
import { Share2, X } from 'lucide-react';
import { saveAndShareHtml } from '../services/pdf.service';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    html: string;
    fileName: string;
}

const ReportPreviewModal: React.FC<Props> = ({ isOpen, onClose, html, fileName }) => {

    const handleShare = async () => {
        await saveAndShareHtml(html, fileName);
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            <IonHeader className="ion-no-border">
                <IonToolbar style={{ '--background': 'var(--dark-bg)' }}>
                    <IonTitle style={{ fontWeight: 'bold' }}>Vista Previa</IonTitle>
                    <IonButtons slot="start">
                        <IonButton onClick={onClose}>
                            <X size={24} />
                        </IonButton>
                    </IonButtons>
                    <IonButtons slot="end">
                        <IonButton color="primary" onClick={handleShare}>
                            <Share2 size={20} style={{ marginRight: '8px' }} /> Compartir
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" style={{ '--background': 'white' }}>
                <div
                    style={{
                        background: 'white',
                        color: 'black',
                        minHeight: '100%',
                        padding: '10px'
                    }}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </IonContent>
        </IonModal>
    );
};

export default ReportPreviewModal;
