require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function syncLocalToRemote(client, localFolder, remoteFolder) {
    if (!fs.existsSync(localFolder)) {
        console.warn(`[OMITIDO] No se encontro la carpeta local ${localFolder}`);
        return;
    }
    await client.ensureDir(remoteFolder);

    const remoteList = await client.list();
    const remoteMap = new Map();
    for (const item of remoteList) {
        remoteMap.set(item.name, item);
    }

    const localItems = fs.readdirSync(localFolder);

    for (const item of localItems) {
        // PROTOCOLO FULLSCREEN: jamas subir archivos de configuración Apache
        // (.htaccess, .htpasswd, etc.). El .htaccess central vive en megaskill.
        if (item.startsWith('.ht')) continue;

        const localPath = path.join(localFolder, item);
        const stat = fs.statSync(localPath);

        if (stat.isDirectory()) {
            await syncLocalToRemote(client, localPath, remoteFolder + '/' + item);
            await client.cd(remoteFolder);
        } else {
            const remoteItem = remoteMap.get(item);

            if (!remoteItem || remoteItem.size !== stat.size) {
                console.log('[SUBIENDO] ' + remoteFolder + '/' + item);
                await client.uploadFrom(localPath, item);
            }
        }
    }
}

async function uploadToFtp() {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    const ftpHost = process.env.FTP_HOST || 'c1700065.ferozo.com';
    const ftpUser = process.env.FTP_USER || 'c1700065';
    const ftpPassword = process.env.FTP_PASS;
    const remoteDir = process.env.FTP_REMOTE_BASE || '/public_html/vuelapelucas3000';

    if (!ftpPassword) {
        console.error('❌ Error: No se encontró FTP_PASS en el archivo .env');
        process.exit(1);
    }

    try {
        console.log(`--- Iniciando conexion FTP para vuelapelucas3000 -> ${remoteDir} ---`);
        console.log('Comparando archivos... Solo subiendo los modificados o nuevos.');

        await client.access({
            host: ftpHost,
            user: ftpUser,
            password: ftpPassword,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });

        const localPublicFolder = path.join(__dirname, '../public');

        await syncLocalToRemote(client, localPublicFolder, remoteDir);

        console.log('==========================================');
        console.log('¡Sincronizacion FTP completada con exito!');
        console.log(`Archivos disponibles en destino: ${remoteDir}`);
        console.log('==========================================');

    } catch (err) {
        console.error('❌ Ocurrio un error en la subida FTP:', err);
        process.exitCode = 1;
    } finally {
        client.close();
    }
}

uploadToFtp();
