import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(<any>pdfMake).vfs = pdfFonts.pdfMake.vfs;

export const generatePdfReceipt = (sale: any, items: any[], client?: any) => {
    const docDefinition: any = {
        pageSize: {
            width: 80 * 2.83465, // 80mm
            height: 'auto'
        },
        pageMargins: [10, 10, 10, 10],
        content: [
            { text: 'POSTMOVIL S.A.S', style: 'header', alignment: 'center' },
            { text: 'NIT: 900.000.000-1', alignment: 'center', margin: [0, 0, 0, 10] },
            { text: `Factura N°: INV-${sale.id.toString().padStart(6, '0')}`, style: 'subheader' },
            { text: `Fecha: ${new Date(sale.date).toLocaleString()}`, style: 'subheader' },
            { text: `Tipo: ${sale.type === 'cash' ? 'Contado' : 'Crédito'}`, style: 'subheader', margin: [0, 0, 0, 10] },
            client ? { text: `Cliente: ${client.name}`, style: 'subheader', margin: [0, 0, 0, 10] } : null,
            { text: '----------------------------------------', alignment: 'center' },
            {
                table: {
                    widths: ['*', 'auto', 'auto'],
                    body: [
                        [{ text: 'Cant x Artículo', bold: true }, { text: 'V.Unit', bold: true }, { text: 'Total', bold: true }],
                        ...items.map(i => [
                            `${i.quantity}x ${i.name}`,
                            `$${i.price.toFixed(2)}`,
                            `$${i.subtotal.toFixed(2)}`
                        ])
                    ]
                },
                layout: 'noBorders',
                margin: [0, 5, 0, 5]
            },
            { text: '----------------------------------------', alignment: 'center' },
            { text: `TOTAL: $${sale.total.toFixed(2)}`, style: 'total', alignment: 'right' },
            { text: '¡Gracias por su compra!', alignment: 'center', margin: [0, 20, 0, 0] }
        ].filter(Boolean),
        styles: {
            header: { fontSize: 14, bold: true },
            subheader: { fontSize: 10 },
            total: { fontSize: 12, bold: true }
        },
        defaultStyle: { fontSize: 10 }
    };

    pdfMake.createPdf(docDefinition).download(`Factura_INV-${sale.id}.pdf`);
};

export const generateCreditReport = (client: any, history: any[], balance: number) => {
    const docDefinition: any = {
        content: [
            { text: `Estado de Cuenta - Cliente: ${client.name}`, style: 'header' },
            { text: `Identificación: ${client.identification || 'N/A'}` },
            { text: `Contacto: ${client.contact || 'N/A'}`, margin: [0, 0, 0, 20] },
            { text: `Saldo Pendiente Total: $${balance.toFixed(2)}`, style: 'balance', margin: [0, 0, 0, 20] },
            { text: 'Historial de Movimientos', style: 'subheader', margin: [0, 0, 0, 10] },
            {
                table: {
                    headerRows: 1,
                    widths: ['auto', '*', 'auto', 'auto'],
                    body: [
                        ['Fecha', 'Descripción', 'Tipo', 'Monto'],
                        ...history.map(h => [
                            new Date(h.date).toLocaleDateString(),
                            h.description,
                            h.type,
                            `$${parseFloat(h.amount).toFixed(2)}`
                        ])
                    ]
                }
            }
        ],
        styles: {
            header: { fontSize: 18, bold: true },
            balance: { fontSize: 16, bold: true, color: 'red' },
            subheader: { fontSize: 14, bold: true }
        }
    };
    pdfMake.createPdf(docDefinition).download(`Estado_Cuenta_${client.name}.pdf`);
};

export const generateSalesReport = (sales: any[], periodName: string, totalCount: number, sumTotal: number) => {
    const docDefinition: any = {
        pageOrientation: 'landscape',
        content: [
            { text: `Reporte de Ventas: ${periodName}`, style: 'header', margin: [0, 0, 0, 20] },
            { text: `Total de Ventas: ${totalCount}` },
            { text: `Ingreso Total: $${sumTotal.toFixed(2)}`, style: 'balance', margin: [0, 0, 0, 20] },
            {
                table: {
                    headerRows: 1,
                    widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto'],
                    body: [
                        ['Factura N°', 'Fecha', 'Tipo', 'Cliente', 'Estado', 'Total'],
                        ...sales.map(s => [
                            `INV-${s.id.toString().padStart(6, '0')}`,
                            new Date(s.date).toLocaleString(),
                            s.type === 'cash' ? 'Contado' : 'Crédito',
                            s.client_name || 'N/A',
                            s.status,
                            `$${s.total.toFixed(2)}`
                        ])
                    ]
                }
            }
        ],
        styles: {
            header: { fontSize: 18, bold: true },
            balance: { fontSize: 14, bold: true }
        }
    };
    pdfMake.createPdf(docDefinition).download(`Reporte_Ventas_${periodName}.pdf`);
};
