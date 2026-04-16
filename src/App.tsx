import { IonApp, IonRouterOutlet, setupIonicReact, IonSpinner, IonText } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { sqliteService } from './database/sqlite.service';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';
import './theme/custom.css';

import Tabs from './components/Tabs';
import Login from './pages/Login';

setupIonicReact();

const App: React.FC = () => {
    const [dbReady, setDbReady] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    useEffect(() => {
        const initDb = async () => {
            try {
                await sqliteService.initDatabase();
                setDbReady(true);
            } catch (err: any) {
                console.error(err);
                setDbError(err.message || 'Error initializing database');
            }
        };
        initDb();
    }, []);

    if (dbError) {
        return (
            <IonApp>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center' }}>
                    <IonText color="danger">
                        <h2>Database Error</h2>
                    </IonText>
                    <p>{dbError}</p>
                </div>
            </IonApp>
        );
    }

    if (!dbReady) {
        return (
            <IonApp>
                <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <IonSpinner name="crescent" color="primary" />
                    <p style={{ marginTop: '20px', color: 'var(--ion-color-medium)' }}>Inicializando sistema...</p>
                </div>
            </IonApp>
        );
    }

    return (
        <IonApp>
            <IonReactRouter>
                <IonRouterOutlet>
                    <Route path="/login" component={Login} exact />
                    <Route path="/app" component={Tabs} />
                    <Route exact path="/">
                        <Redirect to="/login" />
                    </Route>
                </IonRouterOutlet>
            </IonReactRouter>
        </IonApp>
    );
};

export default App;
