import fs from 'fs';
import { join } from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import WebSocket from 'ws';

const PORT = 8080;
const CSV_FILE = join(__dirname, 'datos_sensor.csv');

//definimos las columnas del cvs
const csvWriter = createObjectCsvWriter({
    path: CSV_FILE,
    header: [
        { id: 'ts', title: 'timestamp' },
        { id: 'ax', title: 'ax' },
        { id: 'ay', title: 'ay' },
        { id: 'az', title: 'az' },
        { id: 'gx', title: 'gx' },
        { id: 'gy', title: 'gy' },
        { id: 'gz', title: 'gz' },
        { id: 'label', title: 'label' } //para registrar caidas
    ],
    append: fs.existsSync(CSV_FILE) // para reescribir si existe
});

//para ver si existe el archivo csv
async function ensureCsvFile() {
    if (!fs.existsSync(CSV_FILE)) {
        await csvWriter.writeRecords([]); // escribimos solo cabezera
        console.log('Archivo CSV creado con header:', CSV_FILE);
    } else {
        console.log('Usando archivo CSV existente:', CSV_FILE);
    }
}


//inicializamos websocket

(
    async () => {
        await ensureCsvFile();
        const wss = new WebSocket.Server({ port: PORT }, () => {
            console.log(`Web socket inicializado en ws://0.0.0.0:${PORT}`)
        })

        wss.on('connection', (ws, rq) => {
            const clientIp = req.socket.remoteAddress + ':' + req.socket.remotePort;
            console.log(`🟢 Cliente conectado: ${clientIp}`);
            ws.send(JSON.stringify({ status: 'connected', serverTime: new Date().toISOString() }));
            ws.on('message', async (message) => {
                try {
                    //recibimos json
                    const data = JSON.parse(message.toString());
                    //normalizamos datos recibidos
                    const ax = Number(data.ax ?? data.AX ?? null);
                    const ay = Number(data.ay ?? data.AY ?? null);
                    const az = Number(data.az ?? data.AZ ?? null);
                    const gx = Number(data.gx ?? data.GX ?? null);
                    const gy = Number(data.gy ?? data.GY ?? null);
                    const gz = Number(data.gz ?? data.GZ ?? null);
                    const label = (data.label !== undefined) ? String(data.label) : '';
                    if ([ax, ay, az, gx, gy, gz, label].some(v => Number.isNaN(v))) {
                        ws.send(JSON.stringify({ status: 'error', message: 'Algun cambio en el request invalido' }))
                        return;
                    }
                    const record = {
                        ts: new Date().toISOString(),
                        ax, ay, az, gx, gy, gz, label
                    };
                    //escribimos en csv
                    await csvWriter.writeRecords([record]);
                    ws.send(JSON.stringify({ status: 'ok', written: record.ts }));
                    console.log(`Registro guardado ${record}`);

                } catch (e) {
                    console.error(`Error al enviar datos al websocket ${e.message}`);
                    ws.send(JSON.stringify({ status: 'error', message: 'Error inesperado' }))
                }
            })
        })
        ws.on('close', () => {
            console.log('Cliente desconectado');
        });

        ws.on('error', (e) => {
            console.error(`Error en el websocket ${e.message}`);
        });
    }

)();

