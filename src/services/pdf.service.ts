import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const safeNum = (val: any) => {
    const n = parseFloat(val);
    return n || 0;
};

// Función para guardar y compartir (ahora opcional)
export const saveAndShareHtml = async (htmlContent: string, fileName: string) => {
    try {
        const base64Data = btoa(unescape(encodeURIComponent(htmlContent)));
        const path = `${fileName}_${Date.now()}.html`;

        await Filesystem.writeFile({
            path,
            data: base64Data,
            directory: Directory.Cache
        });

        const { uri } = await Filesystem.getUri({
            directory: Directory.Cache,
            path
        });

        await Share.share({
            title: 'Compartir Reporte',
            url: uri
        });
    } catch (e: any) {
        console.error('Error al compartir:', e);
        alert('Error al compartir: ' + e.message);
    }
};

export const getReceiptHtml = (sale: any, items: any[], client?: any) => {
    return `
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; padding: 15px; color: #333; line-height: 1.4; background: white; }
                .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24px; }
                .info p { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { text-align: left; background: #f5f5f5; font-size: 13px; padding: 8px; }
                td { padding: 8px; border-bottom: 1px solid #eee; font-size: 14px; }
                .total-box { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; text-align: right; }
                .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>RECIBO DE VENTA</h1>
                <p>Factura: <strong>INV-${(sale?.id || 0).toString().padStart(6, '0')}</strong></p>
            </div>
            <div class="info">
                <p><strong>Fecha:</strong> ${sale?.date ? new Date(sale.date).toLocaleString() : 'N/A'}</p>
                <p><strong>Cliente:</strong> ${client?.name || 'Consumidor Final'}</p>
                <p><strong>Pago:</strong> ${sale?.notes || 'Efectivo'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.name || 'S/N'}</td>
                            <td>${safeNum(item.quantity)} x $${safeNum(item.price).toFixed(0)}</td>
                            <td>$${safeNum(item.subtotal).toFixed(0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="total-box">
                ${sale?.discount > 0 ? `<p style="font-size: 14px; margin: 0;">Descuento: -$${safeNum(sale.discount).toFixed(2)}</p>` : ''}
                <div class="total-row">
                    <span>TOTAL:</span>
                    <span>$${safeNum(sale?.total).toFixed(2)}</span>
                </div>
                ${sale?.received_amount > 0 ? `
                    <p style="font-size: 14px; color: #444; margin: 5px 0 0 0;">Recibido: $${safeNum(sale.received_amount).toFixed(2)}</p>
                    <p style="font-size: 14px; color: #2e7d32; margin: 2px 0 0 0;">Cambio: $${safeNum(sale.change_amount).toFixed(2)}</p>
                ` : ''}
            </div>
            <div class="footer">
                ¡Gracias por su preferencia!<br>
                PostMovil - Sistema de Gestión
            </div>
        </body>
        </html>
    `;
};

export const getSalesReportHtml = (sales: any[], periodName: string, totalCount: number, sumTotal: number) => {
    return `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: sans-serif; padding: 20px; }
                h1 { text-align: center; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
                .meta { margin-bottom: 20px; display: flex; justify-content: space-between; background: #f5f5f5; padding: 10px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #1a237e; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .summary { margin-top: 30px; text-align: right; border-top: 3px double #1a237e; padding-top: 15px; }
                .summary h2 { color: #1a237e; margin: 0; }
                .status-voided { color: #d32f2f; text-decoration: line-through; font-size: 0.8em; }
            </style>
        </head>
        <body>
            <h1>Reporte Detallado de Ventas</h1>
            <div class="meta">
                <span><strong>Periodo:</strong> ${periodName}</span>
                <span><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Factura</th>
                        <th>Fecha/Hora</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(s => `
                        <tr>
                            <td>INV-${s.id}</td>
                            <td>${new Date(s.date).toLocaleString()}</td>
                            <td>${s.client_name || 'N/A'}</td>
                            <td>${s.status === 'voided' ? '<span class="status-voided">Anulada</span>' : 'Completada'}</td>
                            <td style="font-weight: bold;">$${safeNum(s.total).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="summary">
                <p>Ventas Realizadas: ${totalCount}</p>
                <h2>TOTAL RECAUDADO: $${sumTotal.toFixed(2)}</h2>
            </div>
        </body>
        </html>
    `;
};

export const getCreditReportHtml = (client: any, history: any[], balance: number) => {
    return `
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: sans-serif; padding: 20px;">
            <h1 style="text-align: center; color: #d32f2f;">ESTADO DE CUENTA CLIENTE</h1>
            <div style="background: #fff3e0; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p><strong>Cliente:</strong> ${client.name}</p>
                <p><strong>ID/Cédula:</strong> ${client.identification || 'N/A'}</p>
            </div>
            <h2 style="text-align: right; background: #d32f2f; color: white; padding: 10px;">SALDO PENDIENTE: $${balance.toFixed(2)}</h2>
            <p style="text-align: center; margin-top: 50px; font-size: 0.8em; color: #999;">Documento Informativo - PostMovil</p>
        </body>
        </html>
    `;
};

// Mantener compatibilidad con funciones antiguas por ahora
export const generatePdfReceipt = async (sale: any, items: any[], client?: any) => {
    const html = getReceiptHtml(sale, items, client);
    await saveAndShareHtml(html, 'Recibo');
};

export const generateSalesReport = async (sales: any[], periodName: string, totalCount: number, sumTotal: number) => {
    const html = getSalesReportHtml(sales, periodName, totalCount, sumTotal);
    await saveAndShareHtml(html, 'Reporte_Ventas');
};
