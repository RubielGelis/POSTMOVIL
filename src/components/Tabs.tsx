import React from 'react';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { Route, Redirect } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, History, BarChart3, ScrollText } from 'lucide-react';

import Dashboard from '../pages/Dashboard';
import Inventory from '../pages/Inventory';
import POS from '../pages/POS';
import Clients from '../pages/Clients';
import SettingsPage from '../pages/Settings';
import SalesHistory from '../pages/SalesHistory';
import Reports from '../pages/Reports';

const Tabs: React.FC = () => {
    return (
        <IonTabs>
            <IonRouterOutlet>
                <Route exact path="/app/dashboard" component={Dashboard} />
                <Route exact path="/app/inventory" component={Inventory} />
                <Route exact path="/app/pos" component={POS} />
                <Route exact path="/app/sales" component={SalesHistory} />
                <Route exact path="/app/reports" component={Reports} />
                <Route exact path="/app/clients" component={Clients} />

                <Route exact path="/app/settings" component={SettingsPage} />
                <Route exact path="/app">
                    <Redirect to="/app/dashboard" />
                </Route>
            </IonRouterOutlet>

            <IonTabBar slot="bottom">
                <IonTabButton tab="dashboard" href="/app/dashboard">
                    <LayoutDashboard size={24} />
                    <IonLabel>Inicio</IonLabel>
                </IonTabButton>
                
                <IonTabButton tab="pos" href="/app/pos">
                    <ShoppingCart size={24} />
                    <IonLabel>Ventas</IonLabel>
                </IonTabButton>

                <IonTabButton tab="sales" href="/app/sales">
                    <History size={24} />
                    <IonLabel>Historial</IonLabel>
                </IonTabButton>

                <IonTabButton tab="reports" href="/app/reports">
                    <BarChart3 size={24} />
                    <IonLabel>Informes</IonLabel>
                </IonTabButton>

                <IonTabButton tab="inventory" href="/app/inventory">
                    <Package size={24} />
                    <IonLabel>Inventario</IonLabel>
                </IonTabButton>

                <IonTabButton tab="clients" href="/app/clients">
                    <Users size={24} />
                    <IonLabel>Crédito</IonLabel>
                </IonTabButton>

                <IonTabButton tab="settings" href="/app/settings">
                    <Settings size={24} />
                    <IonLabel>Ajustes</IonLabel>
                </IonTabButton>
            </IonTabBar>
        </IonTabs>
    );
};

export default Tabs;
